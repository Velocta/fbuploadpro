import {
  parseTikTokOptions,
  validateTikTokPostFields,
  type ClassifiedPublishError,
  type DatabaseDestinationRow,
  type DatabaseSocialAccountRow,
  type DatabaseUnifiedQueueItemRow,
  type Platform,
  type Publisher,
  type PublisherTokenSet,
  type PublishOutcome,
  type RefreshedTokenSet,
  type TikTokOptions,
  type TikTokPrivacy,
} from '@fbuploadpro/contracts';
import { PostForMeError, POST_FOR_ME_PROVIDER_NAME } from '../providers/post-for-me.js';
import type {
  IPostForMeTikTokClient,
  PostForMePostResult,
} from '../providers/post-for-me-tiktok.js';

// ==========================================
// TikTok publisher (spec 126 — via Post for Me, D1)
// ==========================================
//
// TikTok is provider-managed end to end: Post for Me holds the
// audited TikTok app and the creator tokens. This module contains
// NO TikTok credential, token, OAuth, or refresh code of any kind,
// and `refreshTokens` returns the supplied tokens unchanged (the
// contracts refresh config marks TikTok provider-managed).
//
// Settlement discipline (spec 126 — STRICTER than YouTube's, on
// purpose):
//   - An item settles `published` ONLY when the provider confirms a
//     public post: a successful per-account post result whose
//     read-back does not contradict the request. A bare create
//     response is never enough on its own.
//   - A provider-reported DRAFT / INBOX outcome (TikTok's
//     SEND_TO_USER_INBOX) is a FAILURE state with its own code —
//     never `published`. (The provider's own posting code treats it
//     the same way: "TikTok publication could not be confirmed".)
//   - The APPLIED privacy is read back from the result when the
//     provider reports it: TikTok silently falls back to SELF_ONLY
//     when the creator's own settings don't allow the requested
//     level, so a "successful" result whose applied privacy differs
//     from the requested one FAILS plainly (`privacy_not_honoured`)
//     instead of settling `published` on a video nobody can see.
//   - Every outcome carries `detail: { provider: 'post-for-me', ... }`
//     with the provider post/result refs, persisted into
//     publish_logs.detail by the settle RPC's p_detail carrier.
//   - Duplicate safety: before submitting — and again after any
//     ambiguous create failure (e.g. a timeout where the provider
//     may have accepted the post) — the publisher checks provider
//     state for an existing result for this account + caption and
//     settles from it instead of resubmitting.
//   - `is_draft` is always sent as an explicit false: drafts are
//     out of scope for v1 (see contracts tiktok-options).
//
// Per-account limit (D5): Post for Me publishes NO per-account
// TikTok posting cap, and the audited distinct-creator cap on its
// managed app is a SHARED pool across all workspaces — recorded at
// the contracts claim config (limits.ts, TikTok section), never as
// a per-account window. The contracts `tiktok: {}` limit entry
// therefore stays empty (no invented number).

export const TIKTOK_PLATFORM: Platform = 'tiktok';

const RETRY_BASE_DELAY_SECONDS = 300;
const RETRY_MAX_DELAY_SECONDS = 3600;
const UNCONFIRMED_RETRY_DELAY_SECONDS = 60;

