import {
  evaluateGraphApiError,
  type IFacebookPublishClient,
  type GraphRateLimitTelemetry,
  type PublishResult,
  InternalError,
} from '@fbuploadpro/contracts';

export type { IFacebookPublishClient, GraphRateLimitTelemetry, PublishResult };

// --- Facebook API endpoints ---
// Centralized here (not env-overridable): tests inject alternatives via options.baseUrl.
const FB_GRAPH_API_BASE_URL = 'https://graph.facebook.com/v26.0';
const FB_RUPLOAD_BASE_URL = 'https://rupload.facebook.com/video-upload/v26.0';

// --- Retry/backoff tuning for Graph API calls ---
const FB_RETRY_MAX_ATTEMPTS = 3;
const FB_RETRY_BASE_DELAY_MS = 1000;
const FB_RETRY_MAX_DELAY_MS = 8000;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number): number {
  return Math.min(FB_RETRY_MAX_DELAY_MS, FB_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
}

/**
 * Whether a non-OK Graph API response is worth retrying: HTTP 429/5xx, or a
 * transient Graph error (e.g. rate-limit 368) reported in the JSON body.
 * Permanent errors (auth failures, policy violations, duplicates) are never retried.
 */
async function isRetryableGraphResponse(res: Response): Promise<boolean> {
  if (res.status === 429) return true;
  if (res.status >= 500 && res.status < 600) return true;
  if (res.status >= 400 && res.status < 500) {
    try {
      const data = (await res.clone().json()) as {
        error?: { code?: number; error_subcode?: number };
      };
      const code = data?.error?.code;
      if (typeof code === 'number') {
        // Canonical transient classification from contracts: covers rate-limit
        // codes (4/17/32/341/613/80000-80014) and 368, but not permanent
        // policy errors (368/4854002 checkpoint, 368/1404082 duplicate).
        return evaluateGraphApiError(code, data.error?.error_subcode)?.isTransient === true;
      }
    } catch {
      // Unparseable body — not retryable.
    }
  }
  return false;
}

export interface FacebookGraphErrorData {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
}

export class FacebookGraphError extends Error {
  public readonly code: number | undefined;
  public readonly errorSubcode: number | undefined;
  public readonly errorType: string | undefined;
  public readonly fbtraceId: string | undefined;
  public readonly telemetry?: GraphRateLimitTelemetry | undefined;
  public readonly isRateLimit: boolean;
  public readonly isAuthError: boolean;
  public readonly isPermanentPolicyError: boolean;
  public readonly isPermanentClientError: boolean;

  constructor(
    message: string,
    errorData?: FacebookGraphErrorData,
    telemetry?: GraphRateLimitTelemetry
  ) {
    super(message);
    this.name = 'FacebookGraphError';
    this.code = errorData?.code;
    this.errorSubcode = errorData?.error_subcode;
    this.errorType = errorData?.type;
    this.fbtraceId = errorData?.fbtrace_id;
    this.telemetry = telemetry;

    const evalResult =
      this.code !== undefined
        ? evaluateGraphApiError(this.code, this.errorSubcode)
        : null;

    this.isAuthError =
      evalResult?.requiresReauth === true ||
      this.code === 190 ||
      this.code === 102 ||
      this.code === 10 ||
      (typeof this.code === 'number' && this.code >= 200 && this.code <= 299);

    this.isPermanentPolicyError =
      this.code === 368 &&
      (this.errorSubcode === 4854002 || this.errorSubcode === 1404082);

    this.isPermanentClientError =
      this.code === 100 ||
      this.code === 506 ||
      this.code === 1609005 ||
      (typeof this.code === 'number' &&
        this.code >= 400 &&
        this.code < 500 &&
        !this.isAuthError);

    this.isRateLimit =
      this.code === 4 ||
      this.code === 17 ||
      this.code === 32 ||
      this.code === 341 ||
      this.code === 613 ||
      (typeof this.code === 'number' && this.code >= 80000 && this.code <= 80014) ||
      (this.code === 368 && !this.isPermanentPolicyError);

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface BucUsageSummary {
  bucUsageMaxPct?: number | undefined;
  estimatedTimeToRegainAccessMinutes?: number | undefined;
}

function parseAppUsage(header: string | null): number | undefined {
  if (!header) return undefined;
  try {
    const parsed = JSON.parse(header) as {
      call_count?: number;
      total_cputime?: number;
      total_time?: number;
    };
    return Math.max(
      parsed.call_count || 0,
      parsed.total_cputime || 0,
      parsed.total_time || 0
    );
  } catch {
    return undefined;
  }
}

function parseBucEntries(entries: Array<{
  call_count?: number;
  total_cputime?: number;
  total_time?: number;
  estimated_time_to_regain_access?: number;
}>): { maxBuc: number; maxWait: number } {
  let maxBuc = 0;
  let maxWait = 0;
  for (const entry of entries) {
    const entryMax = Math.max(
      entry.call_count || 0,
      entry.total_cputime || 0,
      entry.total_time || 0
    );
    if (entryMax > maxBuc) maxBuc = entryMax;
    if (entry.estimated_time_to_regain_access && entry.estimated_time_to_regain_access > maxWait) {
      maxWait = entry.estimated_time_to_regain_access;
    }
  }
  return { maxBuc, maxWait };
}

function parseBucUsage(header: string | null): BucUsageSummary | undefined {
  if (!header) return undefined;
  try {
    const parsed = JSON.parse(header) as Record<
      string,
      Array<{
        call_count?: number;
        total_cputime?: number;
        total_time?: number;
        estimated_time_to_regain_access?: number;
      }>
    >;

    let maxBuc = 0;
    let maxWait = 0;
    let found = false;

    for (const pageKey of Object.keys(parsed)) {
      const entries = parsed[pageKey];
      if (Array.isArray(entries)) {
        found = true;
        const entryMetrics = parseBucEntries(entries);
        if (entryMetrics.maxBuc > maxBuc) maxBuc = entryMetrics.maxBuc;
        if (entryMetrics.maxWait > maxWait) maxWait = entryMetrics.maxWait;
      }
    }

    if (!found) return undefined;
    return {
      bucUsageMaxPct: maxBuc,
      ...(maxWait > 0 ? { estimatedTimeToRegainAccessMinutes: maxWait } : {}),
    };
  } catch {
    return undefined;
  }
}

/**
 * Parses Facebook Graph API rate limit telemetry headers (X-App-Usage and X-Business-Use-Case-Usage).
 */
export function parseGraphRateLimitHeaders(
  headers?: Headers | null
): GraphRateLimitTelemetry | undefined {
  if (!headers) return undefined;

  const appUsageMaxPct = parseAppUsage(headers.get('x-app-usage'));
  const bucSummary = parseBucUsage(headers.get('x-business-use-case-usage'));

  if (appUsageMaxPct === undefined && !bucSummary) {
    return undefined;
  }

  return {
    ...(appUsageMaxPct !== undefined ? { appUsageMaxPct } : {}),
    ...(bucSummary?.bucUsageMaxPct !== undefined ? { bucUsageMaxPct: bucSummary.bucUsageMaxPct } : {}),
    ...(bucSummary?.estimatedTimeToRegainAccessMinutes !== undefined
      ? { estimatedTimeToRegainAccessMinutes: bucSummary.estimatedTimeToRegainAccessMinutes }
      : {}),
  };
}

export interface FacebookPublishClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

function trimTrailingSlashes(str: string): string {
  let end = str.length;
  while (end > 0 && str.codePointAt(end - 1) === 47) {
    end--;
  }
  return str.slice(0, end);
}

export class FacebookPublishClient implements IFacebookPublishClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options?: FacebookPublishClientOptions) {
    this.baseUrl = trimTrailingSlashes(options?.baseUrl ?? FB_GRAPH_API_BASE_URL);
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  async publishReel(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
  }): Promise<PublishResult> {
    const { pageId, accessToken, videoUrl, caption } = params;

    // Phase 1: Start upload session
    const startUrl = `${this.baseUrl}/${encodeURIComponent(pageId)}/video_reels`;
    const startRes = await this.fetchWithRetry(startUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        upload_phase: 'start',
      }),
    });

    const startData = (await this.parseJsonResponse(startRes)) as {
      video_id?: string;
      upload_url?: string;
      error?: FacebookGraphErrorData;
    };

    if (!startRes.ok || startData.error) {
      throw this.createGraphError(startRes, startData);
    }

    const { video_id: videoId, upload_url: uploadUrl } = startData;
    if (!videoId || !uploadUrl) {
      throw new FacebookGraphError(
        'Invalid start session response from Facebook: missing video_id or upload_url'
      );
    }

    // Phase 2: Stream video bytes from videoUrl to upload_url
    await this.streamVideoUpload(uploadUrl, accessToken, videoUrl);

    // Phase 3: Finish upload and publish
    const finishUrl = `${this.baseUrl}/${encodeURIComponent(pageId)}/video_reels`;
    const finishRes = await this.fetchWithRetry(finishUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_state: 'PUBLISHED',
        description: caption,
        video_id: videoId,
      }),
    });

    const finishData = (await this.parseJsonResponse(finishRes)) as {
      success?: boolean;
      post_id?: string;
      id?: string;
      video_id?: string;
      error?: FacebookGraphErrorData;
    };

    if (!finishRes.ok || finishData.error) {
      throw this.createGraphError(finishRes, finishData);
    }

    const telemetry = parseGraphRateLimitHeaders(finishRes.headers);
    const postId = finishData.post_id ?? finishData.id ?? finishData.video_id ?? videoId;
    return { postId: String(postId), ...(telemetry ? { telemetry } : {}) };
  }

  async publishPhoto(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }): Promise<PublishResult> {
    const { pageId, accessToken, imageUrl, caption } = params;
    const url = `${this.baseUrl}/${encodeURIComponent(pageId)}/photos`;

    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: imageUrl,
        caption,
        published: true,
      }),
    });

    const data = (await this.parseJsonResponse(res)) as {
      id?: string;
      post_id?: string;
      error?: FacebookGraphErrorData;
    };

    if (!res.ok || data.error) {
      throw this.createGraphError(res, data);
    }

    const postId = data.post_id ?? data.id;
    if (!postId) {
      throw new FacebookGraphError('Invalid photo response from Facebook: missing id/post_id');
    }

    const telemetry = parseGraphRateLimitHeaders(res.headers);
    return { postId: String(postId), ...(telemetry ? { telemetry } : {}) };
  }

  async publishTextPost(params: {
    pageId: string;
    accessToken: string;
    message: string;
    linkUrl?: string | null | undefined;
  }): Promise<PublishResult> {
    const { pageId, accessToken, message, linkUrl } = params;
    const url = `${this.baseUrl}/${encodeURIComponent(pageId)}/feed`;

    const bodyPayload: Record<string, string> = { message };
    if (linkUrl) {
      bodyPayload.link = linkUrl;
    }

    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = (await this.parseJsonResponse(res)) as {
      id?: string;
      error?: FacebookGraphErrorData;
    };

    if (!res.ok || data.error) {
      throw this.createGraphError(res, data);
    }

    if (!data.id) {
      throw new FacebookGraphError('Invalid text feed response from Facebook: missing id');
    }

    const telemetry = parseGraphRateLimitHeaders(res.headers);
    return { postId: String(data.id), ...(telemetry ? { telemetry } : {}) };
  }

  async publishVideo(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
    title?: string | undefined;
  }): Promise<PublishResult> {
    const { pageId, accessToken, videoUrl, caption, title } = params;
    const url = `${this.baseUrl}/${encodeURIComponent(pageId)}/videos`;

    const bodyPayload: Record<string, string> = {
      file_url: videoUrl,
      description: caption,
    };
    if (title) {
      bodyPayload.title = title;
    }

    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = (await this.parseJsonResponse(res)) as {
      id?: string;
      error?: FacebookGraphErrorData;
    };

    if (!res.ok || data.error) {
      throw this.createGraphError(res, data);
    }

    if (!data.id) {
      throw new FacebookGraphError('Invalid video response from Facebook: missing id');
    }

    const telemetry = parseGraphRateLimitHeaders(res.headers);
    return { postId: String(data.id), ...(telemetry ? { telemetry } : {}) };
  }

  async publishPhotoStory(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
  }): Promise<PublishResult> {
    const { pageId, accessToken, imageUrl } = params;

    // Step 1: Upload unpublished photo
    const photoUploadUrl = `${this.baseUrl}/${encodeURIComponent(pageId)}/photos`;
    const photoRes = await this.fetchWithRetry(photoUploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: imageUrl,
        published: false,
      }),
    });

    const photoData = (await this.parseJsonResponse(photoRes)) as {
      id?: string;
      error?: FacebookGraphErrorData;
    };

    if (!photoRes.ok || photoData.error) {
      throw this.createGraphError(photoRes, photoData);
    }

    if (!photoData.id) {
      throw new FacebookGraphError('Invalid photo upload response for story: missing id');
    }
    const photoId = String(photoData.id);

    // Step 2: Publish Photo Story
    const storyUrl = `${this.baseUrl}/${encodeURIComponent(pageId)}/photo_stories`;
    const storyRes = await this.fetchWithRetry(storyUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photo_id: photoId,
      }),
    });

    const storyData = (await this.parseJsonResponse(storyRes)) as {
      id?: string;
      post_id?: string;
      error?: FacebookGraphErrorData;
    };

    if (!storyRes.ok || storyData.error) {
      throw this.createGraphError(storyRes, storyData);
    }

    const postId = storyData.post_id ?? storyData.id ?? photoId;
    const telemetry = parseGraphRateLimitHeaders(storyRes.headers);
    return { postId: String(postId), ...(telemetry ? { telemetry } : {}) };
  }

  async publishVideoStory(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
  }): Promise<PublishResult> {
    const { pageId, accessToken, videoUrl } = params;

    // Step 1: Start Video Story session
    const startUrl = `${this.baseUrl}/${encodeURIComponent(pageId)}/video_stories`;
    const startRes = await this.fetchWithRetry(startUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        upload_phase: 'start',
      }),
    });

    const startData = (await this.parseJsonResponse(startRes)) as {
      video_id?: string;
      upload_url?: string;
      error?: FacebookGraphErrorData;
    };

    if (!startRes.ok || startData.error) {
      throw this.createGraphError(startRes, startData);
    }

    const videoId = String(startData.video_id);
    const uploadUrl =
      startData.upload_url ?? `${FB_RUPLOAD_BASE_URL}/${videoId}`;

    // Step 2: Stream video bytes from videoUrl to upload_url
    await this.streamVideoUpload(uploadUrl, accessToken, videoUrl);

    // Step 3: Finish Video Story
    const finishUrl = `${this.baseUrl}/${encodeURIComponent(pageId)}/video_stories`;
    const finishRes = await this.fetchWithRetry(finishUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_id: videoId,
      }),
    });

    const finishData = (await this.parseJsonResponse(finishRes)) as {
      id?: string;
      post_id?: string;
      error?: FacebookGraphErrorData;
    };

    if (!finishRes.ok || finishData.error) {
      throw this.createGraphError(finishRes, finishData);
    }

    const postId = finishData.post_id ?? finishData.id ?? videoId;
    const telemetry = parseGraphRateLimitHeaders(finishRes.headers);
    return { postId: String(postId), ...(telemetry ? { telemetry } : {}) };
  }

  async postComment(params: {
    postId: string;
    accessToken: string;
    message: string;
  }): Promise<{ commentId: string; telemetry?: GraphRateLimitTelemetry | undefined }> {
    const { postId, accessToken, message } = params;
    const url = `${this.baseUrl}/${encodeURIComponent(postId)}/comments`;

    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
      }),
    });

    const data = (await this.parseJsonResponse(res)) as {
      id?: string;
      error?: FacebookGraphErrorData;
    };

    if (!res.ok || data.error) {
      throw this.createGraphError(res, data);
    }

    if (!data.id) {
      throw new FacebookGraphError('Invalid comment response from Facebook: missing id');
    }

    const telemetry = parseGraphRateLimitHeaders(res.headers);
    return { commentId: String(data.id), ...(telemetry ? { telemetry } : {}) };
  }

  /**
   * fetch with exponential backoff. Retries network failures, HTTP 429/5xx,
   * and transient Graph API errors (e.g. rate-limit 368). Returns the last
   * response when retries are exhausted so callers' existing error handling applies.
   */
  private async fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      let res: Response;
      try {
        res = await this.fetchFn(url, init);
      } catch (err) {
        if (attempt >= FB_RETRY_MAX_ATTEMPTS) throw err;
        await sleepMs(retryDelayMs(attempt));
        continue;
      }
      if (res.ok) return res;
      if (attempt >= FB_RETRY_MAX_ATTEMPTS || !(await isRetryableGraphResponse(res))) {
        return res;
      }
      await sleepMs(retryDelayMs(attempt));
    }
  }

  private async parseJsonResponse(res: Response): Promise<Record<string, unknown>> {
    try {
      const data = await res.json();
      return (data as Record<string, unknown>) ?? {};
    } catch {
      return {};
    }
  }

  private createGraphError(res: Response, data: Record<string, unknown>): FacebookGraphError {
    const errorData = (data?.error as FacebookGraphErrorData) ?? undefined;
    const message = errorData?.message ?? `Facebook Graph API error: HTTP ${res.status}`;
    const telemetry = parseGraphRateLimitHeaders(res.headers);
    return new FacebookGraphError(message, errorData, telemetry);
  }

  private async streamVideoUpload(
    uploadUrl: string,
    accessToken: string,
    videoUrl: string
  ): Promise<void> {
    const videoRes = await this.fetchWithRetry(videoUrl);
    if (!videoRes.ok || !videoRes.body) {
      throw new InternalError(`Failed to fetch video from ${videoUrl}: HTTP ${videoRes.status}`);
    }

    const uploadRes = await this.fetchWithRetry(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        offset: '0',
        'Content-Type': 'application/octet-stream',
      },
      body: videoRes.body,
      duplex: 'half',
    } as RequestInit);

    if (!uploadRes.ok) {
      const uploadData = await this.parseJsonResponse(uploadRes);
      throw this.createGraphError(uploadRes, uploadData);
    }
  }
}

