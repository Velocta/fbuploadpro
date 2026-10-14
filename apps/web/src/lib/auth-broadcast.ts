/**
 * @file auth-broadcast.ts
 * @description Cross-tab authentication event broadcaster.
 * Synchronizes user login, logout, user-switch, and session changes across browser tabs
 * via BroadcastChannel('fbup_auth') and localStorage storage events (Spec 020/021/022).
 */

import { sanitizeAuthRedirectUrl } from './auth-redirect';

export type AuthBroadcastType = 'LOGIN' | 'LOGOUT' | 'USER_SWITCH' | 'SESSION_CHANGE';

export interface AuthBroadcastPayload {
  type: AuthBroadcastType;
  userId?: string | undefined;
  email?: string | undefined;
  timestamp: number;
}

export function broadcastAuthEvent(
  event:
    | { type: 'LOGOUT' }
    | { type: 'LOGIN'; userId?: string; email?: string }
    | { type: 'USER_SWITCH'; userId?: string; email?: string }
    | { type: 'SESSION_CHANGE'; userId?: string; email?: string }
): void {
  if (typeof window === 'undefined' && typeof BroadcastChannel === 'undefined' && typeof localStorage === 'undefined') {
    return;
  }

  const payload: AuthBroadcastPayload = {
    ...event,
    timestamp: Date.now(),
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('fbup_auth');
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // Ignore BroadcastChannel errors in unsupported environments
  }

  try {
    if (typeof localStorage !== 'undefined') {
      if (event.type === 'LOGOUT') {
        localStorage.setItem('fbup_logout_event', String(payload.timestamp));
        localStorage.removeItem('fbup_active_user');
      } else if (event.userId) {
        localStorage.setItem('fbup_active_user', event.userId);
      }
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Dispatches a cross-tab LOGIN broadcast and navigates the window to the sanitized post-auth destination.
 */
export function completeAuthRedirect(
  redirectUrl: string,
  user?: { id?: string; email?: string; subdomain?: string } | undefined
): void {
  broadcastAuthEvent({
    type: 'LOGIN',
    userId: user?.id,
    email: user?.email,
  });

  if (typeof window !== 'undefined') {
    window.location.href = sanitizeAuthRedirectUrl(redirectUrl, user?.subdomain);
  }
}
