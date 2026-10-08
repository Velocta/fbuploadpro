import { type NextRequest, NextResponse } from 'next/server';
import {
  decryptToken,
  PageInsightsQuerySchema,
  verifySessionToken,
  type PageInsightsResponse,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';
import { globalInsightsCache } from '../../../../../../../lib/insights/insights-cache';
import {
  getPageOverview,
  getPageTimeSeriesInsights,
} from '../../../../../../../lib/insights/facebook-insights-client';

export interface HandleGetInsightsOptions {
  dbClient?: DatabaseClient;
  fetchImpl?: typeof fetch;
}

export async function handleGetInsights(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  options?: HandleGetInsightsOptions
): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';
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

  const db = options?.dbClient ?? getDbClient();

  // 1. Verify page exists and belongs to user
  const pageRows = (await db.query(
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

  const page = pageRows[0];
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

  // 4. Fetch Overview and Time-Series metrics from Facebook Graph API v26.0
  const fetchImpl = options?.fetchImpl ?? fetch;
  const overviewResult = await getPageOverview(page.fb_page_id, decryptedToken, fetchImpl);
  const timeSeriesResult = await getPageTimeSeriesInsights(
    page.fb_page_id,
    decryptedToken,
    query.range,
    fetchImpl
  );

  // Preserve stored page_name if Graph API didn't return one
  const finalOverview = {
    ...overviewResult.overview,
    pageName: overviewResult.overview.pageName || page.page_name || null,
    totalMediaViews: timeSeriesResult.totalMediaViews,
    totalVideoViews: timeSeriesResult.totalVideoViews,
  };

  const responsePayload: PageInsightsResponse = {
    success: true,
    fbPageId: page.fb_page_id,
    dateRange: query.range,
    cachedAt: new Date().toISOString(),
    cacheHit: false,
    overview: finalOverview,
    timeSeries: timeSeriesResult.timeSeries,
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
