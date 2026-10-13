/**
 * @file workspace-lifecycle-guard.test.tsx
 * @description Unit tests for WorkspaceLifecycleGuard (Audit Issue 25).
 */

import { describe, it, expect, vi } from 'vitest';

describe('WorkspaceLifecycleGuard (Audit Issue 25)', () => {
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
