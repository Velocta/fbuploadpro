import { type NextRequest, NextResponse } from 'next/server';
import {
  DisconnectPageResponseSchema,
  FacebookPageViewSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';
import { z } from 'zod';

const UpdatePageRequestSchema = z.object({
  status: z.enum(['active', 'paused']).optional(),
});

function formatPageRow(row: any) {
  let parsedTasks: string[] = [];
  if (Array.isArray(row.tasks)) {
    parsedTasks = row.tasks;
  } else if (typeof row.tasks === 'string') {
    try {
      parsedTasks = JSON.parse(row.tasks);
    } catch (_e) {
      parsedTasks = [];
    }
  }

  const startingFollowers = Number(row.starting_followers ?? 0);
  const currentFollowers = Number(row.current_followers ?? 0);
  const followersGained = currentFollowers - startingFollowers;

  return FacebookPageViewSchema.parse({
    id: row.id,
    facebookAccountId: row.facebook_account_id,
    accountDisplayName: row.account_display_name ?? null,
    fbPageId: row.fb_page_id,
    pageName: row.page_name,
    profilePictureUrl: row.profile_picture_url ?? null,
    category: row.category ?? null,
    startingFollowers,
    currentFollowers,
    followersGained,
    status: row.status,
    tasks: parsedTasks,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

export async function handleGetPage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';

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

  const db = dbClient ?? getDbClient();

  const rows = (await db.query(
    `SELECT 
      p.id,
      p.facebook_account_id,
      a.display_name AS account_display_name,
      p.fb_page_id,
      p.page_name,
      p.profile_picture_url,
      p.category,
      p.starting_followers,
      p.current_followers,
      p.status,
      p.tasks,
      p.created_at,
      p.updated_at
    FROM facebook_pages p
    LEFT JOIN facebook_accounts a ON a.id = p.facebook_account_id
    WHERE p.id = $1 AND p.user_id = $2
      AND p.status != 'disconnected'`,
    [pageId, session.userId]
  )) as any[];

  if (!rows || rows.length === 0 || !rows[0]) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  const page = formatPageRow(rows[0]);
  return NextResponse.json({ page });
}

export async function handleUpdatePage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';

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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = UpdatePageRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();

  if (parsed.data.status) {
    await db.query(
      `UPDATE facebook_pages
       SET status = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3 AND status != 'disconnected'`,
      [parsed.data.status, pageId, session.userId]
    );
  }

  const rows = (await db.query(
    `SELECT 
      p.id,
      p.facebook_account_id,
      a.display_name AS account_display_name,
      p.fb_page_id,
      p.page_name,
      p.profile_picture_url,
      p.category,
      p.starting_followers,
      p.current_followers,
      p.status,
      p.tasks,
      p.created_at,
      p.updated_at
    FROM facebook_pages p
    LEFT JOIN facebook_accounts a ON a.id = p.facebook_account_id
    WHERE p.id = $1 AND p.user_id = $2
      AND p.status != 'disconnected'`,
    [pageId, session.userId]
  )) as any[];

  if (!rows || rows.length === 0 || !rows[0]) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  const page = formatPageRow(rows[0]);
  return NextResponse.json({ success: true, page });
}

export async function handleDisconnectPage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
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

  const db = dbClient ?? getDbClient();

  // 3. Soft-delete page record scoped to user_id (status = 'disconnected', wipe encrypted token)
  const result = (await db.query(
    `UPDATE facebook_pages
     SET status = 'disconnected',
         encrypted_access_token = '',
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id, fb_page_id`,
    [pageId, session.userId]
  )) as any[];

  if (!result || result.length === 0 || !result[0]) {
    return NextResponse.json(
      { error: 'Facebook page not found' },
      { status: 404 }
    );
  }

  const fbPageId = result[0].fb_page_id || result[0].fbPageId;
  if (fbPageId) {
    await db.query(
      `UPDATE queue_items
       SET status = 'cancelled',
           updated_at = now()
       WHERE user_id = $1 AND fb_page_id = $2 AND status = 'queued'`,
      [session.userId, String(fbPageId)]
    );
  }

  const responsePayload = DisconnectPageResponseSchema.parse({
    success: true,
    pageId,
  });

  return NextResponse.json(responsePayload);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleGetPage(request, subdomain, pageId);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleUpdatePage(request, subdomain, pageId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleDisconnectPage(request, subdomain, pageId);
}
