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

  it('rewrites tenant public path /login without redirect', async () => {
    const req = new NextRequest('http://acme.localhost:3000/login', {
      headers: { host: 'acme.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    const rewriteUrl = res.headers.get('x-middleware-rewrite');
    expect(rewriteUrl).not.toBeNull();
    expect(new URL(rewriteUrl!).pathname).toBe('/tenant/acme/login');
  });
});
