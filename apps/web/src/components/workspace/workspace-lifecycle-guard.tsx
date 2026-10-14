'use client';

import { useEffect } from 'react';

export interface WorkspaceLifecycleGuardProps {
  userId?: string | null | undefined;
  userEmail?: string | null | undefined;
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
    } catch {
      // Ignore localStorage errors
    }
  }

  // 2. Cross-tab auth synchronization via BroadcastChannel ('fbup_auth')
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('fbup_auth');
      channel.onmessage = (event) => {
        const data = event.data;
        if (data?.type === 'LOGOUT') {
          window.location.href = '/login?logout=success';
          return;
        }

        if (
          data?.type === 'LOGIN' ||
          data?.type === 'USER_SWITCH' ||
          data?.type === 'SESSION_CHANGE' ||
          data?.type === 'SESSION_CHANGED'
        ) {
          const incomingUserId = data?.userId;
          const incomingUserEmail = data?.email;
          const activeId =
            userId ||
            (typeof localStorage !== 'undefined'
              ? localStorage.getItem('fbup_active_user')
              : null);

          const isSameUser = Boolean(
            activeId &&
              incomingUserId &&
              activeId === incomingUserId &&
              (!userEmail ||
                !incomingUserEmail ||
                userEmail.toLowerCase() === incomingUserEmail.toLowerCase())
          );

          // Reload when a different user logs in, user-switch is explicitly dispatched, or identity changed
          if (!isSameUser || data?.type === 'USER_SWITCH') {
            window.location.reload();
          }
        }
      };
    }
  } catch {
    // Ignore BroadcastChannel errors in environments where unsupported
  }

  // 3. Storage event listener for cross-tab logout & identity synchronization
  const handleStorage = (event: StorageEvent) => {
    if (event.key === 'fbup_logout_event') {
      window.location.href = '/login?logout=success';
      return;
    }
    if (event.key === 'fbup_active_user') {
      const activeId =
        userId ||
        (typeof localStorage !== 'undefined'
          ? localStorage.getItem('fbup_active_user')
          : null);
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
  const originalFetch = window.fetch;
  const boundFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await boundFetch(...args);
    if (response.status === 403) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (
          data?.code === 'ACCOUNT_SUSPENDED' ||
          (typeof data?.error === 'string' && data.error.toLowerCase().includes('suspended'))
        ) {
          window.location.href = '/account-suspended';
        }
      } catch {
        // Non-JSON or standard 403, proceed normally
      }
    }
    return response;
  };

  return () => {
    if (channel) {
      try {
        channel.close();
      } catch {}
    }
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('pageshow', handlePageShow);
    window.fetch = originalFetch;
  };
}

export function WorkspaceLifecycleGuard(props: WorkspaceLifecycleGuardProps = {}) {
  useEffect(() => {
    return setupWorkspaceLifecycleGuard(props);
  }, [props.userId, props.userEmail]);

  return null;
}
