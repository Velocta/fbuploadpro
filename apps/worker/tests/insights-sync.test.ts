import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encryptToken, decryptToken } from '@fbuploadpro/contracts';
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
});
