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

describe('Facebook Page Insights Reactions & Demographics API (User Story 3 - T163, T166)', () => {
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

  it('correctly aggregates sentiment reactions and calculates total reactions', async () => {
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

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('period=days_28')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  name: 'page_actions_post_reactions_like_total',
                  values: [{ value: 500 }],
                },
                {
                  name: 'page_actions_post_reactions_love_total',
                  values: [{ value: 120 }],
                },
                {
                  name: 'page_actions_post_reactions_wow_total',
                  values: [{ value: 30 }],
                },
                {
                  name: 'page_actions_post_reactions_haha_total',
                  values: [{ value: 15 }],
                },
                {
                  name: 'page_actions_post_reactions_sorry_total',
                  values: [{ value: 5 }],
                },
                {
                  name: 'page_actions_post_reactions_anger_total',
                  values: [{ value: 2 }],
                },
                {
                  name: 'page_follows_country',
                  values: [{ value: { US: 800, PK: 400, GB: 200 } }],
                },
                {
                  name: 'page_follows_city',
                  values: [
                    {
                      value: {
                        'New York, NY': 300,
                        'Lahore, Pakistan': 200,
                        'London, England': 100,
                      },
                    },
                  ],
                },
              ],
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    });

    const request = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=28d`,
      { headers: { cookie: validSessionCookie } }
    );

    const res = await handleGetInsights(request, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.reactions.like).toBe(500);
    expect(body.reactions.love).toBe(120);
    expect(body.reactions.wow).toBe(30);
    expect(body.reactions.haha).toBe(15);
    expect(body.reactions.sorry).toBe(5);
    expect(body.reactions.anger).toBe(2);
    expect(body.reactions.total).toBe(672);
    expect(body.overview.totalPostEngagements).toBe(672);

    // Demographics assertions
    expect(body.demographics.topCountries).toHaveLength(3);
    expect(body.demographics.topCountries[0].name).toBe('US');
    expect(body.demographics.topCountries[0].count).toBe(800);
    // 800 / 1400 * 100 = 57.1%
    expect(body.demographics.topCountries[0].percentage).toBe(57.1);

    expect(body.demographics.topCities).toHaveLength(3);
    expect(body.demographics.topCities[0].name).toBe('New York, NY');
    expect(body.demographics.topCities[0].count).toBe(300);
    // 300 / 600 * 100 = 50%
    expect(body.demographics.topCities[0].percentage).toBe(50);
  });

  it('handles missing or empty demographics dictionary gracefully', async () => {
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
      json: () => Promise.resolve({ data: [] }),
    });

    const request = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=28d`,
      { headers: { cookie: validSessionCookie } }
    );

    const res = await handleGetInsights(request, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.demographics.topCountries).toEqual([]);
    expect(body.demographics.topCities).toEqual([]);
    expect(body.reactions.total).toBe(0);
  });
});
