import { type NextRequest, NextResponse } from 'next/server';
import {
  ListPublishLogsQuerySchema,
  PublishLogSchema,
  verifySessionToken,
  type PublishLog,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleListPublishLogs(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';

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

  const { pageId, status, limit, offset } = parsedQuery.data;

  const db = dbClient ?? getDbClient();

  // 4. Build query filters
  const conditions = ['pl.user_id = $1'];
  const params: unknown[] = [session.userId];

  if (pageId) {
    params.push(pageId);
    conditions.push(`pl.fb_page_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`pl.status = $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  // 5. Total count query
  const countSql = `SELECT COUNT(*) AS total FROM publish_logs pl WHERE ${whereClause};`;
  const countRows = (await db.query<{ total: string | number }>(countSql, params)) as Array<{ total: string | number }>;
  const total = countRows.length > 0 ? Number(countRows[0].total) : 0;

  // 6. Paginated list query
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

  const rows = (await db.query<Record<string, unknown>>(listSql, listParams)) as Array<Record<string, unknown>>;

  const logs: PublishLog[] = (rows || []).map((row) => {
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
      errorMessage: row.error_message
        ? (typeof row.error_message === 'object' ? JSON.stringify(row.error_message) : String(row.error_message))
        : null,
      errorDetails,
      createdAt: new Date(String(row.created_at)).toISOString(),
    });
  });

  return NextResponse.json({ logs, total }, { status: 200 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListPublishLogs(request, subdomain);
}
