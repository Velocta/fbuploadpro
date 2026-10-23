import type { Platform } from '../domain/database.js';

// ==========================================
// Per-account posting limits (spec 121 Scope.8, D5 DECIDED)
// ==========================================
//
// Platform caps enforced in-product at claim time: the claim path counts
// recent publishes per destination and DEFERS items past the limit to
// the next window (rescheduled, never failed). All values live here —
// the one named config in contracts — so the claim RPC, the worker, and
// the composer/queue surfaces (spec 128) read the same numbers.
//
// A destination-level live value (e.g. Instagram's per-account quota
// read from the platform) overrides the default for that destination
// via `resolvePublishLimit` — no schema or code change needed when a
// platform reports a different cap for a specific account.
//
// Canonical source (A-1, ratified by Shahzeb 2026-10-22): this config is
// the canonical defaults for the D5 posting limits. The
// destination_claim_limits seed in supabase/migrations is the
// enforcement copy the claim RPC reads. The parity test at
// packages/contracts/tests/publishing/limits-parity.test.ts fails CI
// if the two drift.

/** One rolling-window cap: at most `maxCount` events per `windowSeconds`. */
export interface PublishLimitWindow {
  maxCount: number;
  windowSeconds: number;
}

export interface PlatformPublishLimitConfig {
  /** Cap on successfully published posts in the window. */
  publishedPosts?: PublishLimitWindow | undefined;
  /** Cap on publish API calls (attempts) in the window, when the platform meters them separately. */
  publishCalls?: PublishLimitWindow | undefined;
}

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

// --- Instagram (spec 124 refines with the live per-account quota read) ---

/** 100 published posts per rolling 24 h per account. */
export const INSTAGRAM_PUBLISHED_POSTS_LIMIT: PublishLimitWindow = {
  maxCount: 100,
  windowSeconds: SECONDS_PER_DAY,
};

/** ~25 publish calls per hour per account. */
export const INSTAGRAM_PUBLISH_CALLS_LIMIT: PublishLimitWindow = {
  maxCount: 25,
  windowSeconds: SECONDS_PER_HOUR,
};

// --- Threads ---

/** 250 posts per rolling 24 h per profile. */
export const THREADS_PUBLISHED_POSTS_LIMIT: PublishLimitWindow = {
  maxCount: 250,
  windowSeconds: SECONDS_PER_DAY,
};

// NOTE (spec 121 Scope.8): Threads replies have a separate 1,000 / 24 h
// bucket, but replies are not v1 claim traffic — deliberately not
// modelled here. Add a window only when reply publishing ships.

// --- X ---

/**
 * 100 posts per 15 min per user — the lower bound of the conflicting
 * official figures (100 vs 200 per 15 min), per spec 121 Scope.8.
 */
export const X_PUBLISHED_POSTS_LIMIT: PublishLimitWindow = {
  maxCount: 100,
  windowSeconds: 15 * 60,
};

/**
 * Default per-platform limits, keyed by platform.
 *
 *   - `null` (Facebook): no centred platform cap — per-destination
 *     throttling happens via `destinations.next_allowed_publish_at` /
 *     the `rate_limited` cooldown, not this config.
 *   - `{}` (YouTube/TikTok): provider-imposed effective limits, supplied
 *     by specs 125/126 once verified. The empty shape is the extension
 *     point — filling in a window later needs no schema change.
 */
export const PLATFORM_PUBLISH_LIMITS: Record<Platform, PlatformPublishLimitConfig | null> = {
  facebook: null,
  instagram: {
    publishedPosts: INSTAGRAM_PUBLISHED_POSTS_LIMIT,
    publishCalls: INSTAGRAM_PUBLISH_CALLS_LIMIT,
  },
  threads: {
    publishedPosts: THREADS_PUBLISHED_POSTS_LIMIT,
  },
  x: {
    publishedPosts: X_PUBLISHED_POSTS_LIMIT,
  },
  youtube: {},
  tiktok: {},
};

/**
 * A destination-level override of the platform defaults — e.g. the live
 * quota a platform reports for one specific account. Each window present
 * in the override replaces the default window wholesale; windows absent
 * from the override keep their defaults.
 */
export type PublishLimitOverride = PlatformPublishLimitConfig;

/**
 * Resolves the effective limit config for a platform, applying a
 * destination-level live override when one is supplied. Returns `null`
 * when the platform has no centred cap and no override supplies one.
 */
export function resolvePublishLimit(
  platform: Platform,
  destinationOverride?: PublishLimitOverride | null | undefined
): PlatformPublishLimitConfig | null {
  const defaults = PLATFORM_PUBLISH_LIMITS[platform];

  if (!destinationOverride) {
    return defaults;
  }

  const merged: PlatformPublishLimitConfig = {
    publishedPosts: destinationOverride.publishedPosts ?? defaults?.publishedPosts,
    publishCalls: destinationOverride.publishCalls ?? defaults?.publishCalls,
  };

  if (merged.publishedPosts === undefined && merged.publishCalls === undefined) {
    return defaults;
  }
  return merged;
}

/** Resolves one window (`publishedPosts` or `publishCalls`) with override applied; `null` when uncapped. */
export function resolvePublishLimitWindow(
  platform: Platform,
  window: keyof PlatformPublishLimitConfig,
  destinationOverride?: PublishLimitOverride | null | undefined
): PublishLimitWindow | null {
  const resolved = resolvePublishLimit(platform, destinationOverride);
  return resolved?.[window] ?? null;
}
