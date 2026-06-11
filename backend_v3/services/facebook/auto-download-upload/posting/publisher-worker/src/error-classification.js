/** Classify Meta / network publish errors for handled vs unhandled routing. */

const RATE_LIMIT_COOLDOWN_DAYS = 3;

export function rateLimitUntilIso() {
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + RATE_LIMIT_COOLDOWN_DAYS);
  return until.toISOString();
}

export function isTransientNetworkError(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('network connection lost') ||
    m.includes('connection reset') ||
    m.includes('econnreset') ||
    m.includes('etimedout') ||
    m.includes('fetch failed') ||
    m.includes('socket hang up') ||
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('connection closed') ||
    m.includes('timed out')
  );
}

/** Spam throttle 368 — "we limit how often you can post" (E1.1). */
export function isFacebookSpamRateLimit368(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('we limit how often you can post')) return true;
  if (!m.includes('368')) return false;
  return !isFacebookSecurity368(message) && !isFacebookTemporarilyBlocked(message);
}

/** Short-term Meta block (E1.4) — distinct from spam-throttle copy. */
export function isFacebookTemporarilyBlocked(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('we limit how often you can post')) return false;
  return (
    m.includes('temporarily blocked') ||
    m.includes('temporarily restricted') ||
    m.includes('you are temporarily blocked')
  );
}

/** Account security / policy 368 — not spam throttle (E1.3). */
export function isFacebookSecurity368(message) {
  const m = String(message || '').toLowerCase();
  if (!m.includes('368')) return false;
  if (m.includes('we limit how often you can post')) return false;
  return (
    m.includes('security') ||
    m.includes('checkpoint') ||
    m.includes('confirm your identity') ||
    m.includes('identity before you can publish') ||
    m.includes('account is restricted') ||
    m.includes('restricted from publishing') ||
    m.includes('developer app') ||
    m.includes('suspended')
  );
}

export function resolveSecurity368PageStatus(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('developer app') || m.includes('app is restricted')) {
    return 'check_developer_app';
  }
  if (m.includes('suspended') || m.includes('disabled')) {
    return 'account_suspended';
  }
  return 'fb_verification_required';
}

/** Identity / phone verification required (E1.8, E1.13). */
export function isFacebookVerificationRequired(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('your identity before you can publish') ||
    m.includes('confirm your identity') ||
    m.includes('user must re-login') ||
    m.includes('must re-login to fb') ||
    m.includes('phone number') ||
    m.includes('verify your account') ||
    m.includes('verification required') ||
    m.includes('identity verification')
  );
}

/** OAuth 190 / missing page permissions — invalid_token (E1.10–E1.14). */
export function isFacebookInvalidTokenError(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('your identity before you can publish')) return false;
  if (m.includes('confirm your identity')) return false;
  if (m.includes('user must re-login')) return false;

  const missingPagePermissions =
    m.includes('pages_read_engagement') ||
    m.includes('pages_manage_metadata') ||
    m.includes('pages_read_user_content') ||
    m.includes('pages_manage_ads') ||
    m.includes('pages_show_list') ||
    m.includes('pages_messaging') ||
    m.includes('must be granted before impersonating');
  if (missingPagePermissions) return true;

  return (
    (m.includes('"code":190') || m.includes('"code": 190')) &&
    (m.includes('oauthexception') ||
      m.includes('error validating access token') ||
      m.includes('session has expired') ||
      m.includes('session has been invalidated') ||
      m.includes('invalid oauth') ||
      m.includes('token is invalid'))
  );
}

/** Page removed or user lost admin (E1.9, E1.17). */
export function isFacebookPageNotAccessible(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('page not found') ||
    m.includes('does not exist') ||
    m.includes('cannot publish to this page') ||
    m.includes('not an admin') ||
    m.includes('does not have permission to post') ||
    m.includes('user does not have sufficient administrative permission') ||
    m.includes('page access token') && m.includes('not accessible') ||
    m.includes('unsupported post request') && m.includes('page')
  );
}

export function isFacebookRobotsTxtBlocked(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('robots.txt') ||
    m.includes('restricted by robots') ||
    m.includes('fileurlprocessingerror')
  );
}

export function parseFacebookError(message) {
  const m = String(message || '');
  const jsonStart = m.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const jsonStr = m.substring(jsonStart);
      const data = JSON.parse(jsonStr);
      const fbErr = data?.error;
      if (fbErr) {
        const parts = [];
        if (fbErr.error_user_title) {
          parts.push(fbErr.error_user_title);
        }
        if (fbErr.error_user_msg) {
          parts.push(fbErr.error_user_msg);
        }
        if (fbErr.message) {
          parts.push(fbErr.message);
        }
        if (parts.length > 0) {
          const detailedMsg = parts.join(' - ');
          const prefix = m.substring(0, jsonStart).trim();
          return `${prefix}: ${detailedMsg}`;
        }
      }
    } catch (e) {
      // Ignore JSON parse error and fallback
    }
  }
  return m;
}

