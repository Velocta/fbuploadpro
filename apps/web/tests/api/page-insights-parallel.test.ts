import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { encryptToken, signSessionToken } from '@fbuploadpro/contracts';
import type { DatabaseClient } from '@fbuploadpro/contracts';

vi.mock('@/lib/insights/facebook-insights-client', () => ({
  getPageOverview: vi.fn(),
  getPageTimeSeriesInsights: vi.fn(),
  getPageReactionsAndDemographics: vi.fn(),
}));

import { handleGetInsights } from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route';
import {
  getPageOverview,
  getPageTimeSeriesInsights,
  getPageReactionsAndDemographics,
} from '@/lib/insights/facebook-insights-client';

const mockOverview = vi.mocked(getPageOverview);
const mockTimeSeries = vi.mocked(getPageTimeSeriesInsights);
const mockReactions = vi.mocked(getPageReactionsAndDemographics);

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const OVERVIEW_OK = {
  overview: {
    pageName: 'Viral Cooking Daily',
    pageImage: 'https://cdn.facebook.com/pages/cooking.jpg',
    fanCount: 24500,
    followersCount: 28900,
    totalMediaViews: 0,
    totalVideoViews: 0,
    totalPostEngagements: 0,
  },
  healthStatus: 'active' as const,
};

const TIME_SERIES_OK = {
  timeSeries: [
    {
      date: '2026-10-22',
      pageFollows: 3,
      dailyFollowsUnique: 3,
      dailyUnfollowsUnique: 0,
      mediaViews: 100,
      videoViews: 40,
      videoCompleteViews30s: 10,
      videoViewTimeMinutes: 5,
    },
  ],
  totalMediaViews: 111,
  totalVideoViews: 222,
  totalVideoViewTimeMinutes: 5,
};

const REACTIONS_OK = {
  reactions: { like: 10, love: 5, wow: 1, haha: 2, sorry: 0, anger: 0, total: 18 },
  demographics: {
    topCountries: [{ name: 'US', count: 100, percentage: 100 }],
    topCities: [{ name: 'New York', count: 40, percentage: 100 }],
  },
};

