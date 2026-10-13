import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encryptToken } from '@fbuploadpro/contracts';
import { syncDailyPageInsights, type InsightsSyncDbClient } from '../src/insights-sync.js';
import { handleScheduled, type Env } from '../src/index.js';

const TEST_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('User Story 5 - Worker Daily Page Insights Snapshot Sync', () => {
  let mockDb: InsightsSyncDbClient;
  let upsertedSnapshots: any[];
  let queryLog: Array<{ text: string; params: any[] }>;

  beforeEach(() => {
    upsertedSnapshots = [];
    queryLog = [];

    mockDb = {
      query: vi.fn().mockImplementation(async (text: string, params?: any[]) => {
        queryLog.push({ text, params: params || [] });

        if (text.includes('FROM facebook_pages') && text.includes("status = 'active'")) {
          const encrypted = await encryptToken('EAA_TEST_PAGE_TOKEN_VALID', TEST_MASTER_KEY);
          return [
            {
              id: 'page-uuid-1',
              user_id: 'user-uuid-1',
              fb_page_id: 'fb-page-12345',
              page_name: 'Tech World',
              encrypted_access_token: encrypted,
              status: 'active',
            },
          ];
        }

        return [];
      }),
      upsertPageInsightsSnapshot: vi.fn().mockImplementation(async (snapshot: any) => {
        upsertedSnapshots.push(snapshot);
      }),
    };
  });

  it('queries active pages, decrypts tokens, and upserts snapshots into PostgreSQL (T175)', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const urlStr = url.toString();

      // Page Overview
      if (urlStr.includes('fields=fan_count,followers_count')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'fb-page-12345',
            name: 'Tech World',
            fan_count: 14500,
            followers_count: 15200,
          }),
        };
      }

      // Page Time-Series Insights
      if (urlStr.includes('metric=page_daily_follows_unique')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                name: 'page_daily_follows_unique',
                period: 'day',
                values: [{ value: 75, end_time: '2026-03-01T08:00:00+0000' }],
              },
              {
                name: 'page_daily_unfollows_unique',
                period: 'day',
                values: [{ value: 12, end_time: '2026-03-01T08:00:00+0000' }],
              },
              {
                name: 'page_views_total',
                period: 'day',
                values: [{ value: 3400, end_time: '2026-03-01T08:00:00+0000' }],
              },
              {
                name: 'page_video_views',
                period: 'day',
                values: [{ value: 1800, end_time: '2026-03-01T08:00:00+0000' }],
              },
              {
                name: 'page_video_complete_views_30s',
                period: 'day',
                values: [{ value: 890, end_time: '2026-03-01T08:00:00+0000' }],
              },
              {
                name: 'page_video_view_time',
                period: 'day',
                values: [{ value: 126000, end_time: '2026-03-01T08:00:00+0000' }],
              },
            ],
          }),
        };
      }

      // Reactions & Demographics
      if (urlStr.includes('metric=page_actions_post_reactions_like_total')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                name: 'page_actions_post_reactions_like_total',
                values: [{ value: 120 }],
              },
              {
                name: 'page_actions_post_reactions_love_total',
                values: [{ value: 45 }],
              },
              {
                name: 'page_fans_country',
                values: [{ value: { US: 500, GB: 200 } }],
              },
              {
                name: 'page_fans_city',
                values: [{ value: { 'New York, NY': 150 } }],
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });

    const result = await syncDailyPageInsights({
      db: mockDb,
      masterKey: TEST_MASTER_KEY,
      fetchImpl: mockFetch as any,
      targetDate: '2026-03-01',
    });

    expect(result.totalEligible).toBe(1);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);

    expect(upsertedSnapshots).toHaveLength(1);
    const snapshot = upsertedSnapshots[0];
    expect(snapshot.userId).toBe('user-uuid-1');
    expect(snapshot.fbPageId).toBe('fb-page-12345');
    expect(snapshot.snapshotDate).toBe('2026-03-01');
    expect(snapshot.fanCount).toBe(14500);
    expect(snapshot.followersCount).toBe(15200);
    expect(snapshot.dailyFollows).toBe(75);
    expect(snapshot.dailyUnfollows).toBe(12);
    expect(snapshot.mediaViews).toBe(3400);
    expect(snapshot.videoViews).toBe(1800);
    expect(snapshot.videoCompleteViews30s).toBe(890);
    expect(snapshot.reactionsSummary).toBeDefined();
    expect(snapshot.demographicsSummary).toBeDefined();

    const updateFollowersQuery = queryLog.find(
      (q) => q.text.includes('UPDATE facebook_pages') && q.text.includes('SET current_followers = $1')
    );
    expect(updateFollowersQuery).toBeDefined();
    expect(updateFollowersQuery?.params).toEqual([15200, 'page-uuid-1']);
  });

  it('verifies 4 security and data-corruption fixes in insights sync (Audit Issue 18)', async () => {
    const fetchCalls: Array<{ url: string; options?: any }> = [];

    const mockFetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
      const urlStr = url.toString();
      fetchCalls.push({ url: urlStr, options });

      if (urlStr.includes('fields=fan_count,followers_count')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'fb-page-12345',
            name: 'Tech World',
            fan_count: 5000,
            followers_count: 5200,
          }),
        };
      }

      if (urlStr.includes('metric=page_daily_follows_unique')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                name: 'page_video_view_time',
                period: 'day',
                values: [{ value: 3500 }], // 3500 ms -> should convert to 4 seconds (Math.round(3500/1000))
              },
            ],
          }),
        };
      }

      if (urlStr.includes('metric=page_actions_post_reactions_like_total')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [],
          }),
        };
      }

      return { ok: true, status: 200, json: async () => ({}) };
    });

    const result = await syncDailyPageInsights({
      db: mockDb,
      masterKey: TEST_MASTER_KEY,
      fetchImpl: mockFetch as any,
      targetDate: '2026-03-01',
    });

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);

    // 1. Token passed in Authorization: Bearer header, never in URL
    for (const call of fetchCalls) {
      expect(call.url).not.toContain('access_token=');
      expect(call.options?.headers?.Authorization).toBe('Bearer EAA_TEST_PAGE_TOKEN_VALID');
    }

    // 2. targetDate passed as since/until timestamps
    const metricsCall = fetchCalls.find((c) => c.url.includes('metric=page_daily_follows_unique'));
    expect(metricsCall).toBeDefined();
    const metricsUrl = new URL(metricsCall!.url);
    const expectedSince = String(Math.floor(new Date('2026-03-01T00:00:00Z').getTime() / 1000));
    const expectedUntil = String(Math.floor(new Date('2026-03-01T23:59:59Z').getTime() / 1000));
    expect(metricsUrl.searchParams.get('since')).toBe(expectedSince);
    expect(metricsUrl.searchParams.get('until')).toBe(expectedUntil);

    // 3. Math.round(ms / 1000) for watch time (3500 ms -> 4 seconds)
    expect(upsertedSnapshots[0].videoViewTimeSeconds).toBe(4);
  });

  it('throws on non-OK Graph API response and marks page sync failed without corrupting database snapshot (Audit Issue 18)', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes('fields=fan_count,followers_count')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ fan_count: 5000, followers_count: 5200 }),
        };
      }
      if (urlStr.includes('metric=page_daily_follows_unique')) {
        // Daily metrics fails with 500
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Internal Facebook error' } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const result = await syncDailyPageInsights({
      db: mockDb,
      masterKey: TEST_MASTER_KEY,
      fetchImpl: mockFetch as any,
      targetDate: '2026-03-01',
    });

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].error).toContain('Internal Facebook error');
    // Ensure zero corrupted snapshots were upserted
    expect(upsertedSnapshots).toHaveLength(0);
  });

  it('gracefully handles Graph API rate limits or 5xx errors without crashing (T175)', async () => {
    const errorFetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: {
            message: 'Application request limit reached',
            code: 4,
          },
        }),
      };
    });

    const result = await syncDailyPageInsights({
      db: mockDb,
      masterKey: TEST_MASTER_KEY,
      fetchImpl: errorFetch as any,
      targetDate: '2026-03-01',
    });

    expect(result.totalEligible).toBe(1);
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].pageId).toBe('fb-page-12345');
    expect(result.errors[0].error).toContain('limit reached');
  });

  it('integrates with worker scheduled handler (T177)', async () => {
    const dummyEnv: Env = {
      ENVIRONMENT: 'test',
      FB_ENCRYPTION_MASTER_KEY: TEST_MASTER_KEY,
      FB_GRAPH_API_URL: 'https://graph.facebook.com/v26.0',
    };

    const dummyController: ScheduledController = {
      cron: '0 2 * * *',
      scheduledTime: Date.now(),
      noRetry: () => {},
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        fan_count: 1000,
        followers_count: 1200,
      }),
    });

    await handleScheduled(dummyController, dummyEnv, undefined, {
      db: mockDb as any,
      syncInsights: true,
      insightsFetchImpl: mockFetch as any,
    });

    expect(mockDb.query).toHaveBeenCalled();
  });

  it('bounds concurrency and processes pages in chunks (Audit Issue 19)', async () => {
    const encrypted = await encryptToken('EAA_TEST_PAGE_TOKEN_VALID', TEST_MASTER_KEY);
    const mockPages = Array.from({ length: 12 }, (_, i) => ({
      id: `page-uuid-${i}`,
      user_id: `user-uuid-${i}`,
      fb_page_id: `fb-page-${i}`,
      page_name: `Page ${i}`,
      encrypted_access_token: encrypted,
      status: 'active',
    }));

    const batchDb: InsightsSyncDbClient = {
      query: vi.fn().mockImplementation(async (text: string) => {
        if (text.includes('FROM facebook_pages') && text.includes("status = 'active'")) {
          return mockPages;
        }
        return [];
      }),
      upsertPageInsightsSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    let activeRequests = 0;
    let maxConcurrentRequests = 0;

    const mockFetch = vi.fn().mockImplementation(async () => {
      activeRequests += 1;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);
      // Simulate asynchronous delay
      await new Promise((resolve) => setTimeout(resolve, 15));
      activeRequests -= 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          fan_count: 500,
          followers_count: 600,
          data: [],
        }),
      };
    });

    // Test with concurrency = 3
    // Each page makes 3 parallel subrequests (overview, metrics, reactions), so at concurrency 3, max active should be <= 3 * 3 = 9
    const result = await syncDailyPageInsights({
      db: batchDb,
      masterKey: TEST_MASTER_KEY,
      fetchImpl: mockFetch as any,
      targetDate: '2026-03-01',
      concurrency: 3,
    });

    expect(result.totalEligible).toBe(12);
    expect(result.synced).toBe(12);
    expect(result.failed).toBe(0);
    // Ensure concurrency was bounded to at most 3 pages (each doing 3 subrequests = 9 max)
    expect(maxConcurrentRequests).toBeLessThanOrEqual(9);
  });
});
