import type { Platform } from '../domain/database.js';

// ==========================================
// Token-refresh thresholds (spec 121 Scope.9, D6 DECIDED)
// ==========================================
//
// The token refresh job is the ONLY writer of rotated/refreshed tokens.
// It scans `social_accounts` for tokens near expiry and refreshes them
// through the platform publisher's `refreshTokens`, using the
// per-platform thresholds below. Consumers and the claimer never refresh
// (an auth error at publish time settles as `expired`, it never triggers
// a refresh-and-retry).

export type TokenRefreshStrategy =
  /** Long-lived token refreshed in place before expiry (Instagram, Threads). */
  | 'long-lived'
  /** Refresh token rotates on every use and is single-use (X). */
  | 'rotating'
  /** No refresh grant exists; the job detects lapse and the account goes `expired` (Facebook). */
  | 'lapse-detection'
  /** The provider holds the tokens; we never refresh (YouTube/TikTok via Post for Me). */
  | 'provider-managed';

export interface PlatformTokenRefreshConfig {
  strategy: TokenRefreshStrategy;
  /**
   * Refresh when the access token expires within this many seconds.
   * `null` when no threshold applies (provider-managed).
   */
  refreshWhenExpiringWithinSeconds: number | null;
  /**
   * Minimum token age before a refresh is allowed, in seconds
   * (Instagram/Threads: the token must be at least 24 h old). `null`
   * when the platform has no minimum-age rule.
   */
  minimumTokenAgeSeconds: number | null;
  /**
   * True when refresh is only possible while the token is still
   * unexpired (Instagram/Threads: an expired token is unrecoverable
   * and the account must re-authenticate instead).
   */
  requiresUnexpiredToken: boolean;
  /** Typical access-token lifetime in seconds, when the platform fixes one (X: ~2 h). */
  accessTokenLifetimeSeconds: number | null;
  /** True when each refresh spends the refresh token and issues a new one (X). */
  rotatingRefreshToken: boolean;
}

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

/** Refresh a 60-day long-lived token once it is within 7 days of expiry. */
export const LONG_LIVED_TOKEN_REFRESH_THRESHOLD_SECONDS = 7 * SECONDS_PER_DAY;

/** Instagram/Threads refresh requires the token to be at least 24 h old. */
export const META_LONG_LIVED_MINIMUM_TOKEN_AGE_SECONDS = SECONDS_PER_DAY;

/** Instagram/Threads long-lived token lifetime: 60 days. */
export const META_LONG_LIVED_TOKEN_LIFETIME_SECONDS = 60 * SECONDS_PER_DAY;

/** X access-token lifetime: ~2 hours. */
export const X_ACCESS_TOKEN_LIFETIME_SECONDS = 2 * SECONDS_PER_HOUR;

/** Refresh an X access token once it is within 30 minutes of expiry. */
export const X_TOKEN_REFRESH_THRESHOLD_SECONDS = 30 * 60;

/** Facebook user-token lapse is checked once the token is within 7 days of expiry. */
export const FACEBOOK_TOKEN_LAPSE_CHECK_THRESHOLD_SECONDS = 7 * SECONDS_PER_DAY;

