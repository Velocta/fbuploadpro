import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';

describe('Middleware Subdomain Auth Redirection (Spec 013 - Eliminate 404s)', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
  });

  it('redirects /login on tenant subdomain to central app gateway via 307 preserving returnUrl', async () => {
    const req = new NextRequest('http://acme.localhost:3000/login?returnUrl=%2Fdashboard%2Fmedia', {
      headers: { host: 'acme.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://app.localhost:3000/login?returnUrl=%2Fdashboard%2Fmedia');
  });

  it('redirects /signup on tenant subdomain to central app gateway via 307 preserving query params', async () => {
    const req = new NextRequest('http://acme.localhost:3000/signup?plan=pro&returnUrl=%2Fqueue', {
      headers: { host: 'acme.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://app.localhost:3000/signup?plan=pro&returnUrl=%2Fqueue');
  });

  it('redirects /forgot-password on tenant subdomain to central app gateway via 307', async () => {
    const req = new NextRequest('http://acme.localhost:3000/forgot-password', {
      headers: { host: 'acme.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://app.localhost:3000/forgot-password');
  });

  it('redirects /reset-password on tenant subdomain to central app gateway via 307 preserving hash or code', async () => {
    const req = new NextRequest('http://acme.localhost:3000/reset-password?code=xyz123', {
      headers: { host: 'acme.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://app.localhost:3000/reset-password?code=xyz123');
  });

  it('serves central app gateway directly without redirect loops when host is app gateway', async () => {
    const req = new NextRequest('http://app.localhost:3000/login', {
      headers: { host: 'app.localhost:3000' },
    });
    const res = await middleware(req);
    // Should NOT redirect to another app gateway URL
    expect(res.status).toBe(200);
  });
});
