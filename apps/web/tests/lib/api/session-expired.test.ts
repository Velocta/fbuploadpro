import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSessionExpiredUrl,
  createSessionExpiredHandler,
  getCurrentPath,
  handleSessionExpired,
  isLoginPath,
  registerSessionExpiredHandler,
  resetSessionExpiredGuard,
} from '@/lib/api/session-expired';
import {
  resetReportErrorTransport,
  setReportErrorTransport,
} from '@/lib/report-error';

describe('isLoginPath', () => {
  it('matches the login route and its variants', () => {
    expect(isLoginPath('/login')).toBe(true);
    expect(isLoginPath('/login?next=%2Faccounts')).toBe(true);
    expect(isLoginPath('/login#top')).toBe(true);
    expect(isLoginPath('/login/extra')).toBe(true);
  });

  it('does not match other routes', () => {
    expect(isLoginPath('/accounts')).toBe(false);
    expect(isLoginPath('/loginx')).toBe(false);
    expect(isLoginPath('/tenant/alpha/login')).toBe(false);
  });
});

describe('buildSessionExpiredUrl', () => {
  it('encodes the current path as next and flags the reason', () => {
    expect(buildSessionExpiredUrl('/media?folder=1')).toBe(
      '/login?next=%2Fmedia%3Ffolder%3D1&reason=session-expired'
    );
    expect(buildSessionExpiredUrl('/')).toBe(
      '/login?next=%2F&reason=session-expired'
    );
  });
});

describe('getCurrentPath', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to / outside a browser', () => {
    expect(getCurrentPath()).toBe('/');
  });

  it('reads pathname + search from the browser location', () => {
    vi.stubGlobal('window', {
      location: { pathname: '/pages/abc', search: '?tab=queue', assign: vi.fn() },
    });
    expect(getCurrentPath()).toBe('/pages/abc?tab=queue');
  });
});

describe('createSessionExpiredHandler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears the cache hook, then navigates to the login URL', () => {
    const clearCache = vi.fn();
    const navigate = vi.fn();
    const handler = createSessionExpiredHandler({ clearCache, navigate });
    void handler({ path: '/accounts' });
    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      '/login?next=%2Faccounts&reason=session-expired'
    );
  });

  it('clears the cache but never navigates away from the login route', () => {
    const clearCache = vi.fn();
    const navigate = vi.fn();
    const handler = createSessionExpiredHandler({ clearCache, navigate });
    void handler({ path: '/login' });
    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('works without a cache hook', () => {
    const navigate = vi.fn();
    const handler = createSessionExpiredHandler({ navigate });
    void handler({ path: '/settings' });
    expect(navigate).toHaveBeenCalledWith(
      '/login?next=%2Fsettings&reason=session-expired'
    );
  });

  it('uses window.location.assign as the default navigation', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { pathname: '/', search: '', assign },
    });
    const handler = createSessionExpiredHandler();
    void handler({ path: '/media' });
    expect(assign).toHaveBeenCalledWith('/login?next=%2Fmedia&reason=session-expired');
  });
});

describe('handleSessionExpired (global, exactly-once)', () => {
  let unregister: (() => void) | null = null;

  beforeEach(() => {
    resetSessionExpiredGuard();
  });

  afterEach(() => {
    unregister?.();
    unregister = null;
    resetSessionExpiredGuard();
    resetReportErrorTransport();
    vi.unstubAllGlobals();
  });

  it('runs the registered handler with the current path', async () => {
    const handler = vi.fn();
    unregister = registerSessionExpiredHandler(handler);
    await expect(handleSessionExpired('/queue')).resolves.toBe(true);
    expect(handler).toHaveBeenCalledWith({ path: '/queue' });
  });

  it('fires exactly once across repeated 401s until the guard resets', async () => {
    const handler = vi.fn();
    unregister = registerSessionExpiredHandler(handler);
    await expect(handleSessionExpired('/a')).resolves.toBe(true);
    await expect(handleSessionExpired('/b')).resolves.toBe(false);
    await expect(handleSessionExpired('/c')).resolves.toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
    resetSessionExpiredGuard();
    await expect(handleSessionExpired('/d')).resolves.toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith({ path: '/d' });
  });

  it('awaits an async handler before resolving', async () => {
    let finished = false;
    unregister = registerSessionExpiredHandler(async () => {
      await Promise.resolve();
      finished = true;
    });
    await handleSessionExpired('/slow');
    expect(finished).toBe(true);
  });

  it('never redirects from the login route, and does not latch there', async () => {
    const handler = vi.fn();
    unregister = registerSessionExpiredHandler(handler);
    await expect(handleSessionExpired('/login')).resolves.toBe(false);
    await expect(handleSessionExpired('/login?reason=session-expired')).resolves.toBe(
      false
    );
    expect(handler).not.toHaveBeenCalled();
    await expect(handleSessionExpired('/accounts')).resolves.toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reports a throwing handler instead of propagating it', async () => {
    const transport = vi.fn();
    setReportErrorTransport(transport);
    const failure = new Error('cache clear exploded');
    unregister = registerSessionExpiredHandler(() => {
      throw failure;
    });
    await expect(handleSessionExpired('/fragile')).resolves.toBe(true);
    expect(transport).toHaveBeenCalledWith(failure, {
      source: 'session-expired-handler',
      path: '/fragile',
    });
  });

  it('falls back to the default redirect when nothing is registered', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { pathname: '/dashboard', search: '', assign },
    });
    await expect(handleSessionExpired()).resolves.toBe(true);
    expect(assign).toHaveBeenCalledWith(
      '/login?next=%2Fdashboard&reason=session-expired'
    );
  });

  it('unregistering removes the handler so the default takes over', async () => {
    const handler = vi.fn();
    const off = registerSessionExpiredHandler(handler);
    off();
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { pathname: '/x', search: '', assign },
    });
    await expect(handleSessionExpired('/x')).resolves.toBe(true);
    expect(handler).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('unregistering a stale handler does not remove a newer one', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = registerSessionExpiredHandler(first);
    unregister = registerSessionExpiredHandler(second);
    offFirst();
    await expect(handleSessionExpired('/y')).resolves.toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