describe('Facebook Page Insights — parallel Graph calls (spec 139)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const pageId = '22222222-2222-4222-a222-222222222222';
  const fbPageId = '846840138502516';
  let validSessionCookie: string;
  let sampleEncryptedPageToken: string;
  let mockDb: DatabaseClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

    const token = await signSessionToken(
      {
        userId,
        email: 'alexander@gmail.com',
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

    mockDb = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM workspaces')) {
          return Promise.resolve([{ id: 'ws_123' }]);
        }
        if (sql.includes('FROM facebook_pages')) {
          return Promise.resolve([
            {
              id: pageId,
              fb_page_id: fbPageId,
              page_name: 'Viral Cooking Daily',
              encrypted_access_token: sampleEncryptedPageToken,
              status: 'active',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DatabaseClient;
  });

  function makeRequest() {
    return new NextRequest(
      `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=28d`,
      { headers: { cookie: validSessionCookie } }
    );
  }

  it('starts time-series and reactions calls concurrently (both in flight before either resolves)', async () => {
    mockOverview.mockResolvedValue(OVERVIEW_OK);
    const ts = deferred<typeof TIME_SERIES_OK>();
    const rx = deferred<typeof REACTIONS_OK>();
    mockTimeSeries.mockReturnValue(ts.promise);
    mockReactions.mockReturnValue(rx.promise);

    const pending = handleGetInsights(makeRequest(), 'acme', pageId, { dbClient: mockDb });

    // Neither deferred has resolved, yet BOTH calls must already have
    // been started — sequential code would only have started the first.
    await vi.waitFor(() => {
      expect(mockTimeSeries).toHaveBeenCalledTimes(1);
      expect(mockReactions).toHaveBeenCalledTimes(1);
    });
    expect(mockTimeSeries).toHaveBeenCalledWith(
      fbPageId,
      'mock_raw_fb_page_access_token_secret',
      '28d',
      expect.anything()
    );
    expect(mockReactions).toHaveBeenCalledWith(
      fbPageId,
      'mock_raw_fb_page_access_token_secret',
      expect.anything()
    );

    // Resolve in reverse start order to prove neither waits on the other.
    rx.resolve(REACTIONS_OK);
    ts.resolve(TIME_SERIES_OK);

    const res = await pending;
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(
      'private, no-cache, no-store, must-revalidate'
    );
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      fbPageId,
      dateRange: '28d',
      cacheHit: false,
      healthStatus: 'active',
      timeSeries: TIME_SERIES_OK.timeSeries,
      reactions: REACTIONS_OK.reactions,
      demographics: REACTIONS_OK.demographics,
    });
    expect(body.overview).toMatchObject({
      pageName: 'Viral Cooking Daily',
      fanCount: 24500,
      followersCount: 28900,
      totalMediaViews: 111,
      totalVideoViews: 222,
      totalPostEngagements: 18,
    });
  });

  it('returns the unchanged success payload when both calls resolve normally', async () => {
    mockOverview.mockResolvedValue(OVERVIEW_OK);
    mockTimeSeries.mockResolvedValue(TIME_SERIES_OK);
    mockReactions.mockResolvedValue(REACTIONS_OK);

    const res = await handleGetInsights(makeRequest(), 'acme', pageId, { dbClient: mockDb });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.overview.totalMediaViews).toBe(111);
    expect(body.overview.totalVideoViews).toBe(222);
    expect(body.overview.totalPostEngagements).toBe(18);
    expect(body.timeSeries).toEqual(TIME_SERIES_OK.timeSeries);
    expect(body.reactions).toEqual(REACTIONS_OK.reactions);
    expect(body.demographics).toEqual(REACTIONS_OK.demographics);
  });

  it('fails the whole request (502) when the time-series call rejects, matching sequential behaviour', async () => {
    mockOverview.mockResolvedValue(OVERVIEW_OK);
    mockTimeSeries.mockRejectedValue(new Error('timeseries boom'));
    mockReactions.mockResolvedValue(REACTIONS_OK);

    const res = await handleGetInsights(makeRequest(), 'acme', pageId, { dbClient: mockDb });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('UPSTREAM_GRAPH_ERROR');
    expect(body.message).toBe('timeseries boom');
  });

  it('fails the whole request (502) when the reactions call rejects, matching sequential behaviour', async () => {
    mockOverview.mockResolvedValue(OVERVIEW_OK);
    mockTimeSeries.mockResolvedValue(TIME_SERIES_OK);
    mockReactions.mockRejectedValue(new Error('reactions boom'));

    const res = await handleGetInsights(makeRequest(), 'acme', pageId, { dbClient: mockDb });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('UPSTREAM_GRAPH_ERROR');
    expect(body.message).toBe('reactions boom');
  });

  it('primary failure: overview rawError returns the byte-identical error response (502)', async () => {
    mockOverview.mockResolvedValue({
      overview: OVERVIEW_OK.overview,
      healthStatus: 'active',
      rawError: 'Graph exploded',
    });

    const res = await handleGetInsights(makeRequest(), 'acme', pageId, { dbClient: mockDb });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: 'UPSTREAM_GRAPH_ERROR', message: 'Graph exploded' });
    expect(mockTimeSeries).not.toHaveBeenCalled();
    expect(mockReactions).not.toHaveBeenCalled();
  });

  it('primary failure: rate-limited overview rawError returns 429 FB_RATE_LIMITED', async () => {
    mockOverview.mockResolvedValue({
      overview: OVERVIEW_OK.overview,
      healthStatus: 'rate_limited',
      rawError: 'Rate limit hit',
    });

    const res = await handleGetInsights(makeRequest(), 'acme', pageId, { dbClient: mockDb });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toEqual({ error: 'FB_RATE_LIMITED', message: 'Rate limit hit' });
  });

  it('auxiliary partial data preserved: a degraded (resolved, zero-filled) time-series keeps reactions data in a 200', async () => {
    mockOverview.mockResolvedValue(OVERVIEW_OK);
    mockTimeSeries.mockResolvedValue({
      timeSeries: [],
      totalMediaViews: 0,
      totalVideoViews: 0,
      totalVideoViewTimeMinutes: 0,
    });
    mockReactions.mockResolvedValue(REACTIONS_OK);

    const res = await handleGetInsights(makeRequest(), 'acme', pageId, { dbClient: mockDb });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timeSeries).toEqual([]);
    expect(body.overview.totalMediaViews).toBe(0);
    expect(body.overview.totalPostEngagements).toBe(18);
    expect(body.reactions).toEqual(REACTIONS_OK.reactions);
    expect(body.demographics).toEqual(REACTIONS_OK.demographics);
  });

  it('keeps the overview call as a gate: degraded overview returns early and never starts the parallel calls', async () => {
    mockOverview.mockResolvedValue({
      overview: OVERVIEW_OK.overview,
      healthStatus: 'invalid_token',
      rawError: 'Error validating access token',
    });

    const res = await handleGetInsights(makeRequest(), 'acme', pageId, { dbClient: mockDb });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.healthStatus).toBe('invalid_token');
    expect(body.timeSeries).toEqual([]);
    expect(mockTimeSeries).not.toHaveBeenCalled();
    expect(mockReactions).not.toHaveBeenCalled();
  });
});
