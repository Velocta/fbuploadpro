'use client';

import { useEffect } from 'react';

export function WorkspaceLifecycleGuard() {
  useEffect(() => {
    // 1. Cross-tab logout synchronization via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('fbup_auth');
        channel.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT') {
            window.location.href = '/login?logout=success';
          }
        };
      }
    } catch {
      // Ignore BroadcastChannel errors in environments where unsupported
    }

    // 2. Storage event listener for cross-tab logout & identity synchronization
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'fbup_logout_event') {
        window.location.href = '/login?logout=success';
      }
      if (
        event.key === 'fbup_active_user' &&
        event.newValue &&
        event.oldValue &&
        event.newValue !== event.oldValue
      ) {
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Back-forward cache (bfcache) mitigation: force reload if page restored from cache
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    // 4. Intercept client-side fetch calls for 403 ACCOUNT_SUSPENDED
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
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
  }, []);

  return null;
}
