import {
  ThreadsPlatformOptionsSchema,
  resolvePublishLimit,
  validateThreadsText,
  type ClassifiedPublishError,
  type DatabaseDestinationRow,
  type DatabaseSocialAccountRow,
  type DatabaseUnifiedQueueItemRow,
  type Platform,
  type Publisher,
  type PublisherTokenSet,
  type PublishLimitOverride,
  type PublishOutcome,
  type RefreshedTokenSet,
  type ThreadsCarouselItem,
  type ThreadsPlatformOptions,
  ValidationError,
} from '@fbuploadpro/contracts';
import {
  ThreadsGraphError,
  ThreadsPublishClient,
  type IThreadsPublishClient,
  type ThreadsContainerCreateParams,
} from '../threads-client.js';

// ==========================================
// Threads publisher (spec 124 — async poll-publish state machine)
// ==========================================
//
// A Threads post is NEVER a single synchronous call:
//   create container → poll `status` (at most once a minute, up to 5
//   minutes; initial 404s tolerated while the container propagates) →
//   publish ONLY on FINISHED via `threads_publish`, whose returned id
//   is a DIFFERENT media id — that id is the `externalPostId`.
// Containers expire after 24 h, so they are created at publish time
// only. The container id rides in every outcome's `detail` from
// creation, so settlement persists it in `publish_logs.detail`.
//
// Transient trap: `threads_publish` can answer "media cannot be
// found" (code 24 / subcode 4279009) while the container is still
// propagating. The only correct handling is to re-read the container
// status before any retry — PUBLISHED settles published, FINISHED may
// be published again, anything else retries the whole attempt — never
// a blind re-publish.
//
// Media: public URL ONLY. There is no upload endpoint; Meta fetches
// `image_url` / `video_url` itself. This module contains no upload
// path of any kind.
//
// Reply chains: follow-up posts in `platform_options.replyChain` are
// published in order after the main post, each as a reply to the
// previous post's media id. If a chain step fails after the main post
// is live, the item still settles published with a warning — the main
// post is never failed for a follow-up.
//
// Quota (D5): the live per-profile quota is read from
// `threads_publishing_limit` where available and fed through the
// contracts destination-override seam. Tokens (D6): `publish()` never
// refreshes; `refreshTokens` exists solely for the spec 121 job.

export const THREADS_PLATFORM: Platform = 'threads';

/** Container polling cadence: at most 1 check/minute, up to 5 minutes. */
export const THREADS_CONTAINER_POLL_INTERVAL_MS = 60_000;
export const THREADS_CONTAINER_MAX_POLLS = 5;

/** threads_publish's "media cannot be found" trap identifiers. */
export const THREADS_CONTAINER_NOT_FOUND_CODE = 24;
export const THREADS_CONTAINER_NOT_PROPAGATED_SUBCODE = 4279009;

const RETRY_BASE_DELAY_SECONDS = 300;
const RETRY_MAX_DELAY_SECONDS = 3600;

export interface ThreadsPublisherOptions {
  pollIntervalMs?: number | undefined;
  maxPolls?: number | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ExtractedError {
  code: number | undefined;
  subcode: number | undefined;
  message: string;
  httpStatus: number | undefined;
}

function numericField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function extractError(err: unknown): ExtractedError {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof ThreadsGraphError) {
    return {
      code: err.code,
      subcode: err.errorSubcode,
      message,
      httpStatus: err.httpStatus,
    };
  }
  const record = (err ?? {}) as Record<string, unknown>;
  return {
    code: numericField(record.code),
    subcode:
      numericField(record.error_subcode) ??
      numericField(record.errorSubcode) ??
      numericField(record.subcode),
    message,
    httpStatus: numericField(record.httpStatus) ?? numericField(record.status),
  };
}

function isRateLimitCode(code: number | undefined): boolean {
  return (
    code === 4 || code === 17 || code === 32 || code === 341 || code === 613 ||
    (code !== undefined && code >= 80000 && code <= 80014)
  );
}

