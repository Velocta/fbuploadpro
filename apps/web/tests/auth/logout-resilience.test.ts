import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware';
import { signSessionToken } from '@fbuploadpro/contracts';

describe('Logout Resilience & bfcache Mitigation (Spec 021 US2)', () => {
  const sessionSecret = 'super-secret-session-signing-key-minimum-32-chars-long';
  let validToken: string;

  beforeAll(async () => {
    process.env.SESSION_SECRET = sessionSecret;
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';

    validToken = await signSessionToken(
      {
        userId: '11111111-1111-4111-a111-111111111111',
        email: 'user@gmail.com',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      sessionSecret,
      3600
    );
  });

  it('redirects authenticated user to workspace root when visiting app /login without logout flag', async () => {
    const req = new NextRequest('http://app.localhost:3000/login', {
      headers: { host: 'app.localhost:3000' },
    });
    req.cookies.set('fbup_session', validToken);

    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://acme.localhost:3000/');
  });

  it('bypasses auto-redirect to workspace when visiting app /login with ?logout=success', async () => {
    // Simulates user clicking logout while offline, where cookie still lingers in request
    const req = new NextRequest('http://app.localhost:3000/login?logout=success', {
      headers: { host: 'app.localhost:3000' },
    });
    req.cookies.set('fbup_session', validToken);

    const res = await middleware(req);
    // Must NOT redirect to acme.localhost:3000/, must permit login form to render
    expect(res.status).toBe(200);
  });

  it('sets Cache-Control: no-store on authenticated tenant workspace views to prevent bfcache leaks', async () => {
    const req = new NextRequest('http://acme.localhost:3000/', {
      headers: { host: 'acme.localhost:3000' },
    });
    req.cookies.set('fbup_session', validToken);

    const res = await middleware(req);
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('must-revalidate');

    const pragma = res.headers.get('Pragma');
    expect(pragma).toBe('no-cache');
  });

  it('redirects cross-tenant subdomain manual mismatch with tenant_redirect notice', async () => {
    // User acme manually types beta.localhost:3000
    const req = new NextRequest('http://beta.localhost:3000/', {
      headers: { host: 'beta.localhost:3000' },
    });
    req.cookies.set('fbup_session', validToken);

    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://acme.localhost:3000/');
  });
});
