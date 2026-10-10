import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';

describe('Middleware Subdomain Auth Redirection (Spec 013 - Eliminate 404s)', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
  });

  it.each([
    ['http://acme.localhost:3000/login?returnUrl=%2Fdashboard%2Fmedia', 'http://app.localhost:3000/login?returnUrl=%2Fdashboard%2Fmedia'],
    ['http://acme.localhost:3000/signup?plan=pro&returnUrl=%2Fqueue', 'http://app.localhost:3000/signup?plan=pro&returnUrl=%2Fqueue'],
    ['http://acme.localhost:3000/forgot-password', 'http://app.localhost:3000/forgot-password'],
    ['http://acme.localhost:3000/reset-password?code=xyz123', 'http://app.localhost:3000/reset-password?code=xyz123'],
  ])('redirects %s on tenant subdomain to central app gateway %s via 307', async (inputUrl, expectedLocation) => {
    const req = new NextRequest(inputUrl, {
      headers: { host: 'acme.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe(expectedLocation);
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