export interface TikTokPublisherOptions {
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/** The TikTok post id a successful result confirms, best documented field first. */
function postIdFromResult(result: PostForMePostResult): string {
  return (
    stringField(result.platform_data, [
      'platform_post_id',
      'tiktok_post_id',
      'post_id',
      'video_id',
    ]) ?? result.post_id
  );
}

function postUrlFromResult(result: PostForMePostResult): string | null {
  return stringField(result.platform_data, ['post_url', 'share_url', 'url', 'permalink']);
}

/**
 * Normalises an applied-privacy value from a provider result into
 * the contracts vocabulary. The provider may echo its own values
 * (public/private/followers/friends) or TikTok's
 * (PUBLIC_TO_EVERYONE / SELF_ONLY / …) depending on the surface;
 * both are accepted. Returns null when the result reports nothing
 * recognisable — an unreported privacy cannot disprove the request.
 */
const APPLIED_PRIVACY_ALIASES: Record<string, TikTokPrivacy> = {
  public: 'public',
  PUBLIC_TO_EVERYONE: 'public',
  followers: 'followers',
  FOLLOWER_OF_CREATOR: 'followers',
  friends: 'friends',
  MUTUAL_FOLLOW_FRIENDS: 'friends',
  private: 'private',
  SELF_ONLY: 'private',
};

function appliedPrivacyFromResult(result: PostForMePostResult): TikTokPrivacy | null {
  const raw = stringField(result.platform_data, [
    'privacy_status',
    'privacy_level',
    'privacy',
  ]);
  if (!raw) return null;
  return APPLIED_PRIVACY_ALIASES[raw] ?? null;
}

const DRAFT_STATUS_VALUES: ReadonlySet<string> = new Set([
  'SEND_TO_USER_INBOX',
  'send_to_user_inbox',
  'DRAFT',
  'draft',
  'INBOX',
  'inbox',
]);

/**
 * Whether a provider result reports a draft/inbox landing instead of
 * a public post. Reads the structured fields the provider is known
 * to carry (platform_data + details); free-text errors are not
 * pattern-matched.
 */
function isDraftOutcome(result: PostForMePostResult): boolean {
  for (const record of [result.platform_data, asRecord(result.details)]) {
    if (!record) continue;
    if (record.is_draft === true || record.draft === true) return true;
    const status = stringField(record, ['status', 'post_status', 'display_status']);
    if (status && DRAFT_STATUS_VALUES.has(status)) return true;
  }
  return false;
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

/** Human-readable name for a privacy level, for plain-language errors. */
const PRIVACY_LABELS: Record<TikTokPrivacy, string> = {
  public: 'public',
  followers: 'followers-only',
  friends: 'friends-only',
  private: 'private',
};

export class TikTokPublisher implements Publisher {
  readonly platform: Platform = TIKTOK_PLATFORM;
  private readonly client: IPostForMeTikTokClient;
  private readonly pollAttempts: number;
  private readonly pollDelayMs: number;

  constructor(client: IPostForMeTikTokClient, options: TikTokPublisherOptions = {}) {
    this.client = client;
    this.pollAttempts = options.pollAttempts ?? 3;
    this.pollDelayMs = options.pollDelayMs ?? 250;
  }

  /**
   * Classifies any error thrown by the provider client. Pure and
   * total: never throws. 401/403 are auth (the provider key or the
   * creator connection is gone — the account cascades to expired via
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
            'This TikTok account is missing its provider connection reference. Reconnect the account from Accounts.',
        },
        detail,
      };
    }
    detail.providerAccountId = providerAccountId;

    const parsed = parseTikTokOptions(item.platform_options ?? {});
    if (!parsed.ok) {
      return {
        status: 'failed',
        error: {
          kind: 'permanent',
          code: 'invalid_platform_options',
          message: parsed.error,
        },
        detail,
      };
    }
    const options: TikTokOptions = parsed.options;

    const caption = item.caption ?? '';
    const fieldProblem = validateTikTokPostFields({ caption });
    if (fieldProblem) {
      return {
        status: 'failed',
        error: { kind: 'permanent', code: 'invalid_post_fields', message: fieldProblem },
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
          message: 'Media is required for TikTok publishing',
        },
        detail,
      };
    }

    detail.requestedPrivacy = options.privacy;

    // Duplicate safety, part 1: a previous attempt (or a create that
    // timed out after the provider accepted it) may already have
    // produced a result for this post. Settle from it — through the
    // same TikTok verification — instead of resubmitting.
    const existing = await this.findExistingResult(providerAccountId, item);
    if (existing) {
      return this.evaluateResult(existing, options, detail);
    }

    const title = (item.title ?? '').trim();
    let postId: string;
    try {
      const post = await this.client.createPost({
        socialAccountId: providerAccountId,
        caption,
        media: [{ url: mediaUrl }],
        tiktok: {
          ...(title ? { title } : {}),
          privacy_status: options.privacy,
          // Only the toggles the user actually picked are sent —
          // omitted means the provider/TikTok default applies.
          ...(options.allowComment !== undefined
            ? { allow_comment: options.allowComment }
            : {}),
          ...(options.allowDuet !== undefined
            ? { allow_duet: options.allowDuet }
            : {}),
          ...(options.allowStitch !== undefined
            ? { allow_stitch: options.allowStitch }
            : {}),
          ...(options.isAiGenerated !== undefined
            ? { is_ai_generated: options.isAiGenerated }
            : {}),
          // Photo posts only (contracts): never sent for video.
          ...(options.autoAddMusic !== undefined && item.kind !== 'video'
            ? { auto_add_music: options.autoAddMusic }
            : {}),
          // Always an explicit false — never omitted, never true.
          is_draft: false,
        },
      });
      postId = post.id;
    } catch (err) {
      // Duplicate safety, part 2: an ambiguous failure (timeout /
      // transport) may hide an accepted post. Check before failing.
      if (!(err instanceof PostForMeError)) {
        const landed = await this.findExistingResult(providerAccountId, item);
        if (landed) {
          return this.evaluateResult(landed, options, detail);
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
        if (mine.success) {
          return this.evaluateResult(mine, options, detail);
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
        message: 'The provider accepted the post but has not confirmed it yet.',
      },
      retryDelaySeconds: UNCONFIRMED_RETRY_DELAY_SECONDS,
      detail,
    };
  }

  /**
   * Finds an existing successful provider result for this account +
   * post, if one exists. The match key is the post's caption (or its
   * title when one is set) as echoed in the result's platform_data —
   * ASSUMPTION (live-verification-pending), mirroring spec 125's
   * title match. A result that reports a draft outcome or a
   * different applied privacy still counts as "existing": it is
   * settled through evaluateResult, never resubmitted.
   */
  private async findExistingResult(
    providerAccountId: string,
    item: DatabaseUnifiedQueueItemRow
  ): Promise<PostForMePostResult | null> {
    let results: PostForMePostResult[];
    try {
      results = await this.client.listPostResults({
        socialAccountId: providerAccountId,
      });
    } catch {
      return null;
    }
    const matchKey = (item.title ?? '').trim() || (item.caption ?? '').trim();
    if (!matchKey) return null;
    return (
      results.find(
        (result) =>
          result.success &&
          result.social_account_id === providerAccountId &&
          stringField(result.platform_data, ['title', 'caption']) === matchKey
      ) ?? null
    );
  }

  /**
   * The TikTok settlement gate for one provider-confirmed result.
   * A result only becomes `published` when it is a genuine public
   * post: no draft/inbox marker, and no reported applied privacy
   * that contradicts the request.
   */
  private evaluateResult(
    result: PostForMePostResult,
    options: TikTokOptions,
    detail: Record<string, unknown>
  ): PublishOutcome {
    detail.providerPostId = result.post_id;
    detail.providerResultId = result.id;

    if (isDraftOutcome(result)) {
      return {
        status: 'failed',
        error: {
          kind: 'permanent',
          code: 'provider_draft_outcome',
          message:
            'TikTok saved this as a draft in the app instead of publishing it, so it is not live. It has been marked as failed rather than published.',
        },
        detail,
      };
    }

    const appliedPrivacy = appliedPrivacyFromResult(result);
    detail.appliedPrivacy = appliedPrivacy;
    if (appliedPrivacy !== null && appliedPrivacy !== options.privacy) {
      return {
        status: 'failed',
        error: {
          kind: 'permanent',
          code: 'privacy_not_honoured',
          message: `This post was set to be ${PRIVACY_LABELS[options.privacy]}, but TikTok published it as ${PRIVACY_LABELS[appliedPrivacy]} — TikTok only allows the visibility levels your account settings permit. Check who can watch your videos in TikTok's privacy settings, then try again.`,
        },
        detail,
      };
    }

    const postUrl = postUrlFromResult(result);
    if (postUrl) detail.postUrl = postUrl;
    return {
      status: 'published',
      externalPostId: postIdFromResult(result),
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
