import { type NextRequest, NextResponse } from 'next/server';
import {
  decryptToken,
  getSessionSecret,
  PageInsightsQuerySchema,
  verifySessionToken,
  type PageInsightsResponse,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { DatabaseClient, Database } from '@fbuploadpro/contracts';
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
  const encryptionKey =
    process.env.TOKEN_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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

  const client = options?.dbClient;
  let page: {
    id: string;
    fb_page_id: string;
    page_name: string;
    fb_page_access_token: string;
    status: string;
  } | null = null;

  if (client && 'query' in client && typeof client.query === 'function') {
    const pageRows = (await client.query(
      `SELECT id, fb_page_id, page_name, fb_page_access_token, status
       FROM facebook_pages
       WHERE (id = $1 OR fb_page_id = $1) AND user_id = $2`,
      [pageId, session.userId]
    )) as Array<{
      id: string;
      fb_page_id: string;
      page_name: string;
      fb_page_access_token: string;
      status: string;
    }>;

    if (!pageRows || pageRows.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    page = pageRows[0];
  } else {
    const supabase = (client && 'from' in client ? client : getSupabaseClient()) as SupabaseClient<any> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: pageData, error } = await supabase
      .from('facebook_pages')
      .select('id, fb_page_id, page_name, encrypted_access_token, status')
      .eq('user_id', session.userId)
      .or(`id.eq.${pageId},fb_page_id.eq.${pageId}`)
      .maybeSingle();

    if (error || !pageData) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    page = {
      id: pageData.id,
      fb_page_id: pageData.fb_page_id,
      page_name: pageData.page_name,
      fb_page_access_token: pageData.encrypted_access_token,
      status: pageData.status,
    };
  }

  const cacheKey = `insights:${session.userId}:${page.fb_page_id}:${query.range}`;

  // 2. Check cache if refresh flag is false
  if (!query.refresh) {
    const cached = globalInsightsCache.get<PageInsightsResponse>(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        cacheHit: true,
      });
    }
  }

  // 3. Decrypt Facebook access token server-side
  let decryptedToken: string;
  try {
    decryptedToken = await decryptToken(page.fb_page_access_token, encryptionKey);
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

  return NextResponse.json(responsePayload);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleGetInsights(request, subdomain, pageId);
}
