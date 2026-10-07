import type { FacebookAccountStatus, FacebookPageStatus } from './facebook.js';

export interface GraphApiErrorEvaluation {
  accountStatus: FacebookAccountStatus;
  pageStatus: FacebookPageStatus;
  isTransient: boolean;
  requiresReauth: boolean;
  message: string;
}

/**
 * Maps Facebook Graph API error codes and subcodes to internal domain health states.
 * - Error 190 (with subcodes 458, 460, 463 or general): maps to expired / invalid_token, requiring re-auth.
 * - Error 4, 17, 32, 613: maps to fb_rate_limited, transient.
 */
export function evaluateGraphApiError(
  code: number,
  errorSubcode?: number
): GraphApiErrorEvaluation | null {
  if (code === 190) {
    if (errorSubcode === 458) {
      return {
        accountStatus: 'expired',
        pageStatus: 'invalid_token',
        isTransient: false,
        requiresReauth: true,
        message: 'Application authorization was revoked by the user.',
      };
    }
    if (errorSubcode === 460) {
      return {
        accountStatus: 'expired',
        pageStatus: 'invalid_token',
        isTransient: false,
        requiresReauth: true,
        message: 'User password changed or session was invalidated.',
      };
    }
    if (errorSubcode === 463) {
      return {
        accountStatus: 'expired',
        pageStatus: 'invalid_token',
        isTransient: false,
        requiresReauth: true,
        message: 'Access token has expired.',
      };
    }
    return {
      accountStatus: 'expired',
      pageStatus: 'invalid_token',
      isTransient: false,
      requiresReauth: true,
      message: 'Access token is invalid or revoked.',
    };
  }

  // Rate limit codes: 4 (app level), 17 (user level), 32 (page level), 613 (calls/sec)
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return {
      accountStatus: 'active',
      pageStatus: 'fb_rate_limited',
      isTransient: true,
      requiresReauth: false,
      message:
        'Facebook Graph API rate limit reached. Please back off temporarily.',
    };
  }

  return null;
}

export interface TokenExpiryEvaluation {
  isExpired: boolean;
  daysRemaining: number | null;
  status: FacebookAccountStatus;
}

/**
 * Evaluates token expiration horizons relative to current time.
 */
export function evaluateTokenExpiry(
  tokenExpiresAt: Date | string | null | undefined,
  now: Date = new Date()
): TokenExpiryEvaluation {
  if (!tokenExpiresAt) {
    return {
      isExpired: false,
      daysRemaining: null,
      status: 'active',
    };
  }

  const expiresDate = new Date(tokenExpiresAt);
  const diffMs = expiresDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isExpired: true,
      daysRemaining: 0,
      status: 'expired',
    };
  }

  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return {
    isExpired: false,
    daysRemaining,
    status: 'active',
  };
}

/**
 * Dynamically computes account health status taking token expiration into account.
 */
export function evaluateAccountHealth(
  account: {
    status: FacebookAccountStatus;
    tokenExpiresAt?: Date | string | null;
  },
  now: Date = new Date()
): FacebookAccountStatus {
  if (account.status === 'disconnected') {
    return 'disconnected';
  }

  if (account.tokenExpiresAt) {
    const expiry = evaluateTokenExpiry(account.tokenExpiresAt, now);
    if (expiry.isExpired) {
      return 'expired';
    }
  }

  return account.status;
}
