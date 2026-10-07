import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { middleware } from '../src/middleware';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Next.js Edge Middleware Session Authentication & Tenant Isolation (User Story 2)', () => {
  let userToken: string;
  let otherTenantToken: string;
  let adminToken: string;
  let suspendedToken: string;

  beforeAll(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';

    userToken = await signSessionToken(
      {
        userId: '11111111-1111-4111-a111-111111111111',
        email: 'user@acme.com',
        name: 'Acme User',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );

    otherTenantToken = await signSessionToken(
      {
        userId: '22222222-2222-4222-a222-222222222222',
        email: 'user@beta.com',
        name: 'Beta User',
        subdomain: 'beta',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );

    adminToken = await signSessionToken(
      {
        userId: '33333333-3333-4333-a333-333333333333',
        email: 'admin@platform.com',
        name: 'Admin User',
        subdomain: 'platform-admin',
        role: 'admin',
        status: 'active',
      },
      TEST_SECRET
    );

    suspendedToken = await signSessionToken(
      {
        userId: '44444444-4444-4444-a444-444444444444',
        email: 'suspended@acme.com',
        name: 'Suspended Acme User',
        subdomain: 'acme',
        role: 'user',
        status: 'suspended',
      },
      TEST_SECRET
    );
  });

  it('redirects unauthenticated request on tenant protected route to login', async () => {
    const req = new NextRequest('http://acme.localhost:3000/dashboard', {
      headers: { host: 'acme.localhost:3000' },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('returnUrl');
  });

  it('redirects suspended user to account-suspended notice', async () => {
    const req = new NextRequest('http://acme.localhost:3000/dashboard', {
      headers: {
        host: 'acme.localhost:3000',
        cookie: `fbup_session=${suspendedToken}`,
      },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/account-suspended');
  });

  it('blocks cross-tenant access and redirects standard user to their own workspace', async () => {
    // User belonging to 'beta' tries to access 'acme'
    const req = new NextRequest('http://acme.localhost:3000/dashboard', {
      headers: {
        host: 'acme.localhost:3000',
        cookie: `fbup_session=${otherTenantToken}`,
      },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('beta.localhost:3000/dashboard');
  });

  it('allows access for matching tenant subdomain and injects session headers', async () => {
    const req = new NextRequest('http://acme.localhost:3000/dashboard', {
      headers: {
        host: 'acme.localhost:3000',
        cookie: `fbup_session=${userToken}`,
      },
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    const rewriteUrl = res.headers.get('x-middleware-rewrite');
    expect(rewriteUrl).not.toBeNull();
    expect(new URL(rewriteUrl!).pathname).toBe('/tenant/acme/dashboard');
  });

  it('allows cross-tenant inspection access for admin role', async () => {
    // Admin with subdomain 'platform-admin' accessing 'acme' tenant
    const req = new NextRequest('http://acme.localhost:3000/dashboard', {
      headers: {
        host: 'acme.localhost:3000',
        cookie: `fbup_session=${adminToken}`,
      },
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    const rewriteUrl = res.headers.get('x-middleware-rewrite');
    expect(rewriteUrl).not.toBeNull();
    expect(new URL(rewriteUrl!).pathname).toBe('/tenant/acme/dashboard');
  });
});
