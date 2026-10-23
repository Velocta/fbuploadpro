import {
  parseYouTubePlatformOptions,
  validateYouTubeUploadFields,
  type ClassifiedPublishError,
  type DatabaseDestinationRow,
  type DatabaseSocialAccountRow,
  type DatabaseUnifiedQueueItemRow,
  type Platform,
  type Publisher,
  type PublisherTokenSet,
  type PublishOutcome,
  type RefreshedTokenSet,
  type YouTubePlatformOptions,
} from '@fbuploadpro/contracts';
import { PostForMeError, POST_FOR_ME_PROVIDER_NAME } from '../providers/post-for-me.js';
import type {
  IPostForMeYouTubeClient,
  PostForMePostResult,
} from '../providers/post-for-me-youtube.js';

// ==========================================
// YouTube publisher (spec 125 — via Post for Me, D3)
// ==========================================
//
// YouTube is provider-managed: Post for Me holds the Google app and
// the channel tokens. This module contains NO Google credential,
// token, or refresh code of any kind, and `refreshTokens` returns
// the supplied tokens unchanged (provider-managed strategy in the
// contracts refresh config).
//
// Settlement discipline (spec 125):
//   - An item settles `published` ONLY when the provider confirms
//     the post exists — a successful per-account post result. A bare
//     create response is never enough on its own.
//   - Every outcome carries `detail: { provider: 'post-for-me', ... }`
//     with the provider post/result refs; the consumer threads it
//     into `publish_logs.detail` via the settle RPC's `p_detail`
//     (spec 139, PR #686).
//   - Duplicate safety: before submitting — and again after any
//     ambiguous create failure (e.g. a timeout where the provider
//     may have accepted the post) — the publisher checks provider
//     state for an already-successful result for this account +
//     title and settles from it instead of resubmitting.
//   - Privacy: the applied privacy is read back from the result's
//     platform_data when the provider exposes it; a mismatch with
//     the requested value settles published WITH a warning, never
//     silently. (ASSUMPTION / live-verification-pending: the docs
//     document only `title` in YouTube platform_data — see PR.)
//
// Per-account limit (D5): Post for Me's public docs state NO
// per-account YouTube upload limit — pricing is plan-level post
// volume, and the contracts `youtube: {}` limit entry therefore
// stays empty (no invented number). The plan-level guardrail is the
// provider plan's post volume; see the spec 125 PR record.

export const YOUTUBE_PLATFORM: Platform = 'youtube';

const RETRY_BASE_DELAY_SECONDS = 300;
const RETRY_MAX_DELAY_SECONDS = 3600;
const UNCONFIRMED_RETRY_DELAY_SECONDS = 60;

export interface YouTubePublisherOptions {
  /** Confirmation polls after a create that returned no result yet. */
  pollAttempts?: number;
  pollDelayMs?: number;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerAccountIdFrom(destination: DatabaseDestinationRow): string | null {
  const metadata = destination.metadata ?? {};
  const value =
    (typeof metadata.providerAccountId === 'string' && metadata.providerAccountId) ||
    (typeof metadata.provider_account_id === 'string' && metadata.provider_account_id) ||
    '';
  return value.length > 0 ? value : null;
}

function stringField(record: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/** The YouTube video id a successful result confirms, best documented field first. */
function videoIdFromResult(result: PostForMePostResult): string {
  return (
    stringField(result.platform_data, [
      'platform_post_id',
      'video_id',
      'youtube_video_id',
      'external_post_id',
    ]) ?? result.post_id
  );
}

function appliedPrivacyFromResult(
  result: PostForMePostResult
): string | null {
  return stringField(result.platform_data, ['privacy_status', 'privacyStatus', 'privacy']);
}

function errorMessageFromResultError(error: unknown): string {
  if (typeof error === 'string' && error.length > 0) return error;
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    try {
      return JSON.stringify(error);
    } catch {
      return 'Provider reported the post as failed';
    }
  }
  return 'Provider reported the post as failed';
}

export class YouTubePublisher implements Publisher {
  readonly platform: Platform = YOUTUBE_PLATFORM;
  private readonly client: IPostForMeYouTubeClient;
  private readonly pollAttempts: number;
  private readonly pollDelayMs: number;

