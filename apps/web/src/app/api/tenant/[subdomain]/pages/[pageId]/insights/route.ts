import { type NextRequest, NextResponse } from 'next/server';
import {
  canAccessTenant,
  decryptToken,
  getSessionSecret,
  getTokenEncryptionKey,
  PageInsightsQuerySchema,
  verifySessionToken,
  type DatabaseClient,
  type PageInsightsResponse,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import type { SupabaseClient } from '@supabase/supabase-js';
import { globalInsightsCache } from '../../../../../../../lib/insights/insights-cache';
import {
  getPageOverview,
  getPageTimeSeriesInsights,
  getPageReactionsAndDemographics,
} from '../../../../../../../lib/insights/facebook-insights-client';

function parseJsonField<T>(field: unknown): T {
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch {
      return {} as T;
    }
  }
  if (field && typeof field === 'object') {
    return field as T;
  }
  return {} as T;
}

function accumulateReactions(
  rawField: unknown,
  aggregatedReactions: Record<string, number>
): number {
  const rx = parseJsonField<Record<string, unknown>>(rawField);
  let engagements = 0;
  for (const [k, v] of Object.entries(rx)) {
    const num = Number(v) || 0;
    if (k in aggregatedReactions) {
      aggregatedReactions[k] = (aggregatedReactions[k] || 0) + num;
    }
    aggregatedReactions.total = (aggregatedReactions.total || 0) + num;
    engagements += num;
  }
  return engagements;
}

function accumulateDemographics(
  rawField: unknown,
  countriesMap: Map<string, number>,
  citiesMap: Map<string, number>
): void {
  const demo = parseJsonField<{ countries?: Record<string, unknown>; cities?: Record<string, unknown> }>(rawField);
  if (demo.countries && typeof demo.countries === 'object') {
    for (const [c, cnt] of Object.entries(demo.countries)) {
      countriesMap.set(c, (countriesMap.get(c) || 0) + (Number(cnt) || 0));
    }
  }
  if (demo.cities && typeof demo.cities === 'object') {
    for (const [c, cnt] of Object.entries(demo.cities)) {
      citiesMap.set(c, (citiesMap.get(c) || 0) + (Number(cnt) || 0));
    }
  }
}

function parseRangeDays(range?: string): number {
  switch (range) {
    case '7d':
      return 7;
    case '14d':
      return 14;
    case '90d':
      return 90;
    default:
      return 28;
  }
}

