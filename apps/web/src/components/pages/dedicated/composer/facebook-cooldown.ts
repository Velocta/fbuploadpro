import { resolvePublishLimit } from '@fbuploadpro/contracts';

/**
 * D5 limit indicator for Facebook (spec 132 §6, OD132-3 DECIDED (a)).
 *
 * Facebook has NO centred platform cap: `PLATFORM_PUBLISH_LIMITS.facebook`
 * is `null` in `packages/contracts/src/publishing/limits.ts`, so there is
 * no usage window to draw and none is invented here. Throttling is
 * per-Page, via the destination cooldown the claim path also reads — on
 * the web that state reaches the composer through the existing page-read
 * endpoint only as the Page `status` (`fb_rate_limited`). The endpoint
 * returns no cooldown end time (no `next_allowed_publish_at` in the page
 * payload), so the indicator names the cooldown without a time — a time
 * is never invented (OD132-3 stop rule).
 */

export interface FacebookPageLimitSource {
  status?: string | null | undefined;
  rateLimitedAt?: string | null | undefined;
}

export interface FacebookCooldownState {
  /** True only when the Page is currently in its cooldown state. */
  inCooldown: boolean;
  /** Plain-language line to show, or null when there is nothing to show. */
  message: string | null;
}

export const FACEBOOK_COOLDOWN_MESSAGE =
  'This Page is in a short cooldown — new posts will go out once the cooldown ends.';

export function getFacebookCooldownState(
  page: FacebookPageLimitSource | null | undefined
): FacebookCooldownState {
  // Single-source guard: the Facebook config must stay windowless. If a
  // window is ever added to contracts, this indicator needs revisiting
  // rather than silently continuing to hide it.
  const facebookLimit = resolvePublishLimit('facebook');
  if (facebookLimit !== null) {
    return { inCooldown: false, message: null };
  }
  if (page?.status !== 'fb_rate_limited') {
    return { inCooldown: false, message: null };
  }
  return { inCooldown: true, message: FACEBOOK_COOLDOWN_MESSAGE };
}
