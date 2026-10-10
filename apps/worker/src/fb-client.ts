import type { IFacebookPublishClient } from '@fbuploadpro/contracts';

export type { IFacebookPublishClient };

export interface FacebookGraphErrorData {
  message: string;
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
  public readonly isRateLimit: boolean;
  public readonly isAuthError: boolean;
  public readonly isPermanentPolicyError: boolean;

  constructor(message: string, errorData?: FacebookGraphErrorData) {
    super(message);
    this.name = 'FacebookGraphError';
    this.code = errorData?.code;
    this.errorSubcode = errorData?.error_subcode;
    this.errorType = errorData?.type;
    this.fbtraceId = errorData?.fbtrace_id;
    this.isAuthError = this.code === 190 || this.code === 102;
    this.isPermanentPolicyError =
      this.code === 368 &&
      (this.errorSubcode === 4854002 || this.errorSubcode === 1404082);
    this.isRateLimit =
      this.code === 4 ||
      this.code === 17 ||
      this.code === 32 ||
      (this.code === 368 && !this.isPermanentPolicyError) ||
      this.code === 613;
    Object.setPrototypeOf(this, new.target.prototype);
  }
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
    this.baseUrl = trimTrailingSlashes(options?.baseUrl ?? 'https://graph.facebook.com/v26.0');
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  async publishReel(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
  }): Promise<{ postId: string }> {
    const { pageId, accessToken, videoUrl, caption } = params;

    // Phase 1: Start upload session
    const startUrl = `${this.baseUrl}/${encodeURIComponent(pageId)}/video_reels`;
    const startRes = await this.fetchFn(startUrl, {
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
    const videoRes = await this.fetchFn(videoUrl);
    if (!videoRes.ok || !videoRes.body) {
      throw new Error(`Failed to fetch video from ${videoUrl}: HTTP ${videoRes.status}`);
    }

    const uploadRes = await this.fetchFn(uploadUrl, {
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

    // Phase 3: Finish upload and publish
    const finishUrl = `${this.baseUrl}/${encodeURIComponent(pageId)}/video_reels`;
    const finishRes = await this.fetchFn(finishUrl, {
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

    const postId = finishData.post_id ?? finishData.id ?? finishData.video_id ?? videoId;
    return { postId: String(postId) };
  }

  async publishPhoto(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }): Promise<{ postId: string }> {
    const { pageId, accessToken, imageUrl, caption } = params;
    const url = `${this.baseUrl}/${encodeURIComponent(pageId)}/photos`;

    const res = await this.fetchFn(url, {
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

    return { postId: String(postId) };
  }

  async postComment(params: {
    postId: string;
    accessToken: string;
    message: string;
  }): Promise<{ commentId: string }> {
    const { postId, accessToken, message } = params;
    const url = `${this.baseUrl}/${encodeURIComponent(postId)}/comments`;

    const res = await this.fetchFn(url, {
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

    return { commentId: String(data.id) };
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
    return new FacebookGraphError(message, errorData);
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

  public commentsPosted: Array<{
    postId: string;
    accessToken: string;
    message: string;
  }> = [];

  public nextPostId = 'mock_post_123';
  public nextCommentId = 'mock_comment_456';
  public errorToThrow: Error | null = null;

  publishReel(params: {
    pageId: string;
    accessToken: string;
    videoUrl: string;
    caption: string;
  }): Promise<{ postId: string }> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.reelsPublished.push(params);
    return Promise.resolve({ postId: this.nextPostId });
  }

  publishPhoto(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }): Promise<{ postId: string }> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.photosPublished.push(params);
    return Promise.resolve({ postId: this.nextPostId });
  }

  postComment(params: {
    postId: string;
    accessToken: string;
    message: string;
  }): Promise<{ commentId: string }> {
    if (this.errorToThrow) {
      return Promise.reject(this.errorToThrow);
    }
    this.commentsPosted.push(params);
    return Promise.resolve({ commentId: this.nextCommentId });
  }

  reset(): void {
    this.reelsPublished = [];
    this.photosPublished = [];
    this.commentsPosted = [];
    this.errorToThrow = null;
  }
}
