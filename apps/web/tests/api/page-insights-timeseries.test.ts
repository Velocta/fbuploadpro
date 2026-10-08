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

describe('Facebook Page Insights Time-Series API (User Story 2 - T159, T162)', () => {
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

  it('returns continuous chronological time-series points for range=7d with filled gaps', async () => {
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
      if (url.includes('fields=name,fan_count')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              name: 'Viral Cooking Daily',
              fan_count: 24500,
              followers_count: 28900,
            }),
        });
      }

      if (url.includes('/insights?metric=')) {
        const today = new Date().toISOString().slice(0, 10);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  name: 'page_video_views',
                  values: [
                    { end_time: `${today}T07:00:00+0000`, value: 1250 },
                  ],
                },
                {
                  name: 'page_video_complete_views_30s',
                  values: [
                    { end_time: `${today}T07:00:00+0000`, value: 680 },
                  ],
                },
                {
                  name: 'page_video_view_time',
                  values: [
                    { end_time: `${today}T07:00:00+0000`, value: 180000 }, // 3 minutes in ms
                  ],
                },
                {
                  name: 'page_daily_follows_unique',
                  values: [
                    { end_time: `${today}T07:00:00+0000`, value: 42 },
                  ],
                },
              ],
            }),
        });
      }

      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const request = new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=7d`,
      { headers: { cookie: validSessionCookie } }
    );

    const res = await handleGetInsights(request, 'acme', pageId, {
      dbClient: mockDb,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.timeSeries).toHaveLength(7);
    expect(body.dateRange).toBe('7d');
    expect(body.overview.totalVideoViews).toBe(1250);

    // Verify today's point contains the parsed values
    const today = new Date().toISOString().slice(0, 10);
    const todayPoint = body.timeSeries.find((p: { date: string }) => p.date === today);
    expect(todayPoint).toBeDefined();
    expect(todayPoint?.videoViews).toBe(1250);
    expect(todayPoint?.videoCompleteViews30s).toBe(680);
    expect(todayPoint?.videoViewTimeMinutes).toBe(3);
    expect(todayPoint?.dailyFollowsUnique).toBe(42);
  });

  it('returns 14, 28, and 90 data points for respective range parameters', async () => {
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

    for (const r of ['14d', '28d', '90d'] as const) {
      const request = new NextRequest(
        `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=${r}`,
        { headers: { cookie: validSessionCookie } }
      );
      const res = await handleGetInsights(request, 'acme', pageId, {
        dbClient: mockDb,
        fetchImpl: mockFetch as unknown as typeof fetch,
      });
      const body = await res.json();
      const expectedLen = r === '14d' ? 14 : r === '28d' ? 28 : 90;
      expect(body.timeSeries).toHaveLength(expectedLen);
    }
  });
});
