/**
 * @file workspace-lifecycle-guard.test.tsx
 * @description Unit tests for WorkspaceLifecycleGuard, cross-tab auth synchronization, and redirect helpers (Spec 020/021/022).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WorkspaceLifecycleGuard,
  setupWorkspaceLifecycleGuard,
} from '@/components/workspace/workspace-lifecycle-guard';
import { broadcastAuthEvent, completeAuthRedirect } from '@/lib/auth-broadcast';
import { render } from '../components/setup';

describe('WorkspaceLifecycleGuard & Cross-Tab Auth Synchronization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders null without throwing error', () => {
      const { html } = render(<WorkspaceLifecycleGuard userId="user-1" userEmail="test@gmail.com" />);
      expect(html).toBe('');
    });
  });

  describe('setupWorkspaceLifecycleGuard Lifecycle Suite', () => {
    it('synchronizes userId to localStorage on initialization', () => {
      const mockLocalStorage = {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);
      vi.stubGlobal('window', {
        location: { href: '', reload: vi.fn() },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        fetch: vi.fn().mockResolvedValue(new Response()),
      });

      const cleanup = setupWorkspaceLifecycleGuard({
        userId: 'usr_init_123',
        userEmail: 'owner@gmail.com',
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('fbup_active_user', 'usr_init_123');
      cleanup();
    });

    it('gracefully handles localStorage exception on initialization', () => {
      const mockLocalStorage = {
        setItem: vi.fn(() => {
          throw new Error('Storage disabled');
        }),
        getItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);
      vi.stubGlobal('window', {
        location: { href: '', reload: vi.fn() },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        fetch: vi.fn().mockResolvedValue(new Response()),
      });

      expect(() => {
        const cleanup = setupWorkspaceLifecycleGuard({
          userId: 'usr_init_123',
        });
        cleanup();
      }).not.toThrow();
    });

    it('redirects to /login?logout=success on LOGOUT BroadcastChannel event', () => {
      let messageHandler: ((e: { data: unknown }) => void) | null = null;
      const closeMock = vi.fn();

      class MockBroadcastChannel {
        name: string;
        close = closeMock;
        set onmessage(fn: (e: { data: unknown }) => void) {
          messageHandler = fn;
        }
        constructor(name: string) {
          this.name = name;
        }
      }

      const mockLocation = { href: '', reload: vi.fn() };
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
      vi.stubGlobal('window', {
        location: mockLocation,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        fetch: vi.fn().mockResolvedValue(new Response()),
      });

      const cleanup = setupWorkspaceLifecycleGuard({
        userId: 'user_active',
        userEmail: 'owner@gmail.com',
      });

      expect(messageHandler).not.toBeNull();
      messageHandler!({ data: { type: 'LOGOUT' } });

      expect(mockLocation.href).toBe('/login?logout=success');
      expect(mockLocation.reload).not.toHaveBeenCalled();

      cleanup();
      expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it('triggers reload when a different user logs in via BroadcastChannel', () => {
      let messageHandler: ((e: { data: unknown }) => void) | null = null;

      class MockBroadcastChannel {
        name: string;
        close = vi.fn();
        set onmessage(fn: (e: { data: unknown }) => void) {
          messageHandler = fn;
        }
        constructor(name: string) {
          this.name = name;
        }
      }

      const mockLocation = { href: '', reload: vi.fn() };
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
      vi.stubGlobal('window', {
        location: mockLocation,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        fetch: vi.fn().mockResolvedValue(new Response()),
      });

      const cleanup = setupWorkspaceLifecycleGuard({
        userId: 'user_active_1',
        userEmail: 'owner@gmail.com',
      });

      messageHandler!({
        data: {
          type: 'LOGIN',
          userId: 'user_diff_2',
          email: 'diff@gmail.com',
        },
      });

      expect(mockLocation.reload).toHaveBeenCalledTimes(1);
      cleanup();
    });

    it('does not reload when the exact same user logs in via BroadcastChannel', () => {
      let messageHandler: ((e: { data: unknown }) => void) | null = null;

      class MockBroadcastChannel {
        name: string;
        close = vi.fn();
        set onmessage(fn: (e: { data: unknown }) => void) {
          messageHandler = fn;
        }
        constructor(name: string) {
          this.name = name;
        }
      }

      const mockLocation = { href: '', reload: vi.fn() };
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
      vi.stubGlobal('window', {
        location: mockLocation,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        fetch: vi.fn().mockResolvedValue(new Response()),
      });

      const cleanup = setupWorkspaceLifecycleGuard({
        userId: 'user_active_1',
        userEmail: 'owner@gmail.com',
      });

      messageHandler!({
        data: {
          type: 'LOGIN',
          userId: 'user_active_1',
          email: 'owner@gmail.com',
        },
      });

      expect(mockLocation.reload).not.toHaveBeenCalled();
      cleanup();
    });

    it('triggers reload on explicit USER_SWITCH, SESSION_CHANGE, and SESSION_CHANGED BroadcastChannel events', () => {
      let messageHandler: ((e: { data: unknown }) => void) | null = null;

      class MockBroadcastChannel {
        name: string;
        close = vi.fn();
        set onmessage(fn: (e: { data: unknown }) => void) {
          messageHandler = fn;
        }
        constructor(name: string) {
          this.name = name;
        }
      }

      const mockLocation = { href: '', reload: vi.fn() };
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
      vi.stubGlobal('window', {
        location: mockLocation,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        fetch: vi.fn().mockResolvedValue(new Response()),
      });

      const cleanup = setupWorkspaceLifecycleGuard({
        userId: 'user_active_1',
        userEmail: 'owner@gmail.com',
      });

      // 1. USER_SWITCH
      messageHandler!({
        data: {
          type: 'USER_SWITCH',
          userId: 'user_active_1',
        },
      });
      expect(mockLocation.reload).toHaveBeenCalledTimes(1);

      // 2. SESSION_CHANGE
      messageHandler!({
        data: {
          type: 'SESSION_CHANGE',
          userId: 'user_diff_3',
        },
      });
      expect(mockLocation.reload).toHaveBeenCalledTimes(2);

      // 3. SESSION_CHANGED
      messageHandler!({
        data: {
          type: 'SESSION_CHANGED',
          userId: 'user_diff_4',
        },
      });
      expect(mockLocation.reload).toHaveBeenCalledTimes(3);

      // 4. Unrecognized event type (no-op)
      messageHandler!({
        data: {
          type: 'OTHER_EVENT',
        },
      });
      expect(mockLocation.reload).toHaveBeenCalledTimes(3);

      cleanup();
    });

    it('falls back to localStorage active user when userId prop is omitted', () => {
      let messageHandler: ((e: { data: unknown }) => void) | null = null;

      class MockBroadcastChannel {
        name: string;
        close = vi.fn();
        set onmessage(fn: (e: { data: unknown }) => void) {
          messageHandler = fn;
        }
        constructor(name: string) {
          this.name = name;
        }
      }

      const mockLocation = { href: '', reload: vi.fn() };
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key: string) => (key === 'fbup_active_user' ? 'cached_usr_1' : null)),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      });
      vi.stubGlobal('window', {
        location: mockLocation,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        fetch: vi.fn().mockResolvedValue(new Response()),
      });

      const cleanup = setupWorkspaceLifecycleGuard();

      // Same user from localStorage: no reload
      messageHandler!({
        data: {
          type: 'LOGIN',
          userId: 'cached_usr_1',
        },
      });
      expect(mockLocation.reload).not.toHaveBeenCalled();

      // Different user: reload
      messageHandler!({
        data: {
          type: 'LOGIN',
          userId: 'cached_usr_2',
        },
      });
      expect(mockLocation.reload).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('handles environments where BroadcastChannel constructor or close throws', () => {
      class FailingBroadcastChannel {
        constructor() {
          throw new Error('Not supported');
        }
      }
      vi.stubGlobal('BroadcastChannel', FailingBroadcastChannel);
      vi.stubGlobal('window', {
        location: { href: '', reload: vi.fn() },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        fetch: vi.fn().mockResolvedValue(new Response()),
      });

      expect(() => {
        const cleanup = setupWorkspaceLifecycleGuard();
        cleanup();
      }).not.toThrow();
    });

    it('handles storage events for cross-tab logout and user identity changes', () => {
      let storageListener: ((e: any) => void) | null = null;
      let pageshowListener: ((e: any) => void) | null = null;

      const mockLocation = { href: '', reload: vi.fn() };
      const addEventListenerMock = vi.fn((event: string, fn: any) => {
        if (event === 'storage') storageListener = fn;
        if (event === 'pageshow') pageshowListener = fn;
      });
      const removeEventListenerMock = vi.fn();

      vi.stubGlobal('window', {
        location: mockLocation,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
        fetch: vi.fn().mockResolvedValue(new Response()),
      });

      const cleanup = setupWorkspaceLifecycleGuard({
        userId: 'user_active_1',
        userEmail: 'owner@gmail.com',
      });

      expect(storageListener).not.toBeNull();
      expect(pageshowListener).not.toBeNull();

      // 1. Test fbup_logout_event
      storageListener!({ key: 'fbup_logout_event' });
      expect(mockLocation.href).toBe('/login?logout=success');

      // 2. Test fbup_active_user matching current user (no-op)
      storageListener!({
        key: 'fbup_active_user',
        newValue: 'user_active_1',
        oldValue: 'user_active_1',
      });
      expect(mockLocation.reload).not.toHaveBeenCalled();

      // 3. Test fbup_active_user shifting to different user (triggers reload)
      storageListener!({
        key: 'fbup_active_user',
        newValue: 'user_new_2',
        oldValue: 'user_active_1',
      });
      expect(mockLocation.reload).toHaveBeenCalledTimes(1);

      // 4. Test unrelated storage key (no-op)
      storageListener!({
        key: 'unrelated_key',
        newValue: 'val',
      });
      expect(mockLocation.reload).toHaveBeenCalledTimes(1);

      // 5. Test pageshow with persisted: false (no-op)
      pageshowListener!({ persisted: false });
      expect(mockLocation.reload).toHaveBeenCalledTimes(1);

      // 6. Test pageshow with persisted: true (bfcache hard reload)
      pageshowListener!({ persisted: true });
      expect(mockLocation.reload).toHaveBeenCalledTimes(2);

      cleanup();
      expect(removeEventListenerMock).toHaveBeenCalledWith('storage', storageListener);
      expect(removeEventListenerMock).toHaveBeenCalledWith('pageshow', pageshowListener);
    });

    it('intercepts client-side fetch calls for 403 ACCOUNT_SUSPENDED and restores original fetch', async () => {
      const mockLocation = { href: '', reload: vi.fn() };
      const originalNativeFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'ACCOUNT_SUSPENDED' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const fakeWindow: any = {
        location: mockLocation,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        fetch: originalNativeFetch,
      };

      vi.stubGlobal('window', fakeWindow);

      const cleanup = setupWorkspaceLifecycleGuard();

      expect(fakeWindow.fetch).not.toBe(originalNativeFetch);

      // 1. Intercepted fetch returning ACCOUNT_SUSPENDED code
      await fakeWindow.fetch('/api/some-endpoint');
      expect(mockLocation.href).toBe('/account-suspended');

      // 2. Intercepted fetch returning suspended in error string
      originalNativeFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Your account is suspended by admin.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      mockLocation.href = '';
      await fakeWindow.fetch('/api/check');
      expect(mockLocation.href).toBe('/account-suspended');

      // 3. Test with non-JSON 403 (does not crash)
      originalNativeFetch.mockResolvedValueOnce(
        new Response('<html>Forbidden</html>', { status: 403 })
      );
      await fakeWindow.fetch('/api/non-json');

      // 4. Test with 200 normal response
      originalNativeFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      const res = await fakeWindow.fetch('/api/ok');
      expect(res.status).toBe(200);

      cleanup();
      expect(fakeWindow.fetch).toBe(originalNativeFetch);
    });
  });

  describe('broadcastAuthEvent helper', () => {
    it('broadcasts LOGIN event and persists active user in localStorage', () => {
      const postMessageMock = vi.fn();
      const closeMock = vi.fn();

      class MockBroadcastChannel {
        name: string;
        postMessage = postMessageMock;
        close = closeMock;
        constructor(name: string) {
          this.name = name;
        }
      }

      const localStorageStore: Record<string, string> = {};
      const mockLocalStorage = {
        setItem: vi.fn((key: string, val: string) => {
          localStorageStore[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageStore[key];
        }),
        getItem: (key: string) => localStorageStore[key] ?? null,
      };

      vi.stubGlobal('window', { BroadcastChannel: MockBroadcastChannel, localStorage: mockLocalStorage });
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
      vi.stubGlobal('localStorage', mockLocalStorage);

      broadcastAuthEvent({
        type: 'LOGIN',
        userId: 'usr_new_123',
        email: 'user@gmail.com',
      });

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGIN',
          userId: 'usr_new_123',
          email: 'user@gmail.com',
        })
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('fbup_active_user', 'usr_new_123');
    });

    it('broadcasts LOGOUT event, records logout timestamp, and purges active user', () => {
      const postMessageMock = vi.fn();
      const closeMock = vi.fn();

      class MockBroadcastChannel {
        name: string;
        postMessage = postMessageMock;
        close = closeMock;
        constructor(name: string) {
          this.name = name;
        }
      }

      const localStorageStore: Record<string, string> = { fbup_active_user: 'usr_existing' };
      const mockLocalStorage = {
        setItem: vi.fn((key: string, val: string) => {
          localStorageStore[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageStore[key];
        }),
        getItem: (key: string) => localStorageStore[key] ?? null,
      };

      vi.stubGlobal('window', { BroadcastChannel: MockBroadcastChannel, localStorage: mockLocalStorage });
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
      vi.stubGlobal('localStorage', mockLocalStorage);

      broadcastAuthEvent({ type: 'LOGOUT' });

      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGOUT',
        })
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('fbup_logout_event', expect.any(String));
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('fbup_active_user');
    });

    it('handles USER_SWITCH and SESSION_CHANGE events gracefully', () => {
      const postMessageMock = vi.fn();
      const closeMock = vi.fn();

      class MockBroadcastChannel {
        name: string;
        postMessage = postMessageMock;
        close = closeMock;
        constructor(name: string) {
          this.name = name;
        }
      }

      vi.stubGlobal('window', { BroadcastChannel: MockBroadcastChannel });
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

      broadcastAuthEvent({ type: 'USER_SWITCH', userId: 'user-switched' });
      broadcastAuthEvent({ type: 'SESSION_CHANGE' });

      expect(postMessageMock).toHaveBeenCalledTimes(2);
    });

    it('catches BroadcastChannel or localStorage exceptions gracefully', () => {
      class ErrorBroadcastChannel {
        constructor() {
          throw new Error('BroadcastChannel not supported');
        }
      }

      const errorLocalStorage = {
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
        removeItem: vi.fn(),
        getItem: vi.fn(),
      };

      vi.stubGlobal('window', { BroadcastChannel: ErrorBroadcastChannel, localStorage: errorLocalStorage });
      vi.stubGlobal('BroadcastChannel', ErrorBroadcastChannel);
      vi.stubGlobal('localStorage', errorLocalStorage);

      expect(() => {
        broadcastAuthEvent({ type: 'LOGIN', userId: 'usr_fail' });
      }).not.toThrow();
    });
  });

  describe('completeAuthRedirect helper', () => {
    it('broadcasts LOGIN and updates window.location.href to sanitized destination', () => {
      const postMessage = vi.fn();
      class MockBroadcastChannel {
        postMessage = postMessage;
        close = vi.fn();
      }
      const mockLocation = { href: '', hostname: 'localhost' };
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
      vi.stubGlobal('localStorage', { setItem: vi.fn() });
      vi.stubGlobal('window', { location: mockLocation, BroadcastChannel: MockBroadcastChannel });

      completeAuthRedirect('/tenant/acme', {
        id: 'user_456',
        email: 'user@gmail.com',
        subdomain: 'acme',
      });

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGIN',
          userId: 'user_456',
          email: 'user@gmail.com',
        })
      );
      expect(mockLocation.href).toBe('http://acme.localhost:3000/tenant/acme');
    });

    it('works when user is omitted', () => {
      const postMessage = vi.fn();
      class MockBroadcastChannel {
        postMessage = postMessage;
        close = vi.fn();
      }
      const mockLocation = { href: '', hostname: 'localhost' };
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
      vi.stubGlobal('window', { location: mockLocation, BroadcastChannel: MockBroadcastChannel });

      completeAuthRedirect('/login?reset=success');

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGIN',
        })
      );
      expect(mockLocation.href).toBe('/login?reset=success');
    });
  });
});
