import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  encryptToken,
  signSessionToken,
} from '@fbuploadpro/contracts';
import { handleGetInsights } from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route';
import { globalInsightsCache } from '../../src/lib/insights/insights-cache';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Facebook Page Insights Overview API (User Story 1 - T154, T158)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const pageId = '22222222-2222-4222-a222-222222222222';
  const fbPageId = '846840138502516';
  let validSessionCookie: string;
  let sampleEncryptedPageToken: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

    globalInsightsCache.clear();

    const token = await signSessionToken(
      {
        userId,
        email: 'alex@acme.com',
        name: 'Alex Acme',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    validSessionCookie = `fbup_session=${token}`;

    sampleEncryptedPageToken = await encryptToken(
      'mock_raw_fb_page_access_token_secret',
      TEST_ENCRYPTION_KEY
    );
  });

  it('fetches overview KPIs via Graph API v26.0, returns 200, and never leaks tokens', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM facebook_pages')) {
          return Promise.resolve([
            {
              id: pageId,
              user_id: userId,
              fb_page_id: fbPageId,
              page_name: 'Viral Cooking Daily',
              fb_page_access_token: sampleEncryptedPageToken,
              status: 'active',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DatabaseClient;

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      expect(url).toContain('graph.facebook.com/v26.0');
      expect(url).toContain(fbPageId);
      expect(url).toContain('fields=name,fan_count,followers_count,picture.type(large)');
      expect(url).toContain('access_token=mock_raw_fb_page_access_token_secret');

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            name: 'Viral Cooking Daily',
            fan_count: 24500,
            followers_count: 28900,
            picture: {
              data: {
                url: 'https://cdn.facebook.com/pages/cooking.jpg',
              },
            },
          }),
      });
    });

    const request = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=28d`,
      {
        headers: {
          cookie: validSessionCookie,
        },
      }
    );

    const res = await handleGetInsights(request, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.fbPageId).toBe(fbPageId);
    expect(body.dateRange).toBe('28d');
    expect(body.cacheHit).toBe(false);
    expect(body.overview.fanCount).toBe(24500);
    expect(body.overview.followersCount).toBe(28900);
    expect(body.overview.pageName).toBe('Viral Cooking Daily');
    expect(body.overview.pageImage).toBe('https://cdn.facebook.com/pages/cooking.jpg');
    expect(body.healthStatus).toBe('active');

    // Security assertion: Zero token leakage
    const bodyString = JSON.stringify(body);
    expect(bodyString).not.toContain('mock_raw_fb_page_access_token_secret');
    expect(bodyString).not.toContain(sampleEncryptedPageToken);
    expect(bodyString).not.toContain('token');
  });

  it('serves cached metrics on repeated calls within TTL', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue([
        {
          id: pageId,
          user_id: userId,
          fb_page_id: fbPageId,
          page_name: 'Viral Cooking Daily',
          fb_page_access_token: sampleEncryptedPageToken,
          status: 'active',
        },
      ]),
    } as unknown as DatabaseClient;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          name: 'Viral Cooking Daily',
          fan_count: 24500,
          followers_count: 28900,
        }),
    });

    const req1 = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=28d`,
      { headers: { cookie: validSessionCookie } }
    );
    const res1 = await handleGetInsights(req1, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.cacheHit).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Call again - should hit cache
    const req2 = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=28d`,
      { headers: { cookie: validSessionCookie } }
    );
    const res2 = await handleGetInsights(req2, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.cacheHit).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2); // not called again
  });

  it('bypasses cache when refresh=true query parameter is present', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue([
        {
          id: pageId,
          user_id: userId,
          fb_page_id: fbPageId,
          page_name: 'Viral Cooking Daily',
          fb_page_access_token: sampleEncryptedPageToken,
          status: 'active',
        },
      ]),
    } as unknown as DatabaseClient;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          name: 'Viral Cooking Daily',
          fan_count: 24500,
          followers_count: 28900,
        }),
    });

    const req1 = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=28d`,
      { headers: { cookie: validSessionCookie } }
    );
    await handleGetInsights(req1, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Call with refresh=true
    const req2 = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=28d&refresh=true`,
      { headers: { cookie: validSessionCookie } }
    );
    const res2 = await handleGetInsights(req2, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.cacheHit).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('rejects unauthorized requests missing valid session cookie with 401', async () => {
    const request = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights`
    );
    const res = await handleGetInsights(request, 'acme', pageId);
    expect(res.status).toBe(401);
  });

  it('rejects cross-tenant subdomain tampering with 403', async () => {
    const request = new NextRequest(
      `https://othercorp.fbuploadpro.com/api/tenant/othercorp/pages/${pageId}/insights`,
      { headers: { cookie: validSessionCookie } }
    );
    const res = await handleGetInsights(request, 'othercorp', pageId);
    expect(res.status).toBe(403);
  });

  it('returns 404 if page does not exist or belongs to another user', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue([]),
    } as unknown as DatabaseClient;

    const request = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights`,
      { headers: { cookie: validSessionCookie } }
    );
    const res = await handleGetInsights(request, 'acme', pageId, { dbClient: mockDb });
    expect(res.status).toBe(404);
  });

  it('maps Facebook OAuth invalid_token error code to healthStatus="invalid_token"', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue([
        {
          id: pageId,
          user_id: userId,
          fb_page_id: fbPageId,
          page_name: 'Viral Cooking Daily',
          fb_page_access_token: sampleEncryptedPageToken,
          status: 'active',
        },
      ]),
    } as unknown as DatabaseClient;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: {
            message: 'Error validating access token: Session has expired.',
            type: 'OAuthException',
            code: 190,
            error_subcode: 463,
          },
        }),
    });

    const request = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights`,
      { headers: { cookie: validSessionCookie } }
    );
    const res = await handleGetInsights(request, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.healthStatus).toBe('invalid_token');
  });
});
