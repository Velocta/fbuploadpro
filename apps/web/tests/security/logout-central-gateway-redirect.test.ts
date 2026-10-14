import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleLogout } from '@/app/api/auth/logout/route';

describe('[ISSUE-22] Central Gateway Routing for Logout Redirect', () => {
  const originalRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'fbuploadpro.com';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = originalRootDomain;
  });

  it('returns canonical absolute redirectUrl to https://app.{rootDomain}/login?logout=success when logging out from tenant subdomain', async () => {
    const request = new NextRequest('https://acme.fbuploadpro.com/api/auth/logout', {
      method: 'POST',
      headers: { host: 'acme.fbuploadpro.com' },
    });

    const res = await handleLogout(request);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.redirectUrl).toBe('https://app.fbuploadpro.com/login?logout=success');
    expect(json.redirectUrl).not.toBe('/login');
  });

  it('returns canonical absolute redirectUrl when request is invoked without explicit NextRequest object', async () => {
    const res = await handleLogout();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.redirectUrl).toBe('https://app.fbuploadpro.com/login?logout=success');
    expect(json.redirectUrl).not.toBe('/login');
  });

  it('constructs absolute redirectUrl with custom rootDomain (e.g. demo domain)', async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'vinsmokemedia.online';

    const request = new NextRequest('https://client1.vinsmokemedia.online/api/auth/logout', {
      method: 'POST',
      headers: { host: 'client1.vinsmokemedia.online' },
    });

    const res = await handleLogout(request);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.redirectUrl).toBe('https://app.vinsmokemedia.online/login?logout=success');
  });

  it('preserves preview deployment hostname on .vercel.app preview environments', async () => {
    const request = new NextRequest('https://preview-123.vercel.app/api/auth/logout', {
      method: 'POST',
      headers: { host: 'preview-123.vercel.app' },
    });

    const res = await handleLogout(request);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.redirectUrl).toBe('https://preview-123.vercel.app/login?logout=success');
  });

  it('handles custom host header without full URL and purges host-only cookie when cookie domain is active', async () => {
    const request = new NextRequest('https://acme.fbuploadpro.com/api/auth/logout', {
      headers: { host: 'acme.fbuploadpro.com' },
    });

    const res = await handleLogout(request);
    expect(res.status).toBe(200);

    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.includes('Max-Age=0'))).toBe(true);
  });
});

