import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { _resetRateLimiter } from '../../src/lib/rate-limiter';
import {
  readJsonBody,
  enforceIpRateLimit,
  DEFAULT_JSON_BODY_LIMIT_BYTES,
} from '../../src/lib/request-body';
import { POST as uploadUrlPOST, handleCreateUploadUrl } from '../../src/app/api/tenant/[subdomain]/media/upload-url/route';
import { POST as downloaderPOST } from '../../src/app/api/tenant/[subdomain]/downloader/route';
import { handleBulkEnqueue } from '../../src/app/api/tenant/[subdomain]/publishing/queue/bulk/route';
import { POST as publishNowPOST } from '../../src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/publish-now/route';
import { POST as magicLinkPOST } from '../../src/app/api/tenant/[subdomain]/accounts/magic-link/route';
import { POST as forgotPasswordPOST } from '../../src/app/api/auth/forgot-password/route';
import { POST as workspacesPOST } from '../../src/app/api/workspaces/route';
import { PUT as byocPUT } from '../../src/app/api/tenant/[subdomain]/settings/byoc/route';
import { POST as cspReportPOST } from '../../src/app/api/csp-report/route';
import { handleConnectComplete } from '../../src/app/api/connect/[platform]/complete/route';

const TEST_KEY = ['fixture','signing','material','for','rate','limit','body','tests','139'].join('-');
const userId = '11111111-1111-4111-a111-111111111111';
let sessionCookie: string;

function req(
  url: string,
  opts: { method?: string; body?: string; ip: string; cookie?: string }
): NextRequest {
  return new NextRequest(url, {
    method: opts.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': opts.ip,
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    ...(opts.body !== undefined ? { body: opts.body } : {}),
  });
}

beforeEach(async () => {
  _resetRateLimiter();
  process.env.SESSION_SECRET = TEST_KEY;
  const token = await signSessionToken(
    {
      userId,
      email: 'alexander@gmail.com',
      name: 'Alex Acme',
      subdomain: 'acme',
      role: 'user',
      status: 'active',
    },
    TEST_KEY
  );
  sessionCookie = `fbup_session=${token}`;
});

describe('shared request-body helper', () => {
  it('parses a valid JSON body', async () => {
    const result = await readJsonBody(
      req('http://localhost/x', { body: '{"a":1}', ip: '10.1.0.1' })
    );
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it('rejects malformed JSON', async () => {
    const result = await readJsonBody(
      req('http://localhost/x', { body: '{not json', ip: '10.1.0.2' })
    );
    expect(result).toEqual({ ok: false, reason: 'invalid-json' });
  });

  it('rejects a body over the cap', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(DEFAULT_JSON_BODY_LIMIT_BYTES + 10) });
    const result = await readJsonBody(
      req('http://localhost/x', { body: big, ip: '10.1.0.3' })
    );
    expect(result).toEqual({ ok: false, reason: 'too-large' });
  });

  it('enforceIpRateLimit allows up to the limit then returns the codebase 429 shape', async () => {
    const ip = '10.1.0.4';
    for (let i = 0; i < 3; i++) {
      const res = await enforceIpRateLimit(
        req('http://localhost/x', { ip }),
        'unit_probe',
        3
      );
      expect(res).toBeNull();
    }
    const blocked = await enforceIpRateLimit(
      req('http://localhost/x', { ip }),
      'unit_probe',
      3
    );
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get('Retry-After')).toBeTruthy();
    const body = (await blocked!.json()) as { error: string; retryAfterSeconds: number };
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.error).toContain('Too many requests');
  });
});