export const PLATFORM_TOKEN_REFRESH_CONFIG: Record<Platform, PlatformTokenRefreshConfig> = {
  facebook: {
    // Page tokens are durable and ride on the user token staying valid;
    // there is no refresh grant to spend — the job watches for lapse
    // (expiry within the threshold, or already lapsed) so the account
    // can be marked `expired` for re-authentication.
    strategy: 'lapse-detection',
    refreshWhenExpiringWithinSeconds: FACEBOOK_TOKEN_LAPSE_CHECK_THRESHOLD_SECONDS,
    minimumTokenAgeSeconds: null,
    requiresUnexpiredToken: false,
    accessTokenLifetimeSeconds: null,
    rotatingRefreshToken: false,
  },
  instagram: {
    strategy: 'long-lived',
    refreshWhenExpiringWithinSeconds: LONG_LIVED_TOKEN_REFRESH_THRESHOLD_SECONDS,
    minimumTokenAgeSeconds: META_LONG_LIVED_MINIMUM_TOKEN_AGE_SECONDS,
    requiresUnexpiredToken: true,
    accessTokenLifetimeSeconds: META_LONG_LIVED_TOKEN_LIFETIME_SECONDS,
    rotatingRefreshToken: false,
  },
  threads: {
    strategy: 'long-lived',
    refreshWhenExpiringWithinSeconds: LONG_LIVED_TOKEN_REFRESH_THRESHOLD_SECONDS,
    minimumTokenAgeSeconds: META_LONG_LIVED_MINIMUM_TOKEN_AGE_SECONDS,
    requiresUnexpiredToken: true,
    accessTokenLifetimeSeconds: META_LONG_LIVED_TOKEN_LIFETIME_SECONDS,
    rotatingRefreshToken: false,
  },
  x: {
    strategy: 'rotating',
    refreshWhenExpiringWithinSeconds: X_TOKEN_REFRESH_THRESHOLD_SECONDS,
    minimumTokenAgeSeconds: null,
    requiresUnexpiredToken: false,
    accessTokenLifetimeSeconds: X_ACCESS_TOKEN_LIFETIME_SECONDS,
    rotatingRefreshToken: true,
  },
  youtube: {
    strategy: 'provider-managed',
    refreshWhenExpiringWithinSeconds: null,
    minimumTokenAgeSeconds: null,
    requiresUnexpiredToken: false,
    accessTokenLifetimeSeconds: null,
    rotatingRefreshToken: false,
  },
  tiktok: {
    strategy: 'provider-managed',
    refreshWhenExpiringWithinSeconds: null,
    minimumTokenAgeSeconds: null,
    requiresUnexpiredToken: false,
    accessTokenLifetimeSeconds: null,
    rotatingRefreshToken: false,
  },
};

export function getTokenRefreshConfig(platform: Platform): PlatformTokenRefreshConfig {
  return PLATFORM_TOKEN_REFRESH_CONFIG[platform];
}

export interface TokenRefreshSnapshot {
  /** Access-token expiry (`social_accounts.token_expires_at`); null when the platform reports none. */
  tokenExpiresAt?: string | Date | null | undefined;
  /** When the current access token was issued, when known — feeds the minimum-age rule. */
  tokenIssuedAt?: string | Date | null | undefined;
}

/**
 * Whether the refresh job should act on this token now:
 *   - provider-managed platforms: never;
 *   - no recorded expiry: never (nothing to schedule against — Facebook
 *     Page tokens without an expiry are durable);
 *   - minimum-age rule unmet (token younger than the platform allows):
 *     not yet;
 *   - already expired: due only when the platform can still refresh an
 *     expired access token (X's refresh token outlives it; Facebook
 *     lapse detection must still fire). Instagram/Threads return false —
 *     an expired long-lived token is unrecoverable, re-auth instead;
 *   - otherwise: due once expiry is within the platform threshold.
 */
export function isTokenRefreshDue(
  platform: Platform,
  snapshot: TokenRefreshSnapshot,
  now: Date = new Date()
): boolean {
  const config = PLATFORM_TOKEN_REFRESH_CONFIG[platform];

  if (config.strategy === 'provider-managed') {
    return false;
  }
  if (config.refreshWhenExpiringWithinSeconds === null) {
    return false;
  }
  if (!snapshot.tokenExpiresAt) {
    return false;
  }

  const expiresAtMs = new Date(snapshot.tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) {
    return false;
  }

  if (snapshot.tokenIssuedAt && config.minimumTokenAgeSeconds !== null) {
    const issuedAtMs = new Date(snapshot.tokenIssuedAt).getTime();
    if (!Number.isNaN(issuedAtMs)) {
      const ageSeconds = (now.getTime() - issuedAtMs) / 1000;
      if (ageSeconds < config.minimumTokenAgeSeconds) {
        return false;
      }
    }
  }

  const secondsUntilExpiry = (expiresAtMs - now.getTime()) / 1000;
  if (secondsUntilExpiry <= 0) {
    return !config.requiresUnexpiredToken;
  }
  return secondsUntilExpiry <= config.refreshWhenExpiringWithinSeconds;
}
