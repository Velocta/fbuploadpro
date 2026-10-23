'use client';

/**
 * WorkspaceLifecycleGuard — invisible shell infrastructure, rebuilt
 * clean (spec 130 §5.3/T25, PR-130-2b). All four duties are preserved
 * verbatim in behaviour (spec §4.1):
 *  1. Active-user sync to `fbup_active_user` (the allowlisted auth
 *     mechanism of spec §3.3 — stays direct localStorage by design).
 *  2. Cross-tab auth sync: BroadcastChannel `fbup_auth` — LOGOUT →
 *     `/login?logout=success`; LOGIN / USER_SWITCH / SESSION_CHANGE(D)
 *     from a different identity (or an explicit USER_SWITCH) → reload;
 *     same-identity events do not reload. The storage-event fallback
 *     mirrors this (`fbup_logout_event`, `fbup_active_user` changes).
 *  3. bfcache restore (`pageshow` persisted) → reload.
 *  4. The global fetch wrapper's 403 `ACCOUNT_SUSPENDED` →
 *     `/account-suspended` interception.
 *
 * OD130-5 (DEFERRED-to-default, 2026-10-23): the fetch wrapper is
 * PRESERVED, rebuilt clean — the deferral is recorded here and in
 * the PR body; its long-term home (typed-client error path vs.
 * server-side enforcement) is a future decision, not this PR's.
 *
 * The rebuild removes the file's 4 `any`s and 4 empty catches: the
 * wrapper markers live on a typed record, and every catch is a named,
 * commented contract (best-effort infra must never throw into the
 * shell — the failure mode each catch guards is stated at the site).
 */

import { useEffect } from 'react';

export interface WorkspaceLifecycleGuardProps {
  userId?: string | null | undefined;
  userEmail?: string | null | undefined;
}

interface WrappedFetch {
  [key: symbol]: unknown;
}

const FETCH_WRAPPED = Symbol.for('fbup.fetch_wrapped');
const FETCH_ORIGINAL = Symbol.for('fbup.fetch_original');

function readActiveUserId(fallbackUserId?: string | null): string | null {
  if (fallbackUserId) return fallbackUserId;
  let stored: string | null = null;
  try {
    stored =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('fbup_active_user')
        : null;
  } catch {
    // Storage unavailable (private mode / disabled): identity falls
    // back to "unknown", which never suppresses a reload.
    stored = null;
  }
  return stored;
}

interface AuthBroadcastData {
  type?: string;
  userId?: string;
  email?: string;
}

function handleAuthBroadcast(
  data: AuthBroadcastData,
  userId?: string | null,
  userEmail?: string | null
): void {
  if (data.type === 'LOGOUT') {
    window.location.href = '/login?logout=success';
    return;
  }

  if (
    data.type === 'LOGIN' ||
    data.type === 'USER_SWITCH' ||
    data.type === 'SESSION_CHANGE' ||
    data.type === 'SESSION_CHANGED'
  ) {
    const incomingUserId = data.userId;
    const incomingUserEmail = data.email;
    const activeId = readActiveUserId(userId);

    const isSameUser = Boolean(
      activeId &&
        incomingUserId &&
        activeId === incomingUserId &&
        (!userEmail ||
          !incomingUserEmail ||
          userEmail.toLowerCase() === incomingUserEmail.toLowerCase())
    );

    // Reload when a different user logs in, a user-switch is
    // explicitly dispatched, or the identity changed.
    if (!isSameUser || data.type === 'USER_SWITCH') {
      window.location.reload();
    }
  }
}