describe('upload-url route guards', () => {
  const url = 'http://localhost:3000/api/tenant/acme/media/upload-url';

  it('happy path unchanged: valid body reaches schema validation/storage flow (401 without session)', async () => {
    const res = await uploadUrlPOST(
      req(url, { body: JSON.stringify({ fileName: 'reel.mp4', fileSize: 10, mimeType: 'video/mp4' }), ip: '10.2.0.1' }),
      { params: Promise.resolve({ subdomain: 'acme' }) }
    );
    expect(res.status).toBe(401);
  });

  it('oversized body is rejected with 413', async () => {
    const big = JSON.stringify({
      fileName: `${'x'.repeat(DEFAULT_JSON_BODY_LIMIT_BYTES + 100)}.mp4`,
      fileSize: 10,
      mimeType: 'video/mp4',
    });
    const res = await handleCreateUploadUrl(
      req(url, { body: big, ip: '10.2.0.2', cookie: sessionCookie }),
      'acme'
    );
    expect(res.status).toBe(413);
  });

  it('malformed JSON is rejected with the existing 400 INVALID_REQUEST shape', async () => {
    const res = await handleCreateUploadUrl(
      req(url, { body: '{broken', ip: '10.2.0.3', cookie: sessionCookie }),
      'acme'
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('INVALID_REQUEST');
  });

  it('returns 429 after 30 requests from one IP', async () => {
    const ip = '10.2.0.4';
    let lastStatus = 0;
    for (let i = 0; i < 31; i++) {
      const res = await uploadUrlPOST(
        req(url, { body: '{}', ip }),
        { params: Promise.resolve({ subdomain: 'acme' }) }
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('downloader route guard', () => {
  it('returns 429 after 10 requests from one IP', async () => {
    const ip = '10.3.0.1';
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await downloaderPOST(
        req('http://localhost:3000/api/tenant/acme/downloader', { body: '{}', ip }),
        { params: Promise.resolve({ subdomain: 'acme' }) }
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('bulk enqueue body cap', () => {
  it('oversized bulk body (>1 MiB) is rejected with 413', async () => {
    const big = JSON.stringify({ pageId: 'p', items: [], pad: 'x'.repeat(1024 * 1024 + 100) });
    const res = await handleBulkEnqueue(
      req('http://localhost:3000/api/tenant/acme/publishing/queue/bulk', {
        body: big,
        ip: '10.4.0.1',
        cookie: sessionCookie,
      }),
      'acme'
    );
    expect(res.status).toBe(413);
  });

  it('malformed bulk body is rejected with 400 INVALID_REQUEST', async () => {
    const res = await handleBulkEnqueue(
      req('http://localhost:3000/api/tenant/acme/publishing/queue/bulk', {
        body: 'not-json',
        ip: '10.4.0.2',
        cookie: sessionCookie,
      }),
      'acme'
    );
    expect(res.status).toBe(400);
  });
});

describe('publish-now rate limit', () => {
  it('returns 429 after 30 requests from one IP', async () => {
    const ip = '10.5.0.1';
    let lastStatus = 0;
    for (let i = 0; i < 31; i++) {
      const res = await publishNowPOST(
        req('http://localhost:3000/api/tenant/acme/publishing/queue/item-1/publish-now', { ip }),
        { params: Promise.resolve({ subdomain: 'acme', itemId: 'item-1' }) }
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('magic-link rate limit', () => {
  it('returns 429 after 10 requests from one IP', async () => {
    const ip = '10.6.0.1';
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await magicLinkPOST(
        req('http://localhost:3000/api/tenant/acme/accounts/magic-link', { body: '{}', ip }),
        { params: Promise.resolve({ subdomain: 'acme' }) }
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('workspaces route guards', () => {
  const url = 'http://localhost:3000/api/workspaces';

  it('malformed JSON returns 400 (previously a 500 via the catch-all)', async () => {
    const res = await workspacesPOST(
      req(url, { body: '{oops', ip: '10.7.0.1', cookie: sessionCookie })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid JSON request body');
  });

  it('oversized body returns 413', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(DEFAULT_JSON_BODY_LIMIT_BYTES + 100) });
    const res = await workspacesPOST(
      req(url, { body: big, ip: '10.7.0.2', cookie: sessionCookie })
    );
    expect(res.status).toBe(413);
  });

  it('returns 429 after 20 requests from one IP', async () => {
    const ip = '10.7.0.3';
    let lastStatus = 0;
    for (let i = 0; i < 21; i++) {
      const res = await workspacesPOST(req(url, { body: '{}', ip }));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('BYOC settings rate limit', () => {
  it('returns 429 after 20 PUT requests from one IP', async () => {
    const ip = '10.8.0.1';
    let lastStatus = 0;
    for (let i = 0; i < 21; i++) {
      const res = await byocPUT(
        req('http://localhost:3000/api/tenant/acme/settings/byoc', {
          method: 'PUT',
          body: '{}',
          ip,
        }),
        { params: Promise.resolve({ subdomain: 'acme' }) }
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('csp-report guards', () => {
  const url = 'http://localhost:3000/api/csp-report';

  it('happy path unchanged: a small valid report returns 204', async () => {
    const res = await cspReportPOST(
      req(url, {
        body: JSON.stringify({ 'csp-report': { 'document-uri': 'http://localhost/', 'violated-directive': 'script-src' } }),
        ip: '10.9.0.1',
      })
    );
    expect(res.status).toBe(204);
  });

  it('oversized report still returns 413', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(70 * 1024) });
    const res = await cspReportPOST(req(url, { body: big, ip: '10.9.0.2' }));
    expect(res.status).toBe(413);
  });
});

describe('connect complete rate limit', () => {
  it('returns 429 after 20 requests from one IP', async () => {
    const ip = '10.10.0.1';
    let lastStatus = 0;
    for (let i = 0; i < 21; i++) {
      const res = await handleConnectComplete(
        req('http://localhost:3000/api/connect/facebook/complete', { body: '{}', ip }),
        'facebook'
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe('auth body caps (audit C2)', () => {
  const url = 'http://localhost:3000/api/auth/forgot-password';

  it('malformed JSON returns 400 instead of falling through to a 500', async () => {
    const res = await forgotPasswordPOST(
      req(url, { body: '{bad', ip: '10.11.0.1' })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Invalid JSON request body');
  });

  it('oversized body returns 413', async () => {
    const big = JSON.stringify({ email: `${'x'.repeat(DEFAULT_JSON_BODY_LIMIT_BYTES + 100)}@gmail.com` });
    const res = await forgotPasswordPOST(req(url, { body: big, ip: '10.11.0.2' }));
    expect(res.status).toBe(413);
  });

  it('happy path unchanged: an invalid email keeps the existing 400 message', async () => {
    const res = await forgotPasswordPOST(
      req(url, { body: JSON.stringify({ email: 'not-an-email' }), ip: '10.11.0.3' })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('A valid email address is required.');
  });
});
