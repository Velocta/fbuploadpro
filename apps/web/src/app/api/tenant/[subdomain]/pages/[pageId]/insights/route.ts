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
import { getSupabaseAdminClient } from '@/lib/auth/clients';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getPageOverview,
  getPageTimeSeriesInsights,
  getPageReactionsAndDemographics,
} from '@/lib/insights/facebook-insights-client';

export interface HandleGetInsightsOptions {
  dbClient?: DatabaseClient | SupabaseClient;
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
    const found = pageRows[0] as Record<string, unknown>;
    page = {
      id: found.id as string,
      fb_page_id: found.fb_page_id as string,
      page_name: found.page_name as string,
      encrypted_access_token: found.encrypted_access_token as string,
      status: found.status as string,
    };
  } else {
    const supabase = (client && 'from' in client ? client : getSupabaseAdminClient()) as SupabaseClient | null;
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

  // Decrypt Facebook access token server-side (zero token exposure to client)
  let decryptedToken: string;
  try {
    decryptedToken = await decryptToken(page.encrypted_access_token, encryptionKey);
  } catch (_err) {
    return NextResponse.json(
      { error: 'Failed to decrypt Facebook access credentials' },
      { status: 500 }
    );
  }

  // Fetch Overview, Time-Series, and Reactions/Demographics live from Facebook Graph API v26.0
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const overviewResult = await getPageOverview(page.fb_page_id, decryptedToken, fetchImpl);
    if (overviewResult.healthStatus !== 'active' && overviewResult.healthStatus !== 'rate_limited') {
      const responsePayload: PageInsightsResponse = {
        success: true,
        fbPageId: page.fb_page_id,
        dateRange: query.range,
        cachedAt: new Date().toISOString(),
        cacheHit: false,
        overview: {
          ...overviewResult.overview,
          pageName: overviewResult.overview.pageName || page.page_name || null,
          totalMediaViews: 0,
          totalVideoViews: 0,
          totalPostEngagements: 0,
        },
        timeSeries: [],
        reactions: {
          like: 0,
          love: 0,
          wow: 0,
          haha: 0,
          sorry: 0,
          anger: 0,
          total: 0,
        },
        demographics: {
          topCountries: [],
          topCities: [],
        },
        healthStatus: overviewResult.healthStatus,
      };
      return NextResponse.json(responsePayload, {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      });
    }

    if (overviewResult.rawError) {
      const graphError = new Error(overviewResult.rawError) as Error & { code?: number };
      if (overviewResult.healthStatus === 'rate_limited') {
        graphError.code = 80001;
      }
      throw graphError;
    }

    // Dependency analysis (spec 139): getPageOverview above must stay
    // sequential — its healthStatus gates this whole branch (a degraded
    // status returns early without calling the other two, and a rawError
    // throws before they run). The two calls below are independent of
    // each other: each takes only fb_page_id / token / (range) / fetchImpl,
    // neither consumes the other's result, and they are only merged into
    // the payload after both settle. So they run concurrently.
    //
    // Failure semantics: Promise.all preserves today's net behaviour.
    // The client library never rejects for Graph failures (it returns
    // zero-filled/degraded results), but if a call ever did reject,
    // sequential code would also have failed the whole request via the
    // outer catch (discarding any sibling result). Promise.all does the
    // same: the first rejection propagates to the outer catch and the
    // sibling result is discarded. Promise.allSettled + degraded
    // fallbacks was deliberately NOT used — it would turn a hard failure
    // that returns 429/502 today into a 200 with partial data.
    const [timeSeriesResult, reactionsDemoResult] = await Promise.all([
      getPageTimeSeriesInsights(page.fb_page_id, decryptedToken, query.range, fetchImpl),
      getPageReactionsAndDemographics(page.fb_page_id, decryptedToken, fetchImpl),
    ]);

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

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: unknown) {
    const errCode =
      err !== null && typeof err === 'object' && 'code' in err
        ? err.code
        : undefined;
    const isRateLimited =
      errCode === 4 ||
      errCode === 17 ||
      errCode === 32 ||
      errCode === 613 ||
      errCode === 80001;

    return NextResponse.json(
      {
        error: isRateLimited ? 'FB_RATE_LIMITED' : 'UPSTREAM_GRAPH_ERROR',
        message: err instanceof Error ? err.message : 'Facebook Graph API failed to return page insights.',
      },
      { status: isRateLimited ? 429 : 502 }
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
