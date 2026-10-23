import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../src/middleware';

describe('Middleware /api guards (spec 139: origin check + no-store)', () => {
  const originalRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
  });

  afterEach(() => {
    if (originalRootDomain === undefined) {
      delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    } else {
      process.env.NEXT_PUBLIC_ROOT_DOMAIN = originalRootDomain;
    }
  });

  function apiRequest(
    url: string,
    host: string,
    init: { method?: string; origin?: string } = {}
  ): NextRequest {
    const headers: Record<string, string> = { host };
    if (init.origin !== undefined) headers.origin = init.origin;
    return new NextRequest(url, {
      method: init.method ?? 'GET',
      headers,
    });
  }

  it('passes a mutating request whose Origin matches the request host', async () => {
    const req = apiRequest('http://localhost:3000/api/health', 'localhost:3000', {
      method: 'POST',
      origin: 'http://localhost:3000',
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('rejects a foreign Origin on POST with 403', async () => {
    const req = apiRequest('http://localhost:3000/api/tenant/acme/media', 'localhost:3000', {
      method: 'POST',
      origin: 'https://evil.example.com',
    });
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it.each(['PUT', 'PATCH', 'DELETE'])(
    'rejects a foreign Origin on %s with 403',
    async (method) => {
      const req = apiRequest('http://localhost:3000/api/tenant/acme/media', 'localhost:3000', {
        method,
        origin: 'https://evil.example.com',
      });
      const res = await middleware(req);
      expect(res.status).toBe(403);
    }
  );

  it('does not block a GET request even with a foreign Origin', async () => {
    const req = apiRequest('http://localhost:3000/api/health', 'localhost:3000', {
      method: 'GET',
      origin: 'https://evil.example.com',
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('passes a mutating request with no Origin header (non-browser / webhook clients)', async () => {
    const req = apiRequest('http://localhost:3000/api/health', 'localhost:3000', {
      method: 'POST',
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it.each([
    '/api/connect/facebook/deauthorize',
    '/api/connect/facebook/data-deletion',
  ])('passes a webhook POST with no Origin header: %s', async (path) => {
    const req = apiRequest(`http://localhost:3000${path}`, 'localhost:3000', {
      method: 'POST',
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.status).not.toBe(403);
  });

  it('passes a CSP report POST whose Origin is the page origin (same host)', async () => {
    const req = apiRequest('http://localhost:3000/api/csp-report', 'localhost:3000', {
      method: 'POST',
      origin: 'http://localhost:3000',
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('passes an Origin that is a subdomain of the configured root domain', async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'fbuploadpro.com';
    const req = apiRequest(
      'https://app.fbuploadpro.com/api/tenant/acme/media',
      'app.fbuploadpro.com',
      {
        method: 'POST',
        origin: 'https://acme.fbuploadpro.com',
      }
    );
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('passes an apex root-domain Origin on a tenant host', async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'fbuploadpro.com';
    const req = apiRequest(
      'https://acme.fbuploadpro.com/api/tenant/acme/media',
      'acme.fbuploadpro.com',
      {
        method: 'POST',
        origin: 'https://fbuploadpro.com',
      }
    );
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('passes a localhost subdomain Origin when the root domain is localhost', async () => {
    const req = apiRequest(
      'http://app.localhost:3000/api/tenant/acme/media',
      'app.localhost:3000',
      {
        method: 'POST',
        origin: 'http://acme.localhost:3000',
      }
    );
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('rejects an Origin that merely ends with the root domain string without a dot boundary', async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'fbuploadpro.com';
    const req = apiRequest(
      'https://app.fbuploadpro.com/api/tenant/acme/media',
      'app.fbuploadpro.com',
      {
        method: 'POST',
        origin: 'https://evilfbuploadpro.com',
      }
    );
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it('rejects an opaque "null" Origin on a mutating request', async () => {
    const req = apiRequest('http://localhost:3000/api/tenant/acme/media', 'localhost:3000', {
      method: 'POST',
      origin: 'null',
    });
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it('applies Cache-Control: no-store to /api responses', async () => {
    const req = apiRequest('http://localhost:3000/api/health', 'localhost:3000', {
      method: 'GET',
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('pragma')).toBe('no-cache');
    expect(res.headers.get('expires')).toBe('0');
  });

  it('applies Cache-Control: no-store to a mutating /api response that passes the origin check', async () => {
    const req = apiRequest('http://localhost:3000/api/health', 'localhost:3000', {
      method: 'POST',
      origin: 'http://localhost:3000',
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('applies Cache-Control: no-store to the 403 origin-mismatch response', async () => {
    const req = apiRequest('http://localhost:3000/api/tenant/acme/media', 'localhost:3000', {
      method: 'POST',
      origin: 'https://evil.example.com',
    });
    const res = await middleware(req);
    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('does not apply no-store to non-API system routes served by the same branch', async () => {
    const req = apiRequest('http://localhost:3000/icon', 'localhost:3000', {
      method: 'GET',
    });
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control') ?? '').not.toContain('no-store');
  });
});
