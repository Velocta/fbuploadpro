import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  ListPublishLogsQuerySchema,
  PublishLogSchema,
  verifySessionToken,
  type DatabaseClient,
  type PublishLog,
} from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';

function formatErrorMessage(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString();
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return null;
}

function parsePublishLogRow(row: any): PublishLog {
  let errorDetails: Record<string, unknown> | null = null;
  if (row.error_details) {
    if (typeof row.error_details === 'string') {
      try {
        errorDetails = JSON.parse(row.error_details);
      } catch {
        errorDetails = null;
      }
    } else if (typeof row.error_details === 'object') {
      errorDetails = row.error_details as Record<string, unknown>;
    }
  }

  return PublishLogSchema.parse({
    id: String(row.id),
    userId: String(row.user_id),
    queueItemId: String(row.queue_item_id),
    pageId: String(row.fb_page_id),
    status: row.status,
    attemptNumber: Number(row.attempt_number ?? 1),
    fbResponseCode: row.fb_response_code != null ? Number(row.fb_response_code) : null,
    errorMessage: formatErrorMessage(row.error_message),
    errorDetails,
    createdAt: new Date(String(row.created_at)).toISOString(),
  });
}

async function fetchLegacyPublishLogs(
  dbClient: DatabaseClient,
  userId: string,
  workspaceId: string,
  query: { pageId?: string; status?: any; limit: number; offset: number }
): Promise<{ logs: PublishLog[]; total: number }> {
  const { pageId, status, limit, offset } = query;
  const conditions = [
    'pl.user_id = $1',
    'EXISTS (SELECT 1 FROM facebook_pages fp WHERE fp.id = pl.fb_page_id AND fp.workspace_id = $2 AND fp.user_id = $1)'
  ];
  const params: unknown[] = [userId, workspaceId];

  if (pageId) {
    params.push(pageId);
    conditions.push(`pl.fb_page_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`pl.status = $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  const countSql = `SELECT COUNT(*) AS total FROM publish_logs pl WHERE ${whereClause};`;
  const countRows = (await dbClient.query<{ total: string | number }>(countSql, params)) as Array<{ total: string | number }>;
  const total = countRows.length > 0 ? Number(countRows[0].total) : 0;

  const listParams = [...params, limit, offset];
  const listSql = `
    SELECT pl.id, pl.user_id, pl.queue_item_id, pl.fb_page_id, pl.status,
           pl.attempt_number, pl.fb_response_code, pl.error_message, pl.error_details,
           pl.created_at
    FROM publish_logs pl
    WHERE ${whereClause}
    ORDER BY pl.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `.trim();

  const rows = (await dbClient.query<Record<string, unknown>>(listSql, listParams)) as Array<Record<string, unknown>>;
  const logs = (rows || []).map(parsePublishLogRow);
  return { logs, total };
}

async function fetchSupabasePublishLogs(
  supabase: SupabaseClient<any>,
  userId: string,
  workspaceId: string,
  query: { pageId?: string; status?: any; limit: number; offset: number }
): Promise<{ logs: PublishLog[]; total: number } | null> {
  const { pageId, status, limit, offset } = query;

  const { data: workspacePages } = await supabase
    .from('facebook_pages')
    .select('id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .neq('status', 'disconnected');

  const workspacePageIds = (workspacePages || []).map((p) => p.id);
  if (workspacePageIds.length === 0) {
    return { logs: [], total: 0 };
  }

  let queryBuilder = supabase
    .from('publish_logs')
    .select(
      'id, user_id, queue_item_id, fb_page_id, status, attempt_number, fb_response_code, error_message, error_details, created_at',
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .in('fb_page_id', workspacePageIds);

  if (pageId) {
    queryBuilder = queryBuilder.eq('fb_page_id', pageId);
  }
  if (status) {
    queryBuilder = queryBuilder.eq('status', status);
  }

  queryBuilder = queryBuilder
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: rows, count: totalCount, error } = await queryBuilder;
  if (error) {
    return null;
  }

  const logs = (rows || []).map(parsePublishLogRow);
  return { logs, total: totalCount ?? 0 };
}

export async function handleListPublishLogs(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();

  // 1. Session auth guard
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

  // 2. Tenant isolation check
  if (session.subdomain !== subdomain && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Query string validation
  const url = new URL(request.url);
  const rawQuery = {
    pageId: url.searchParams.get('pageId') || undefined,
    status: url.searchParams.get('status') || undefined,
    limit: url.searchParams.get('limit') || undefined,
    offset: url.searchParams.get('offset') || undefined,
  };

  const parsedQuery = ListPublishLogsQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'INVALID_QUERY', details: parsedQuery.error.issues },
      { status: 400 }
    );
  }

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (isLegacyClient(dbClient)) {
    const result = await fetchLegacyPublishLogs(dbClient, session.userId, workspaceId, parsedQuery.data);
    return NextResponse.json(result, { status: 200 });
  }

  const supabase = getRouteSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const result = await fetchSupabasePublishLogs(supabase, session.userId, workspaceId, parsedQuery.data);
  if (!result) {
    return NextResponse.json({ error: 'Failed to list publish logs' }, { status: 500 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListPublishLogs(request, subdomain);
}
