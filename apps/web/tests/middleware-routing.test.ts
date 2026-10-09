import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';

describe('Next.js Edge Middleware Subdomain Routing (User Story 1)', () => {
  it('passes apex domain requests through without tenant rewriting', async () => {
    const req = new NextRequest('http://localhost:3000/', {
      headers: { host: 'localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('passes www apex requests through without tenant rewriting', async () => {
    const req = new NextRequest('http://www.localhost:3000/about', {
      headers: { host: 'www.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('bypasses tenant rewriting for system paths like /api/health', async () => {
    const req = new NextRequest('http://client.localhost:3000/api/health', {
      headers: { host: 'client.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('bypasses tenant rewriting for reserved subdomains like admin', async () => {
    const req = new NextRequest('http://admin.localhost:3000/login', {
      headers: { host: 'admin.localhost:3000' },
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