export function isThreadsContainerNotFound(err: unknown): boolean {
  const { code, subcode, httpStatus } = extractError(err);
  return (
    (code === THREADS_CONTAINER_NOT_FOUND_CODE &&
      subcode === THREADS_CONTAINER_NOT_PROPAGATED_SUBCODE) ||
    (code === THREADS_CONTAINER_NOT_FOUND_CODE && httpStatus === 404)
  );
}

/**
 * Classifies a Threads failure into the shared taxonomy:
 *   auth      — 190 (and 102/10/2xx): reconnect required;
 *   retryable — the 24/4279009 propagation trap, rate limits, 5xx,
 *               404s, and unknown transport failures;
 *   permanent — everything else with a definitive API answer.
 */
export function classifyThreadsError(err: unknown): ClassifiedPublishError {
  const { code, subcode, message, httpStatus } = extractError(err);

  // Our own pre-flight validation (missing media, bad carousel, …) is a
  // definitive content problem — permanent, never retried. ValidationError
  // carries a string code that extractError cannot read as a number, so
  // it must be recognised before the numeric branches, or it falls into
  // the code-undefined retryable branch by mistake.
  if (err instanceof ValidationError) {
    return { kind: 'permanent', code: 'validation', message };
  }
  if (code === 190 || code === 102 || code === 10 || (code !== undefined && code >= 200 && code <= 299)) {
    return {
      kind: 'auth',
      code: code !== undefined ? String(code) : 'auth',
      ...(subcode !== undefined ? { subcode: String(subcode) } : {}),
      message:
        code === 190
          ? 'Your Threads connection has expired. Reconnect the account to keep posting.'
          : message,
    };
  }
  if (isThreadsContainerNotFound(err)) {
    return {
      kind: 'retryable',
      code: String(THREADS_CONTAINER_NOT_FOUND_CODE),
      subcode: String(THREADS_CONTAINER_NOT_PROPAGATED_SUBCODE),
      message,
      retryDelaySeconds: 60,
    };
  }
  if (isRateLimitCode(code)) {
    return {
      kind: 'retryable',
      code: String(code),
      ...(subcode !== undefined ? { subcode: String(subcode) } : {}),
      message,
      retryDelaySeconds: RETRY_BASE_DELAY_SECONDS,
    };
  }
  if (
    httpStatus === 404 ||
    (httpStatus !== undefined && httpStatus >= 500) ||
    code === undefined
  ) {
    return {
      kind: 'retryable',
      code: code !== undefined ? String(code) : 'unknown',
      ...(subcode !== undefined ? { subcode: String(subcode) } : {}),
      message,
    };
  }
  return {
    kind: 'permanent',
    code: String(code),
    ...(subcode !== undefined ? { subcode: String(subcode) } : {}),
    message,
  };
}

function retryDelay(retryCount: number): number {
  return Math.min(
    RETRY_MAX_DELAY_SECONDS,
    RETRY_BASE_DELAY_SECONDS * Math.pow(2, retryCount || 0)
  );
}

