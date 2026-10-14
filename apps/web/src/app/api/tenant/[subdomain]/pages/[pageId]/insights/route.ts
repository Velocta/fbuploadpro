import { type NextRequest, NextResponse } from 'next/server';
import {
  decryptToken,
  getSessionSecret,
  getTokenEncryptionKey,
  PageInsightsQuerySchema,
  verifySessionToken,
  type DatabaseClient,
  type PageInsightsResponse,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { globalInsightsCache } from '../../../../../../../lib/insights/insights-cache';
import {
  getPageOverview,
  getPageTimeSeriesInsights,
  getPageReactionsAndDemographics,
} from '../../../../../../../lib/insights/facebook-insights-client';

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

  if (session.subdomain !== subdomain && session.role !== 'admin') {
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
  let page: {
    id: string;
    fb_page_id: string;
    page_name: string;
    encrypted_access_token: string;
    status: string;
  } | null = null;

  if (client && 'query' in client && typeof client.query === 'function') {
    const wsRows = (await client.query(
      'SELECT id FROM workspaces WHERE subdomain = $1 AND owner_id = $2 LIMIT 1',
      [subdomain, session.userId]
    )) as Array<{ id: string }>;
    const workspaceId = wsRows?.[0]?.id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

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

    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('owner_id', session.userId)
      .maybeSingle();

    if (wsErr || !ws?.id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    let queryBuilder = supabase
      .from('facebook_pages')
      .select('id, fb_page_id, page_name, encrypted_access_token, status')
      .eq('user_id', session.userId)
      .eq('workspace_id', ws.id);

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
    const cached = globalInsightsCache.get<PageInsightsResponse>(cacheKey);
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
  const overviewResult = await getPageOverview(page.fb_page_id, decryptedToken, fetchImpl);
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
  globalInsightsCache.set(cacheKey, responsePayload, 900);

  return NextResponse.json(responsePayload, {
    headers: {
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400',
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleGetInsights(request, subdomain, pageId);
}
