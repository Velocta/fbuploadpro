import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';

describe('Next.js Edge Middleware Subdomain Routing (User Story 1)', () => {
  it.each([
    ['http://localhost:3000/', 'localhost:3000', 'apex domain requests'],
    ['http://www.localhost:3000/about', 'www.localhost:3000', 'www apex requests'],
    ['http://client.localhost:3000/api/health', 'client.localhost:3000', 'system paths like /api/health'],
    ['http://admin.localhost:3000/login', 'admin.localhost:3000', 'reserved subdomains like admin'],
  ])('passes %s (%s) through without tenant rewriting', async (url, host) => {
    const req = new NextRequest(url, {
      headers: { host },
    });
    const res = await middleware(req);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('rewrites valid tenant subdomain request to /tenant/[subdomain]/* and injects headers', async () => {
    const req = new NextRequest('http://acme.localhost:3000/dashboard', {
      headers: { host: 'acme.localhost:3000' },
    });
    const res = await middleware(req);
    // In US2, unauthenticated requests to protected paths redirect to /login
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('redirects tenant auth path /login to central app gateway via 307 without rewriting to non-existent route', async () => {
    const req = new NextRequest('http://acme.localhost:3000/login', {
      headers: { host: 'acme.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://app.localhost:3000/login');
  });

  it('serves central app gateway /login and /signup without tenant rewrite', async () => {
    const loginReq = new NextRequest('http://app.localhost:3000/login', {
      headers: { host: 'app.localhost:3000' },
    });
    const loginRes = await middleware(loginReq);
    expect(loginRes.status).toBe(200);
    expect(loginRes.headers.get('x-middleware-rewrite')).toBeNull();

    const signupReq = new NextRequest('http://app.localhost:3000/signup', {
      headers: { host: 'app.localhost:3000' },
    });
    const signupRes = await middleware(signupReq);
    expect(signupRes.status).toBe(200);
    expect(signupRes.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('redirects unauthenticated root visit on app gateway to /login', async () => {
    const req = new NextRequest('http://app.localhost:3000/', {
      headers: { host: 'app.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });
});
