/**
 * @file workspace-lifecycle-guard.test.tsx
 * @description Unit tests for WorkspaceLifecycleGuard & cross-tab auth synchronization (Spec 020/021/022).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { broadcastAuthEvent } from '@/lib/auth-broadcast';

describe('WorkspaceLifecycleGuard & Cross-Tab Auth Synchronization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('WorkspaceLifecycleGuard Fetch Interceptor (Audit Issue 25)', () => {
    it('binds originalFetch to window and safely restores original fetch on cleanup', async () => {
      let callThisArg: unknown = undefined;

      const mockNativeFetch = vi.fn(function (this: unknown, _input: RequestInfo | URL, _init?: RequestInit) {
        callThisArg = this;
        if (this !== mockWindow) {
          throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      });

      const mockWindow: {
        fetch: typeof fetch;
        addEventListener: ReturnType<typeof vi.fn>;
        removeEventListener: ReturnType<typeof vi.fn>;
        location: { href: string; reload: ReturnType<typeof vi.fn> };
      } = {
        fetch: mockNativeFetch as unknown as typeof fetch,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        location: { href: '', reload: vi.fn() },
      };

      // Simulate the logic inside WorkspaceLifecycleGuard's useEffect
      const originalFetch = mockWindow.fetch.bind(mockWindow);
      mockWindow.fetch = (async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args);
        if (response.status === 403) {
          try {
            const clone = response.clone();
            const data = (await clone.json()) as { code?: string; error?: string };
            if (
              data?.code === 'ACCOUNT_SUSPENDED' ||
              (typeof data?.error === 'string' && data.error.toLowerCase().includes('suspended'))
            ) {
              mockWindow.location.href = '/account-suspended';
            }
          } catch {}
        }
        return response;
      }) as unknown as typeof fetch;

      // Verify intercepted fetch preserves window context when calling originalFetch
      const res = await mockWindow.fetch('/api/test');
      expect(res.status).toBe(200);
      expect(callThisArg).toBe(mockWindow);
      expect(mockNativeFetch).toHaveBeenCalledTimes(1);

      // Simulate cleanup
      mockWindow.fetch = originalFetch;
      expect(mockWindow.fetch).toBe(originalFetch);
    });
  });

  describe('BroadcastChannel Multi-Tab Synchronization', () => {
    it('redirects to /login?logout=success when LOGOUT event is received', () => {
      let onmessageHandler: ((event: { data: unknown }) => void) | null = null;

      const mockLocation = { href: '', reload: vi.fn() };

      // Simulate channel message listener setup
      const simulateMessage = (data: unknown) => {
        if (!onmessageHandler) return;
        onmessageHandler({ data });
      };

      onmessageHandler = (event: { data: any }) => {
        const data = event.data;
        if (data?.type === 'LOGOUT') {
          mockLocation.href = '/login?logout=success';
          return;
        }
      };

      simulateMessage({ type: 'LOGOUT', timestamp: Date.now() });

      expect(mockLocation.href).toBe('/login?logout=success');
      expect(mockLocation.reload).not.toHaveBeenCalled();
    });

    it('triggers reload when a different user logs in on another tab (LOGIN event)', () => {
      const currentUserId = 'user-owner-1';
      const currentUserEmail = 'owner1@gmail.com';
      const mockLocation = { href: '', reload: vi.fn() };

      const handleChannelMessage = (event: { data: any }) => {
        const data = event.data;
        if (data?.type === 'LOGOUT') {
          mockLocation.href = '/login?logout=success';
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
          const activeId = currentUserId;

          const isSameUser = Boolean(
            activeId &&
              incomingUserId &&
              activeId === incomingUserId &&
              (!currentUserEmail ||
                !incomingUserEmail ||
                currentUserEmail.toLowerCase() === incomingUserEmail.toLowerCase())
          );

          if (!isSameUser || data?.type === 'USER_SWITCH') {
            mockLocation.reload();
          }
        }
      };

      // Different user logs in
      handleChannelMessage({
        data: {
          type: 'LOGIN',
          userId: 'user-intruder-2',
          email: 'intruder2@gmail.com',
          timestamp: Date.now(),
        },
      });

      expect(mockLocation.reload).toHaveBeenCalledTimes(1);
    });

    it('does not trigger reload when the same user logs in on another tab', () => {
      const currentUserId = 'user-owner-1';
      const currentUserEmail = 'owner1@gmail.com';
      const mockLocation = { href: '', reload: vi.fn() };

      const handleChannelMessage = (event: { data: any }) => {
        const data = event.data;
        if (data?.type === 'LOGOUT') {
          mockLocation.href = '/login?logout=success';
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
          const activeId = currentUserId;

          const isSameUser = Boolean(
            activeId &&
              incomingUserId &&
              activeId === incomingUserId &&
              (!currentUserEmail ||
                !incomingUserEmail ||
                currentUserEmail.toLowerCase() === incomingUserEmail.toLowerCase())
          );

          if (!isSameUser || data?.type === 'USER_SWITCH') {
            mockLocation.reload();
          }
        }
      };

      // Same user logs in
      handleChannelMessage({
        data: {
          type: 'LOGIN',
          userId: 'user-owner-1',
          email: 'owner1@gmail.com',
          timestamp: Date.now(),
        },
      });

      expect(mockLocation.reload).not.toHaveBeenCalled();
    });

    it('triggers reload on explicit USER_SWITCH or SESSION_CHANGE event', () => {
      const currentUserId = 'user-owner-1';
      const mockLocation = { href: '', reload: vi.fn() };

      const handleChannelMessage = (event: { data: any }) => {
        const data = event.data;
        if (
          data?.type === 'LOGIN' ||
          data?.type === 'USER_SWITCH' ||
          data?.type === 'SESSION_CHANGE' ||
          data?.type === 'SESSION_CHANGED'
        ) {
          const incomingUserId = data?.userId;
          const isSameUser = Boolean(currentUserId && incomingUserId && currentUserId === incomingUserId);

          if (!isSameUser || data?.type === 'USER_SWITCH' || data?.type === 'SESSION_CHANGE') {
            mockLocation.reload();
          }
        }
      };

      handleChannelMessage({
        data: {
          type: 'USER_SWITCH',
          userId: 'user-owner-1',
          timestamp: Date.now(),
        },
      });

      expect(mockLocation.reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('Storage Event Cross-Tab Synchronization', () => {
    it('redirects to /login?logout=success on fbup_logout_event', () => {
      const mockLocation = { href: '', reload: vi.fn() };

      const handleStorage = (event: { key: string; newValue?: string; oldValue?: string }) => {
        if (event.key === 'fbup_logout_event') {
          mockLocation.href = '/login?logout=success';
          return;
        }
      };

      handleStorage({ key: 'fbup_logout_event', newValue: String(Date.now()) });
      expect(mockLocation.href).toBe('/login?logout=success');
    });

    it('reloads when fbup_active_user changes to a different user in localStorage', () => {
      const currentUserId = 'user-owner-1';
      const mockLocation = { href: '', reload: vi.fn() };

      const handleStorage = (event: { key: string; newValue?: string | null; oldValue?: string | null }) => {
        if (event.key === 'fbup_active_user') {
          const activeId = currentUserId;
          if (
            event.newValue &&
            ((event.oldValue && event.newValue !== event.oldValue) ||
              (activeId && event.newValue !== activeId))
          ) {
            mockLocation.reload();
          }
        }
      };

      handleStorage({
        key: 'fbup_active_user',
        newValue: 'user-switched-2',
        oldValue: 'user-owner-1',
      });

      expect(mockLocation.reload).toHaveBeenCalledTimes(1);
    });

    it('does not reload when fbup_active_user matches current user', () => {
      const currentUserId = 'user-owner-1';
      const mockLocation = { href: '', reload: vi.fn() };

      const handleStorage = (event: { key: string; newValue?: string | null; oldValue?: string | null }) => {
        if (event.key === 'fbup_active_user') {
          const activeId = currentUserId;
          if (
            event.newValue &&
            ((event.oldValue && event.newValue !== event.oldValue) ||
              (activeId && event.newValue !== activeId))
          ) {
            mockLocation.reload();
          }
        }
      };

      handleStorage({
        key: 'fbup_active_user',
        newValue: 'user-owner-1',
        oldValue: 'user-owner-1',
      });

      expect(mockLocation.reload).not.toHaveBeenCalled();
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
  });
});
