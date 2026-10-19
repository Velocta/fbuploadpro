import { STATUS_SIGNALS } from '@/lib/theme';

/**
 * Single account-health model for Facebook accounts (Spec 102).
 *
 * Every surface — Accounts tab cards, Pages list header/banner, page cards,
 * and the page Settings tab — reads connection health from here. No surface
 * may keep its own independent status string.
 *
 * The three states:
 * - 'connected' — the account's session is usable for publishing.
 * - 'expired' — the token/session expired; the user must reconnect.
 * - 'error' — the account is in a broken state that reconnecting may fix
 *   (e.g. disconnected upstream).
 */

export type AccountHealth = 'connected' | 'expired' | 'error';

export interface AccountHealthInput {
  status?: string | null | undefined;
  tokenExpiresAt?: string | Date | null | undefined;
}

type StatusSignalKey = keyof typeof STATUS_SIGNALS;

/**
 * Derives a Facebook account's health from its stored status and token
 * expiry. Explicit 'expired' status always wins; a past token expiry also
 * means expired. 'disconnected' (and any other non-active status) is an
 * error state. Everything else is connected.
 */
export function getAccountHealth(
  account: AccountHealthInput,
  now: Date = new Date()
): AccountHealth {
  if (account.status === 'expired') {
    return 'expired';
  }
  if (account.tokenExpiresAt) {
    const expiresAt = new Date(account.tokenExpiresAt).getTime();
    if (!Number.isNaN(expiresAt) && expiresAt <= now.getTime()) {
      return 'expired';
    }
  }
  if (account.status === 'disconnected') {
    return 'error';
  }
  return 'connected';
}

/**
 * True when the account is connected and its token expires within
 * `withinDays` days. Not a health state — only used for the "renew soon"
 * warning affordance (e.g. the yellow avatar ring and Refresh action).
 */
export function isTokenExpiringSoon(
  account: AccountHealthInput,
  now: Date = new Date(),
  withinDays = 7
): boolean {
  if (getAccountHealth(account, now) !== 'connected') {
    return false;
  }
  if (!account.tokenExpiresAt) {
    return false;
  }
  const expiresAt = new Date(account.tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) {
    return false;
  }
  const daysRemaining = Math.ceil(
    (expiresAt - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysRemaining > 0 && daysRemaining <= withinDays;
}

/**
 * The single user-facing status string per health state. Copy must match
 * everywhere it renders.
 */
export function getAccountHealthLabel(health: AccountHealth): string {
  switch (health) {
    case 'expired':
      return 'Session expired';
    case 'error':
      return 'Connection error';
    case 'connected':
    default:
      return 'Connected';
  }
}

/**
 * Theme signal for the health state — the single source for status dots,
 * avatar rings, and label colors.
 */
export function getAccountHealthSignal(health: AccountHealth): StatusSignalKey {
  switch (health) {
    case 'expired':
    case 'error':
      return 'critical';
    case 'connected':
    default:
      return 'operational';
  }
}
