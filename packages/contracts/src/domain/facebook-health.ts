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
 * - Error 190 / 102 (with subcodes 458, 459, 460, 463, 464, 467, 483, 492 or general): maps to expired / invalid_token, requiring re-auth.
 * - Error 368 (Temporarily blocked for policies violations): maps pageStatus exclusively to 'fb_rate_limited'.
 * - Error 4, 17, 32, 341, 613, 80000-80014 (API call volume rate limits): keeps accountStatus and pageStatus 'active' with isTransient: true.
 */
export function evaluateGraphApiError(
  code: number,
  errorSubcode?: number
): GraphApiErrorEvaluation | null {
  if (code === 190 || code === 102) {
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
    if (errorSubcode === 492) {
      return {
        accountStatus: 'active',
        pageStatus: 'invalid_token',
        isTransient: false,
        requiresReauth: true,
        message: 'User associated with the Page access token does not have an appropriate role on the Page.',
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

  // Error 368: Page is temporarily blocked/restricted by Facebook for policy violations.
  // 'fb_rate_limited' on facebook_pages.status is reserved exclusively for code 368.
  if (code === 368) {
    return {
      accountStatus: 'active',
      pageStatus: 'fb_rate_limited',
      isTransient: true,
      requiresReauth: false,
      message:
        'Page is temporarily blocked by Facebook for policy violations (Error 368).',
    };
  }

  // API request volume rate limit codes: 4 (app), 17 (user), 32 (page), 341 (app limit), 613 (custom), 80000-80014 (BUC)
  if (
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 341 ||
    code === 613 ||
    (code >= 80000 && code <= 80014)
  ) {
    return {
      accountStatus: 'active',
      pageStatus: 'active',
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