function assembleInsightsFromSnapshots(
  page: { fb_page_id: string; page_name: string },
  range: '7d' | '14d' | '28d' | '90d',
  snapshotRows: any[]
): PageInsightsResponse {
  const sorted = [...snapshotRows].sort((a, b) => {
    const da = typeof a.snapshot_date === 'string' ? a.snapshot_date : new Date(a.snapshot_date).toISOString();
    const db = typeof b.snapshot_date === 'string' ? b.snapshot_date : new Date(b.snapshot_date).toISOString();
    return da.localeCompare(db);
  });

  const latest = sorted[sorted.length - 1] ?? {};

  let totalMediaViews = 0;
  let totalVideoViews = 0;
  let totalPostEngagements = 0;
  const aggregatedReactions: Record<string, number> = {
    like: 0,
    love: 0,
    wow: 0,
    haha: 0,
    sorry: 0,
    anger: 0,
    total: 0,
  };

  const countriesMap = new Map<string, number>();
  const citiesMap = new Map<string, number>();

  const timeSeries = sorted.map((row) => {
    const mv = Number(row.media_views) || 0;
    const vv = Number(row.video_views) || 0;
    const df = Number(row.daily_follows) || 0;
    const du = Number(row.daily_unfollows) || 0;
    const watchSec = Number(row.video_view_time_seconds) || 0;
    const watchMin = Math.round(watchSec / 60);

    totalMediaViews += mv;
    totalVideoViews += vv;
    totalPostEngagements += accumulateReactions(row.reactions_summary, aggregatedReactions);
    accumulateDemographics(row.demographics_summary, countriesMap, citiesMap);

    const v30s = Number(row.video_complete_views_30s) || 0;

    return {
      date: typeof row.snapshot_date === 'string' ? row.snapshot_date.slice(0, 10) : new Date(row.snapshot_date).toISOString().slice(0, 10),
      pageFollows: df,
      dailyFollowsUnique: df,
      dailyUnfollowsUnique: du,
      mediaViews: mv,
      videoViews: vv,
      videoCompleteViews30s: v30s,
      videoViewTimeMinutes: watchMin,
    };
  });

  const topCountries = Array.from(countriesMap.entries())
    .map(([name, count]) => ({ name, count, percentage: 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const totalCountryCount = topCountries.reduce((sum, item) => sum + item.count, 0);
  if (totalCountryCount > 0) {
    topCountries.forEach((c) => {
      c.percentage = Math.round((c.count / totalCountryCount) * 100);
    });
  }

  const topCities = Array.from(citiesMap.entries())
    .map(([name, count]) => ({ name, count, percentage: 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const totalCityCount = topCities.reduce((sum, item) => sum + item.count, 0);
  if (totalCityCount > 0) {
    topCities.forEach((c) => {
      c.percentage = Math.round((c.count / totalCityCount) * 100);
    });
  }

  const currentFollowers = latest.followers_count !== undefined ? Number(latest.followers_count) : 0;

  return {
    success: true,
    fbPageId: page.fb_page_id,
    dateRange: range,
    cachedAt: new Date().toISOString(),
    cacheHit: false,
    overview: {
      pageName: page.page_name,
      pageImage: null,
      fanCount: Number(latest.fan_count) || 0,
      followersCount: currentFollowers,
      totalMediaViews,
      totalVideoViews,
      totalPostEngagements,
    },
    timeSeries,
    reactions: {
      like: aggregatedReactions.like || 0,
      love: aggregatedReactions.love || 0,
      wow: aggregatedReactions.wow || 0,
      haha: aggregatedReactions.haha || 0,
      sorry: aggregatedReactions.sorry || 0,
      anger: aggregatedReactions.anger || 0,
      total: aggregatedReactions.total || 0,
    },
    demographics: {
      topCountries,
      topCities,
    },
    healthStatus: 'active',
  };
}

export interface HandleGetInsightsOptions {
  dbClient?: DatabaseClient | SupabaseClient<any>;
  fetchImpl?: typeof fetch;
}

export async function handleGetInsights(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  options?: HandleGetInsightsOptions
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();
  const encryptionKey = getTokenEncryptionKey();

  const sessionCookie = request.cookies.get('fbup_session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let session;
  try {
    session = await verifySessionToken(sessionCookie, sessionSecret);
  } catch (_e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const parsedQuery = PageInsightsQuerySchema.safeParse({
    range: searchParams.get('range') || undefined,
    refresh: searchParams.get('refresh') || undefined,
  });

  const query = parsedQuery.success ? parsedQuery.data : { range: '28d' as const, refresh: false };

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pageId);
  const isNumericFbId = /^[0-9]+$/.test(pageId);

  if (!isUuid && !isNumericFbId) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  const client = options?.dbClient;
  const workspaceId = await resolveTenantWorkspaceId(client, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  let page: {
    id: string;
    fb_page_id: string;
    page_name: string;
    encrypted_access_token: string;
    status: string;
  } | null = null;

  if (client && 'query' in client && typeof client.query === 'function') {
    const whereClause = isUuid ? 'p.id = $1' : 'p.fb_page_id = $1';
    const pageRows = (await client.query(
      `SELECT p.id, p.fb_page_id, p.page_name, 
              p.encrypted_access_token, 
              p.status
       FROM facebook_pages p
       WHERE ${whereClause} AND p.user_id = $2 AND p.workspace_id = $3`,
      [pageId, session.userId, workspaceId]
    )) as Array<{
      id: string;
      fb_page_id: string;
      page_name: string;
      encrypted_access_token: string;
      status: string;
    }>;

    if (!pageRows || pageRows.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    const found = pageRows[0] as any;
    page = {
      id: found.id,
      fb_page_id: found.fb_page_id,
      page_name: found.page_name,
      encrypted_access_token: found.encrypted_access_token,
      status: found.status,
    };
  } else {
    const supabase = (client && 'from' in client ? client : getSupabaseClient()) as SupabaseClient<any> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    let queryBuilder = supabase
      .from('facebook_pages')
      .select('id, fb_page_id, page_name, encrypted_access_token, status')
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId);

    if (isUuid) {
      queryBuilder = queryBuilder.eq('id', pageId);
    } else {
      queryBuilder = queryBuilder.eq('fb_page_id', pageId);
    }

    const { data: pageData, error } = await queryBuilder.maybeSingle();

    if (error || !pageData) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    page = {
      id: pageData.id,
      fb_page_id: pageData.fb_page_id,
      page_name: pageData.page_name,
      encrypted_access_token: pageData.encrypted_access_token,
      status: pageData.status,
    };
  }

  const cacheKey = `insights:${session.userId}:${page.fb_page_id}:${query.range}`;

  // 2. Check cache if refresh flag is false
  if (!query.refresh) {
    const cached =
      (await globalInsightsCache.getAsync<PageInsightsResponse>(cacheKey)) ??
      globalInsightsCache.get<PageInsightsResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(
        {
          ...cached.data,
          cacheHit: true,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400',
          },
        }
      );
    }
  }

  // Query daily snapshots from PostgreSQL
  const days = parseRangeDays(query.range);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let snapshotRows: any[] = [];
  try {
    if (client && 'query' in client && typeof client.query === 'function') {
      const result = await client.query(
        `SELECT id, user_id, fb_page_id, snapshot_date, fan_count, followers_count,
                daily_follows, daily_unfollows, media_views, video_views,
                video_complete_views_30s, video_view_time_seconds,
                reactions_summary, demographics_summary
         FROM page_insights_daily_snapshots
         WHERE user_id = $1 AND fb_page_id = $2 AND snapshot_date >= $3
         ORDER BY snapshot_date ASC`,
        [session.userId, page.fb_page_id, cutoffDate]
      );
      const rawRows = Array.isArray(result)
        ? (result as Record<string, unknown>[])
        : ((result as { rows?: Record<string, unknown>[] })?.rows || []);
      if (rawRows.length > 0 && rawRows[0]?.snapshot_date) {
        snapshotRows = rawRows;
      }
    } else {
      const supabase = (client && 'from' in client ? client : getSupabaseClient()) as SupabaseClient<any> | null;
      if (supabase) {
        const { data: dbSnapshots } = await supabase
          .from('page_insights_daily_snapshots')
          .select('*')
          .eq('user_id', session.userId)
          .eq('fb_page_id', page.fb_page_id)
          .gte('snapshot_date', cutoffDate)
          .order('snapshot_date', { ascending: true });
        if (Array.isArray(dbSnapshots) && dbSnapshots.length > 0 && dbSnapshots[0]?.snapshot_date) {
          snapshotRows = dbSnapshots;
        }
      }
    }
  } catch (_e) {
    // Non-fatal if table/mock is missing in unit tests
  }

  if (!query.refresh && snapshotRows.length > 0) {
    const assembled = assembleInsightsFromSnapshots(page, query.range, snapshotRows);
    await globalInsightsCache.setAsync(cacheKey, assembled, 900);
    return NextResponse.json(assembled, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400',
      },
    });
  }

  // 3. Decrypt Facebook access token server-side
  let decryptedToken: string;
  try {
    decryptedToken = await decryptToken(page.encrypted_access_token, encryptionKey);
  } catch (_err) {
    return NextResponse.json(
      { error: 'Failed to decrypt Facebook access credentials' },
      { status: 500 }
    );
  }

  // 4. Fetch Overview, Time-Series, and Reactions/Demographics metrics from Facebook Graph API v26.0
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const overviewResult = await getPageOverview(page.fb_page_id, decryptedToken, fetchImpl);
    if (overviewResult.rawError) {
      const graphError: any = new Error(overviewResult.rawError);
      if (overviewResult.healthStatus === 'rate_limited') {
        graphError.code = 80001;
      }
      throw graphError;
    }
    const timeSeriesResult = await getPageTimeSeriesInsights(
      page.fb_page_id,
      decryptedToken,
      query.range,
      fetchImpl
    );
    const reactionsDemoResult = await getPageReactionsAndDemographics(
      page.fb_page_id,
      decryptedToken,
      fetchImpl
    );

    // Preserve stored page_name if Graph API didn't return one
    const finalOverview = {
      ...overviewResult.overview,
      pageName: overviewResult.overview.pageName || page.page_name || null,
      totalMediaViews: timeSeriesResult.totalMediaViews,
      totalVideoViews: timeSeriesResult.totalVideoViews,
      totalPostEngagements: reactionsDemoResult.reactions.total,
    };

    const responsePayload: PageInsightsResponse = {
      success: true,
      fbPageId: page.fb_page_id,
      dateRange: query.range,
      cachedAt: new Date().toISOString(),
      cacheHit: false,
      overview: finalOverview,
      timeSeries: timeSeriesResult.timeSeries,
      reactions: reactionsDemoResult.reactions,
      demographics: reactionsDemoResult.demographics,
      healthStatus: overviewResult.healthStatus,
    };

    // Cache response for 15 minutes (900 seconds)
    await globalInsightsCache.setAsync(cacheKey, responsePayload, 900);

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    if (snapshotRows.length > 0) {
      const isRateLimited =
        err?.code === 4 ||
        err?.code === 17 ||
        err?.code === 32 ||
        err?.code === 613 ||
        err?.code === 80001;
      const assembled = assembleInsightsFromSnapshots(page, query.range, snapshotRows);
      if (isRateLimited) {
        assembled.healthStatus = 'rate_limited';
      }
      return NextResponse.json(assembled, {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400',
        },
      });
    }

    // Never cache zeroed fallback metrics when upstream Graph API call fails
    return NextResponse.json(
      {
        error: 'UPSTREAM_GRAPH_ERROR',
        message: err instanceof Error ? err.message : 'Facebook Graph API failed to return page insights.',
      },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleGetInsights(request, subdomain, pageId);
}
