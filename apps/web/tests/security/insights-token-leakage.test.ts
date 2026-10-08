import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  encryptToken,
  signSessionToken,
} from '@fbuploadpro/contracts';
import { handleGetInsights } from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route';
import type { DatabaseClient } from '@fbuploadpro/database';
import { globalInsightsCache } from '../../src/lib/insights/insights-cache';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Security Audit: Insights Zero Token Leakage & Compound Isolation (T179)', () => {
  const userIdA = '11111111-1111-4111-a111-111111111111';
  const userIdB = '22222222-2222-4222-a222-222222222222';
  const pageId = '33333333-3333-4333-a333-333333333333';
  const rawToken = 'EAAB_CLASSIFIED_FACEBOOK_PAGE_ACCESS_TOKEN_XYZ999';

  let validSessionCookieUserA: string;
  let validSessionCookieUserB: string;
  let sampleCiphertext: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    globalInsightsCache.clear();

    const tokenA = await signSessionToken(
      {
        userId: userIdA,
        email: 'user-a@acme.com',
        name: 'User A',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    validSessionCookieUserA = `fbup_session=${tokenA}`;

    const tokenB = await signSessionToken(
      {
        userId: userIdB,
        email: 'user-b@other.com',
        name: 'User B',
        subdomain: 'other',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    validSessionCookieUserB = `fbup_session=${tokenB}`;

    sampleCiphertext = await encryptToken(rawToken, TEST_KEY);
  });

  it('never leaks raw access tokens or encrypted ciphertexts in insights response JSON or headers', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('FROM facebook_pages')) {
          if (params[1] === userIdA) {
            return [
              {
                id: pageId,
                fb_page_id: 'fb_page_99999',
                page_name: 'Acme Official',
                fb_page_access_token: sampleCiphertext,
                status: 'active',
              },
            ];
          }
        }
        return [];
      }),
    } as unknown as DatabaseClient;

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const u = url.toString();
      if (u.includes('fields=fan_count,followers_count')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'fb_page_99999',
            name: 'Acme Official',
            fan_count: 50000,
            followers_count: 55000,
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      };
    });

    const req = new NextRequest(
      'http://localhost:3000/api/tenant/acme/pages/33333333-3333-4333-a333-333333333333/insights',
      {
        headers: {
          cookie: validSessionCookieUserA,
        },
      }
    );

    const res = await handleGetInsights(req, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as any,
    });

    expect(res.status).toBe(200);

    const textBody = await res.text();

    // Strict zero-leakage assertions
    expect(textBody).not.toContain(rawToken);
    expect(textBody).not.toContain(sampleCiphertext);
    expect(textBody).not.toContain('access_token');
    expect(textBody).not.toContain('fb_page_access_token');

    // Headers check
    const headerEntries = Array.from(res.headers.entries());
    for (const [, val] of headerEntries) {
      expect(val).not.toContain(rawToken);
      expect(val).not.toContain(sampleCiphertext);
    }
  });

  it('prevents cross-user insights enumeration by strictly scoping to authenticated user', async () => {
    // User B attempts to access Page belonging to User A
    const mockDb = {
      query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
        // Query strictly requires user_id = $2
        if (params[1] === userIdB) {
          return []; // Not found for User B!
        }
        return [
          {
            id: pageId,
            fb_page_id: 'fb_page_99999',
            page_name: 'Acme Official',
            fb_page_access_token: sampleCiphertext,
            status: 'active',
          },
        ];
      }),
    } as unknown as DatabaseClient;

    const req = new NextRequest(
      'http://localhost:3000/api/tenant/other/pages/33333333-3333-4333-a333-333333333333/insights',
      {
        headers: {
          cookie: validSessionCookieUserB,
        },
      }
    );

    const res = await handleGetInsights(req, 'other', pageId, {
      dbClient: mockDb,
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Page not found');
  });

  it('rejects cross-tenant subdomain tampering with 403 Forbidden', async () => {
    const mockDb = {
      query: vi.fn(),
    } as unknown as DatabaseClient;

    // User A has session for subdomain 'acme', but calls endpoint for 'hacked' subdomain
    const req = new NextRequest(
      'http://localhost:3000/api/tenant/hacked/pages/33333333-3333-4333-a333-333333333333/insights',
      {
        headers: {
          cookie: validSessionCookieUserA,
        },
      }
    );

    const res = await handleGetInsights(req, 'hacked', pageId, {
      dbClient: mockDb,
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const mockDb = {
      query: vi.fn(),
    } as unknown as DatabaseClient;

    const req = new NextRequest(
      'http://localhost:3000/api/tenant/acme/pages/33333333-3333-4333-a333-333333333333/insights'
    );

    const res = await handleGetInsights(req, 'acme', pageId, {
      dbClient: mockDb,
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('cached responses also maintain zero token leakage', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation(async (_sql: string, params: any[]) => {
        if (params[1] === userIdA) {
          return [
            {
              id: pageId,
              fb_page_id: 'fb_page_99999',
              page_name: 'Acme Official',
              fb_page_access_token: sampleCiphertext,
              status: 'active',
            },
          ];
        }
        return [];
      }),
    } as unknown as DatabaseClient;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'fb_page_99999',
        name: 'Acme Official',
        fan_count: 50000,
        followers_count: 55000,
      }),
    });

    const req1 = new NextRequest(
      'http://localhost:3000/api/tenant/acme/pages/33333333-3333-4333-a333-333333333333/insights?range=28d',
      { headers: { cookie: validSessionCookieUserA } }
    );

    // Call 1: cold cache
    const res1 = await handleGetInsights(req1, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as any,
    });
    expect(res1.status).toBe(200);

    // Call 2: cache hit
    const req2 = new NextRequest(
      'http://localhost:3000/api/tenant/acme/pages/33333333-3333-4333-a333-333333333333/insights?range=28d',
      { headers: { cookie: validSessionCookieUserA } }
    );
    const res2 = await handleGetInsights(req2, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as any,
    });
    expect(res2.status).toBe(200);

    const body2Text = await res2.text();
    expect(body2Text).toContain('"cacheHit":true');
    expect(body2Text).not.toContain(rawToken);
    expect(body2Text).not.toContain(sampleCiphertext);
  });
});