export class MockFacebookPublishClient implements IFacebookPublishClient {
  public reelsPublished: Array<{
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
  }> = [];

  public photosPublished: Array<{
    pageId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }> = [];

  public textPostsPublished: Array<{
    pageId: string;
    message: string;
    linkUrl?: string | null | undefined;
  }> = [];

  public videosPublished: Array<{
    pageId: string;
    videoUrl: string;
    caption: string;
    title?: string | undefined;
  }> = [];

  public photoStoriesPublished: Array<{
    pageId: string;
    imageUrl: string;
  }> = [];

  public videoStoriesPublished: Array<{
    pageId: string;
    videoUrl: string;
  }> = [];

  public commentsPosted: Array<{
    postId: string;
    accessToken: string;
    message: string;
  }> = [];

  public nextPostId = 'mock_post_123';
  public nextCommentId = 'mock_comment_456';
  public errorToThrow: Error | null = null;
  public commentErrorToThrow: Error | null = null;
  public telemetryToReturn?: GraphRateLimitTelemetry | undefined;

  publishReel(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.reelsPublished.push(params);
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishPhoto(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.photosPublished.push(params);
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishTextPost(params: {
    pageId: string;
    accessToken: string;
    message: string;
    linkUrl?: string | null | undefined;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.textPostsPublished.push({
      pageId: params.pageId,
      message: params.message,
      ...(params.linkUrl !== undefined ? { linkUrl: params.linkUrl } : {}),
    });
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishVideo(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
    title?: string | undefined;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.videosPublished.push({
      pageId: params.pageId,
      videoUrl: params.videoUrl,
      caption: params.caption,
      ...(params.title !== undefined ? { title: params.title } : {}),
    });
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishPhotoStory(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.photoStoriesPublished.push({
      pageId: params.pageId,
      imageUrl: params.imageUrl,
    });
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  publishVideoStory(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
  }): Promise<PublishResult> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.videoStoriesPublished.push({
      pageId: params.pageId,
      videoUrl: params.videoUrl,
    });
    return Promise.resolve({
      postId: this.nextPostId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  postComment(params: {
    postId: string;
    accessToken: string;
    message: string;
  }): Promise<{ commentId: string; telemetry?: GraphRateLimitTelemetry | undefined }> {
    if (this.commentErrorToThrow) {
      return Promise.reject(this.commentErrorToThrow);
    }
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.commentsPosted.push(params);
    return Promise.resolve({
      commentId: this.nextCommentId,
      ...(this.telemetryToReturn ? { telemetry: this.telemetryToReturn } : {}),
    });
  }

  reset(): void {
    this.reelsPublished = [];
    this.photosPublished = [];
    this.textPostsPublished = [];
    this.videosPublished = [];
    this.photoStoriesPublished = [];
    this.videoStoriesPublished = [];
    this.commentsPosted = [];
    this.errorToThrow = null;
    this.commentErrorToThrow = null;
    this.telemetryToReturn = undefined;
  }
}