export class ThreadsPublisher implements Publisher {
  readonly platform: Platform = THREADS_PLATFORM;
  private readonly client: IThreadsPublishClient;
  private readonly pollIntervalMs: number;
  private readonly maxPolls: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    client: IThreadsPublishClient = new ThreadsPublishClient(),
    options?: ThreadsPublisherOptions
  ) {
    this.client = client;
    this.pollIntervalMs =
      options?.pollIntervalMs ?? THREADS_CONTAINER_POLL_INTERVAL_MS;
    this.maxPolls = options?.maxPolls ?? THREADS_CONTAINER_MAX_POLLS;
    this.sleep = options?.sleep ?? sleepMs;
  }

  mapError(err: unknown): ClassifiedPublishError {
    return classifyThreadsError(err);
  }

  /**
   * Called ONLY by the spec 121 refresh job (D6) — the single owner of
   * token rotation. Refreshes the 60-day long-lived token in place.
   */
  async refreshTokens(
    _account: DatabaseSocialAccountRow,
    tokens: PublisherTokenSet
  ): Promise<RefreshedTokenSet> {
    const refreshed = await this.client.refreshLongLivedToken({
      accessToken: tokens.accessToken,
    });
    return {
      accessToken: refreshed.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt:
        refreshed.expiresIn !== undefined
          ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
          : (tokens.tokenExpiresAt ?? null),
    };
  }

  async publish(
    item: DatabaseUnifiedQueueItemRow,
    destination: DatabaseDestinationRow,
    tokens: PublisherTokenSet
  ): Promise<PublishOutcome> {
    const threadsUserId = destination.external_destination_id;
    const accessToken = tokens.accessToken;
    if (!accessToken) {
      return {
        status: 'failed',
        error: {
          kind: 'permanent',
          code: 'missing_access_token',
          message:
            'We could not read the saved sign-in for this Threads account. Reconnect the account and try again.',
        },
        detail: { platform: 'threads' },
      };
    }

    // ---- Pre-claim validation surfaces (contracts schemas) ----
    const textError = validateThreadsText(item.caption ?? '');
    if (textError) return this.validationFailure(textError);

    const optionsParse = ThreadsPlatformOptionsSchema.safeParse(
      item.platform_options ?? {}
    );
    if (!optionsParse.success) {
      const first = optionsParse.error.issues[0];
      return this.validationFailure(
        `This post's Threads settings need a fix: ${first ? `${first.path.join('.')} — ${first.message}` : 'invalid settings'}. Update the post and try again.`
      );
    }
    const options = optionsParse.data;

    // ---- Live quota read (D5) — best effort, never blocks the post ----
    const liveLimit = await this.readLiveLimit(threadsUserId, accessToken);

    // At the platform-reported cap the post DEFERS (D5) — the live
    // total overrides the claim-side default, and publishing into a
    // certain rejection would fail the post instead of pausing it.
    const limitOutcome = this.publishingLimitOutcome(liveLimit);
    if (limitOutcome) return limitOutcome;

    // ---- Main post through the state machine ----
    // mainContainerParams validates content (a media post with no media
    // URL, a carousel with too few items) and throws ValidationError —
    // the params must be built inside a guard: evaluated as an argument
    // the throw escaped publish() entirely, the queue message was never
    // settled, and the item burned retries into the DLQ instead of
    // failing permanently as a content problem.
    let mainParams: ThreadsContainerCreateParams;
    try {
      mainParams = this.mainContainerParams(item, options, threadsUserId, accessToken);
    } catch (err) {
      return this.failureOutcome(err, item, undefined, liveLimit);
    }
    const main = await this.publishOne(mainParams, threadsUserId, accessToken, item, liveLimit);
    if (main.outcome) return main.outcome;
    const mediaId = main.mediaId as string;
    const detail: Record<string, unknown> = {
      platform: 'threads',
      containerId: main.containerId,
      mediaId,
      ...(liveLimit.detail ? { publishingLimit: liveLimit.detail } : {}),
    };

    // ---- Reply chain: in-order follow-ups, warning on failure ----
    let warning: string | undefined;
    if (options.replyChain?.length) {
      let replyToId = mediaId;
      const chainMediaIds: string[] = [];
      for (const step of options.replyChain) {
        const stepResult = await this.publishOne(
          {
            threadsUserId,
            accessToken,
            mediaType: step.mediaType
              ? step.mediaType === 'video'
                ? 'VIDEO'
                : 'IMAGE'
              : 'TEXT',
            ...(step.text ? { text: step.text } : {}),
            ...(step.mediaUrl
              ? step.mediaType === 'video'
                ? { videoUrl: step.mediaUrl }
                : { imageUrl: step.mediaUrl }
              : {}),
            ...(step.altText ? { altText: step.altText } : {}),
            replyToId,
          },
          threadsUserId,
          accessToken,
          item,
          liveLimit
        );
        if (stepResult.outcome || !stepResult.mediaId) {
          warning =
            'Your post is live, but a follow-up post in the chain could not be published.';
          break;
        }
        chainMediaIds.push(stepResult.mediaId);
        replyToId = stepResult.mediaId;
      }
      if (chainMediaIds.length) detail.replyChainMediaIds = chainMediaIds;
    }

    return {
      status: 'published',
      externalPostId: mediaId,
      ...(warning ? { commentWarning: warning } : {}),
      detail,
    };
  }

  // ------------------------------------------

  private validationFailure(message: string): PublishOutcome {
    return {
      status: 'failed',
      error: { kind: 'permanent', code: 'validation', message },
      detail: { platform: 'threads' },
    };
  }

  private async readLiveLimit(
    threadsUserId: string,
    accessToken: string
  ): Promise<{
    resolved: ReturnType<typeof resolvePublishLimit>;
    detail?: Record<string, unknown> | undefined;
  }> {
    try {
      const limit = await this.client.getPublishingLimit({
        threadsUserId,
        accessToken,
      });
      const override: PublishLimitOverride | undefined =
        limit.totalCount !== undefined
          ? {
              publishedPosts: {
                maxCount: limit.totalCount,
                windowSeconds: 24 * 3600,
              },
            }
          : undefined;
      return {
        resolved: resolvePublishLimit('threads', override),
        detail: {
          ...(limit.usage !== undefined ? { usage: limit.usage } : {}),
          ...(limit.totalCount !== undefined
            ? { totalCount: limit.totalCount }
            : {}),
        },
      };
    } catch {
      return { resolved: resolvePublishLimit('threads') };
    }
  }

  private mainContainerParams(
    item: DatabaseUnifiedQueueItemRow,
    options: ThreadsPlatformOptions,
    threadsUserId: string,
    accessToken: string
  ): ThreadsContainerCreateParams {
    const shared: Partial<ThreadsContainerCreateParams> = {
      ...(options.replyControl ? { replyControl: options.replyControl } : {}),
      ...(options.topicTag ? { topicTag: options.topicTag } : {}),
      ...(options.quotePostId ? { quotePostId: options.quotePostId } : {}),
      ...(options.replyToId ? { replyToId: options.replyToId } : {}),
      ...(options.altText ? { altText: options.altText } : {}),
      ...(options.textAttachment
        ? { textAttachment: options.textAttachment }
        : {}),
    };
    const text = item.caption ?? '';

    if (item.kind === 'carousel') {
      return {
        threadsUserId,
        accessToken,
        mediaType: 'CAROUSEL',
        ...(text ? { text } : {}),
        ...shared,
        // Children are created by publishOne's carousel pre-step; the
        // placeholder is replaced there. This branch is never sent
        // as-is (see createMainContainer).
        children: [],
      };
    }
    if (item.kind === 'video') {
      return {
        threadsUserId,
        accessToken,
        mediaType: 'VIDEO',
        videoUrl: this.requireMediaUrl(item),
        ...(text ? { text } : {}),
        ...shared,
      };
    }
    if (item.kind === 'image') {
      return {
        threadsUserId,
        accessToken,
        mediaType: 'IMAGE',
        imageUrl: this.requireMediaUrl(item),
        ...(text ? { text } : {}),
        ...shared,
      };
    }
    // Text post (also the fallback for a kind with no media).
    return {
      threadsUserId,
      accessToken,
      mediaType: 'TEXT',
      text,
      ...(options.linkAttachment || item.link_url
        ? { linkAttachment: options.linkAttachment ?? (item.link_url as string) }
        : {}),
      ...shared,
    };
  }

  private requireMediaUrl(item: DatabaseUnifiedQueueItemRow): string {
    if (!item.media_url) {
      throw new ValidationError(
        'This post is missing its photo or video. Add the media and try again.'
      );
    }
    return item.media_url;
  }

  private carouselItems(
    item: DatabaseUnifiedQueueItemRow,
    options: ThreadsPlatformOptions
  ): ThreadsCarouselItem[] {
    if (options.carouselItems?.length) return options.carouselItems;
    const raw = (item.platform_options as Record<string, unknown>)?.media_urls;
    if (Array.isArray(raw)) {
      const items = raw
        .filter((u): u is string => typeof u === 'string')
        .map((mediaUrl) => ({
          mediaUrl,
          mediaType: (/\.(?:mp4|mov)(?:\?|$)/i.test(mediaUrl)
            ? 'video'
            : 'image') as 'image' | 'video',
        }));
      if (items.length >= 2) return items;
    }
    throw new ValidationError(
      'A carousel post needs at least two photos or videos. Add the items and try again.'
    );
  }

  /**
   * Runs one container through the full state machine. Returns either
   * a settled failure/retry outcome, or the published media id plus
   * the container id.
   */
  private async publishOne(
    params: ThreadsContainerCreateParams,
    threadsUserId: string,
    accessToken: string,
    item: DatabaseUnifiedQueueItemRow,
    liveLimit?: {
      resolved: ReturnType<typeof resolvePublishLimit>;
      detail?: Record<string, unknown> | undefined;
    }
  ): Promise<{
    mediaId?: string | undefined;
    containerId?: string | undefined;
    outcome?: PublishOutcome | undefined;
  }> {
    // Carousel: one container per item, then the parent container.
    let effectiveParams = params;
    if (params.mediaType === 'CAROUSEL') {
      const optionsParse = ThreadsPlatformOptionsSchema.safeParse(
        item.platform_options ?? {}
      );
      const options = optionsParse.success ? optionsParse.data : {};
      try {
        const items = this.carouselItems(item, options);
        const childIds: string[] = [];
        for (const child of items) {
          const childContainer = await this.client.createContainer({
            threadsUserId,
            accessToken,
            mediaType: child.mediaType === 'video' ? 'VIDEO' : 'IMAGE',
            ...(child.mediaType === 'video'
              ? { videoUrl: child.mediaUrl }
              : { imageUrl: child.mediaUrl }),
            ...(child.altText ? { altText: child.altText } : {}),
            isCarouselItem: true,
          });
          childIds.push(childContainer.containerId);
        }
        effectiveParams = { ...params, children: childIds };
      } catch (err) {
        return { outcome: this.failureOutcome(err, item, undefined, liveLimit) };
      }
    }

    let containerId: string;
    try {
      const created = await this.client.createContainer(effectiveParams);
      containerId = created.containerId;
    } catch (err) {
      return { outcome: this.failureOutcome(err, item, undefined, liveLimit) };
    }
    const detail: Record<string, unknown> = { platform: 'threads', containerId };

    const poll = await this.pollUntilFinished(containerId, accessToken);
    if (poll === 'published') {
      return { mediaId: containerId, containerId };
    }
    if (poll !== 'finished') {
      return {
        outcome:
          poll === 'retry'
            ? {
                status: 'retry',
                error: {
                  kind: 'retryable',
                  code: 'container_still_processing',
                  message:
                    'Threads is still preparing this post. It will be tried again shortly.',
                },
                retryDelaySeconds: retryDelay(item.retry_count),
                detail,
              }
            : {
                status: 'failed',
                error: {
                  kind: 'permanent',
                  code: 'container_not_publishable',
                  message:
                    'Threads could not prepare this post. Check the media and try again.',
                },
                detail,
              },
      };
    }

    try {
      const published = await this.client.publishContainer({
        threadsUserId,
        accessToken,
        containerId,
      });
      return { mediaId: published.mediaId, containerId };
    } catch (err) {
      // The 24/4279009 trap (and any ambiguous publish failure):
      // re-read the container status BEFORE any retry decision.
      if (isThreadsContainerNotFound(err) || classifyThreadsError(err).kind !== 'permanent') {
        const status = await this.pollOnce(containerId, accessToken);
        if (status === 'PUBLISHED') {
          return { mediaId: containerId, containerId };
        }
        if (status === 'FINISHED') {
          // Safe to publish exactly once more — the status read just
          // proved the container is ready and unpublished.
          try {
            const republished = await this.client.publishContainer({
              threadsUserId,
              accessToken,
              containerId,
            });
            return { mediaId: republished.mediaId, containerId };
          } catch (secondErr) {
            const secondStatus = await this.pollOnce(containerId, accessToken);
            if (secondStatus === 'PUBLISHED') {
              return { mediaId: containerId, containerId };
            }
            return {
              outcome: this.failureOutcome(secondErr, item, detail, liveLimit),
            };
          }
        }
      }
      return { outcome: this.failureOutcome(err, item, detail, liveLimit) };
    }
  }

  /** One status read; the raw status or null when unreadable. */
  private async pollOnce(
    containerId: string,
    accessToken: string
  ): Promise<string | null> {
    try {
      const status = await this.client.getContainerStatus({
        containerId,
        accessToken,
      });
      return status.status;
    } catch {
      return null;
    }
  }

  private async pollUntilFinished(
    containerId: string,
    accessToken: string
  ): Promise<'finished' | 'published' | 'retry' | 'failed'> {
    for (let attempt = 0; attempt < this.maxPolls; attempt++) {
      let status: string;
      try {
        const result = await this.client.getContainerStatus({
          containerId,
          accessToken,
        });
        status = result.status;
      } catch (err) {
        // Initial 404s are expected while the container propagates —
        // tolerate them and keep polling inside the same budget.
        const extracted = extractError(err);
        if (extracted.httpStatus === 404 || extracted.code === 24) {
          if (attempt < this.maxPolls - 1) {
            await this.sleep(this.pollIntervalMs);
            continue;
          }
          return 'retry';
        }
        const classified = classifyThreadsError(err);
        return classified.kind === 'permanent' ? 'failed' : 'retry';
      }
      if (status === 'FINISHED') return 'finished';
      if (status === 'PUBLISHED') return 'published';
      if (status === 'ERROR' || status === 'EXPIRED') return 'failed';
      if (attempt < this.maxPolls - 1) await this.sleep(this.pollIntervalMs);
    }
    return 'retry';
  }

  /**
   * D5 live-cap enforcement: when the platform-reported usage reaches
   * the resolved cap (the live total overrides the claim-side default
   * through the destination-override seam), the post defers for an hour
   * instead of publishing into a certain rejection. Best effort — an
   * unreadable quota (no usage reported) never blocks a publish.
   * Settles via the `deferred` outcome (spec 139): the deferral does
   * NOT consume retry budget — hitting the cap is not the post's fault.
   */
  private publishingLimitOutcome(liveLimit: {
    resolved: ReturnType<typeof resolvePublishLimit>;
    detail?: Record<string, unknown> | undefined;
  }): PublishOutcome | null {
    const maxCount = liveLimit.resolved?.publishedPosts?.maxCount;
    const usage = liveLimit.detail?.usage;
    if (maxCount === undefined || typeof usage !== 'number' || usage < maxCount) {
      return null;
    }
    return {
      status: 'deferred',
      error: {
        kind: 'retryable',
        code: 'publishing_limit_reached',
        message:
          'This Threads account has reached its publishing limit for now. The post will be tried again later.',
      },
      retryDelaySeconds: 3600,
      detail: {
        platform: 'threads',
        ...(liveLimit.detail ? { publishingLimit: liveLimit.detail } : {}),
      },
    };
  }

  private failureOutcome(
    err: unknown,
    item: DatabaseUnifiedQueueItemRow,
    detail: Record<string, unknown> | undefined,
    liveLimit?: {
      resolved: ReturnType<typeof resolvePublishLimit>;
      detail?: Record<string, unknown> | undefined;
    }
  ): PublishOutcome {
    const classified = classifyThreadsError(err);
    const canRetry =
      classified.kind === 'retryable' && item.retry_count < (item.max_retries ?? 3);
    const delay = classified.retryDelaySeconds ?? retryDelay(item.retry_count);
    return {
      status: canRetry ? 'retry' : 'failed',
      error: classified,
      ...(canRetry ? { retryDelaySeconds: delay } : {}),
      ...(classified.kind === 'auth'
        ? { targetAccountStatus: 'expired' as const }
        : {}),
      detail: {
        ...(detail ?? { platform: 'threads' }),
        ...(liveLimit?.detail ? { publishingLimit: liveLimit.detail } : {}),
      },
    };
  }
}