function installSuspendedFetchWrapper(): () => void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return () => undefined;
  }

  const current = window.fetch as typeof window.fetch & WrappedFetch;
  if (current[FETCH_WRAPPED]) {
    // Already wrapped (e.g. a second guard mount): keep the existing
    // wrapper and its captured original; this mount owns no restore.
    return () => undefined;
  }

  const originalFetch = window.fetch;
  const boundFetch = originalFetch.bind(window);
  const wrappedFetch = (async (...args: Parameters<typeof fetch>) => {
    const response = await boundFetch(...args);
    if (response.status === 403) {
      let suspended = false;
      try {
        const clone = response.clone();
        const data: unknown = await clone.json();
        if (data !== null && typeof data === 'object') {
          const body = data as Record<string, unknown>;
          suspended =
            body.code === 'ACCOUNT_SUSPENDED' ||
            (typeof body.error === 'string' &&
              body.error.toLowerCase().includes('suspended'));
        }
      } catch {
        // Non-JSON or unreadable 403 body: a standard 403 — the
        // response proceeds to its caller untouched.
        suspended = false;
      }
      if (suspended) {
        window.location.href = '/account-suspended';
      }
    }
    return response;
  }) as typeof window.fetch & WrappedFetch;

  wrappedFetch[FETCH_WRAPPED] = true;
  wrappedFetch[FETCH_ORIGINAL] = originalFetch;
  window.fetch = wrappedFetch;

  return () => {
    if (window.fetch === wrappedFetch) {
      window.fetch = originalFetch;
    }
  };
}

/**
 * Initializes cross-tab lifecycle event listeners and returns a cleanup function.
 * Exported for direct execution in test environments without full React DOM lifecycle.
 */
export function setupWorkspaceLifecycleGuard({
  userId,
  userEmail,
}: WorkspaceLifecycleGuardProps = {}): () => void {
  // 1. Sync active user ID to localStorage if available
  if (userId && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('fbup_active_user', userId);
    } catch (error) {
      // Storage unavailable: cross-tab sync degrades to the
      // BroadcastChannel/storage-event paths below; nothing else
      // depends on this write succeeding.
      console.warn(
        '[workspace-lifecycle-guard] active-user sync unavailable',
        error,
      );
    }
  }

  // 2. Cross-tab auth synchronization via BroadcastChannel ('fbup_auth')
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('fbup_auth');
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data !== null && typeof event.data === 'object') {
          handleAuthBroadcast(event.data as AuthBroadcastData, userId, userEmail);
        }
      };
    }
  } catch {
    // BroadcastChannel unsupported or blocked: the storage-event
    // fallback below carries the same synchronization.
    channel = null;
  }

  // 3. Storage event listener for cross-tab logout & identity synchronization
  const handleStorage = (event: StorageEvent) => {
    if (event.key === 'fbup_logout_event') {
      window.location.href = '/login?logout=success';
      return;
    }
    if (event.key === 'fbup_active_user') {
      const activeId = readActiveUserId(userId);
      if (
        event.newValue &&
        ((event.oldValue && event.newValue !== event.oldValue) ||
          (activeId && event.newValue !== activeId))
      ) {
        window.location.reload();
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  // 4. Back-forward cache (bfcache) mitigation: force reload if page restored from cache
  const handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      window.location.reload();
    }
  };
  window.addEventListener('pageshow', handlePageShow);

  // 5. Intercept client-side fetch calls for 403 ACCOUNT_SUSPENDED
  //    (preserved per OD130-5 preservation default — see file header).
  const restoreFetch = installSuspendedFetchWrapper();

  return () => {
    if (channel) {
      try {
        channel.close();
      } catch (error) {
        // Best-effort cleanup on unmount: a close failure has no
        // observable consequence — the channel is discarded either way.
        console.warn(
          '[workspace-lifecycle-guard] BroadcastChannel close failed',
          error,
        );
      }
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('pageshow', handlePageShow);
    restoreFetch();
  };
}

export function WorkspaceLifecycleGuard(props: WorkspaceLifecycleGuardProps = {}) {
  const { userId, userEmail } = props;
  useEffect(() => {
    return setupWorkspaceLifecycleGuard({ userId, userEmail });
  }, [userId, userEmail]);

  return null;
}