  constructor(client: IPostForMeYouTubeClient, options: YouTubePublisherOptions = {}) {
    this.client = client;
    this.pollAttempts = options.pollAttempts ?? 3;
    this.pollDelayMs = options.pollDelayMs ?? 250;
  }

  /**
   * Classifies any error thrown by the provider client. Pure and
   * total: never throws. 401/403 are auth (the provider key or the
   * channel connection is gone — the account cascades to expired via
   * settlement); 429/5xx are retryable; other 4xx are permanent;
   * transport failures are retryable unknowns.
   */
  mapError(err: unknown): ClassifiedPublishError {
    if (err instanceof PostForMeError) {
      if (err.status === 401 || err.status === 403) {
        return {
          kind: 'auth',
          code: err.providerCode ?? `http_${err.status}`,
          message: err.providerMessage,
        };
      }
      if (err.status === 429 || err.status >= 500) {
        return {
          kind: 'retryable',
          code: err.providerCode ?? `http_${err.status}`,
          message: err.providerMessage,
        };
      }
      return {
        kind: 'permanent',
        code: err.providerCode ?? `http_${err.status}`,
        message: err.providerMessage,
      };
    }
    return {
      kind: 'retryable',
      code: 'unknown',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  /**
   * Provider-managed: Post for Me owns token refresh. The refresh
   * job's provider-managed strategy never calls this; the correct
   * implementation returns the supplied tokens unchanged.
   */
  refreshTokens(
    _account: DatabaseSocialAccountRow,
    tokens: PublisherTokenSet
  ): Promise<RefreshedTokenSet> {
    return Promise.resolve({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.tokenExpiresAt ?? null,
    });
  }

  async publish(
    item: DatabaseUnifiedQueueItemRow,
    destination: DatabaseDestinationRow,
    _tokens: PublisherTokenSet
  ): Promise<PublishOutcome> {
    const detail: Record<string, unknown> = { provider: POST_FOR_ME_PROVIDER_NAME };

    const providerAccountId = providerAccountIdFrom(destination);
    if (!providerAccountId) {
      return {
        status: 'failed',
        error: {
          kind: 'permanent',
          code: 'missing_provider_account',
          message:
            'This channel is missing its provider connection reference. Reconnect the channel from Accounts.',
        },
        detail,
      };
    }
    detail.providerAccountId = providerAccountId;

    let options: YouTubePlatformOptions;
    try {
      options = parseYouTubePlatformOptions(item.platform_options ?? {});
    } catch (err) {
      return {
        status: 'failed',
        error: {
          kind: 'permanent',
          code: 'invalid_platform_options',
          message: err instanceof Error ? err.message : 'Invalid YouTube options',
        },
        detail,
      };
    }

    const title = (item.title ?? '').trim() || (item.caption ?? '').trim().slice(0, 100);
    const fieldProblem = validateYouTubeUploadFields({
      title,
      description: item.caption ?? '',
    });
    if (fieldProblem) {
      return {
        status: 'failed',
        error: { kind: 'permanent', code: 'invalid_upload_fields', message: fieldProblem },
        detail,
      };
    }
    if (!title) {
      return {
        status: 'failed',
        error: {
          kind: 'permanent',
          code: 'invalid_upload_fields',
          message: 'A title is required for a YouTube video',
        },
        detail,
      };
    }

    const mediaUrl = item.media_url ?? '';
    if (!mediaUrl) {
      return {
        status: 'failed',
        error: {
          kind: 'permanent',
          code: 'missing_media_url',
          message: 'Media URL is required for YouTube publishing',
        },
        detail,
      };
    }

    detail.requestedPrivacy = options.privacy;

    // Duplicate safety, part 1: a previous attempt (or a create that
    // timed out after the provider accepted it) may already have
    // produced this post. Check provider state before submitting.
    const existing = await this.findConfirmedResult(providerAccountId, title);
    if (existing) {
      return this.publishedOutcome(existing, options, detail);
    }

    let postId: string;
    try {
      const post = await this.client.createPost({
        socialAccountId: providerAccountId,
        caption: item.caption ?? '',
        media: [{ url: mediaUrl }],
        youtube: {
          title,
          description: item.caption ?? '',
          tags: options.tags ?? [],
          ...(options.categoryId ? { category_id: options.categoryId } : {}),
          privacy_status: options.privacy,
          // Always an explicit boolean — never omitted (spec 125).
          made_for_kids: options.madeForKids,
        },
      });
      postId = post.id;
    } catch (err) {
      // Duplicate safety, part 2: an ambiguous failure (timeout /
      // transport) may hide an accepted post. Check before failing.
      if (!(err instanceof PostForMeError)) {
        const landed = await this.findConfirmedResult(providerAccountId, title);
        if (landed) {
          return this.publishedOutcome(landed, options, detail);
        }
      }
      return this.failureOutcome(err, item, detail);
    }

    detail.providerPostId = postId;

    // Settlement only on provider confirmation: poll the per-account
    // results for this post until one lands or the budget runs out.
    for (let attempt = 0; attempt < this.pollAttempts; attempt += 1) {
      if (attempt > 0) await sleepMs(this.pollDelayMs);
      let results: PostForMePostResult[];
      try {
        results = await this.client.listPostResults({ postId });
      } catch (err) {
        return this.failureOutcome(err, item, detail);
      }
      const mine = results.find(
        (result) => result.social_account_id === providerAccountId
      );
      if (mine) {
        detail.providerResultId = mine.id;
        if (mine.success) {
          return this.publishedOutcome(mine, options, detail);
        }
        return {
          status: 'failed',
          error: {
            kind: 'permanent',
            code: 'provider_post_failed',
            message: errorMessageFromResultError(mine.error),
          },
          detail,
        };
      }
    }

    // The provider accepted the post but has not confirmed it yet:
    // retry (the pre-submit state check above makes the next attempt
    // settle from the result instead of creating a duplicate).
    return {
      status: 'retry',
      error: {
        kind: 'retryable',
        code: 'provider_confirmation_pending',
        message: 'The provider accepted the video but has not confirmed it yet.',
      },
      retryDelaySeconds: UNCONFIRMED_RETRY_DELAY_SECONDS,
      detail,
    };
  }

  /** Finds an already-successful result for this account + title, if one exists. */
  private async findConfirmedResult(
    providerAccountId: string,
    title: string
  ): Promise<PostForMePostResult | null> {
    let results: PostForMePostResult[];
    try {
      results = await this.client.listPostResults({
        socialAccountId: providerAccountId,
      });
    } catch {
      return null;
    }
    return (
      results.find(
        (result) =>
          result.success &&
          result.social_account_id === providerAccountId &&
          stringField(result.platform_data, ['title']) === title
      ) ?? null
    );
  }

  private publishedOutcome(
    result: PostForMePostResult,
    options: YouTubePlatformOptions,
    detail: Record<string, unknown>
  ): PublishOutcome {
    const appliedPrivacy = appliedPrivacyFromResult(result);
    detail.providerPostId = result.post_id;
    detail.providerResultId = result.id;
    detail.appliedPrivacy = appliedPrivacy;
    const mismatch =
      appliedPrivacy !== null && appliedPrivacy !== options.privacy;
    return {
      status: 'published',
      externalPostId: videoIdFromResult(result),
      ...(mismatch
        ? {
            commentWarning: `Published, but the video's visibility is ${appliedPrivacy} instead of the requested ${options.privacy}.`,
          }
        : {}),
      detail,
    };
  }

  private failureOutcome(
    err: unknown,
    item: DatabaseUnifiedQueueItemRow,
    detail: Record<string, unknown>
  ): PublishOutcome {
    const classified = this.mapError(err);
    const effectiveMaxRetries = item.max_retries ?? 3;
    const canRetry =
      classified.kind === 'retryable' && item.retry_count < effectiveMaxRetries;
    const retryDelaySeconds = canRetry
      ? Math.min(
          RETRY_MAX_DELAY_SECONDS,
          RETRY_BASE_DELAY_SECONDS * Math.pow(2, item.retry_count || 0)
        )
      : undefined;
    return {
      status: canRetry ? 'retry' : 'failed',
      error: classified,
      ...(retryDelaySeconds !== undefined ? { retryDelaySeconds } : {}),
      ...(classified.kind === 'auth'
        ? { targetAccountStatus: 'expired' as const }
        : {}),
      detail,
    };
  }
}
