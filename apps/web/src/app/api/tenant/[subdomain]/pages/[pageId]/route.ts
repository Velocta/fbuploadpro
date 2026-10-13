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

async function authenticateTenantRequest(
  request: NextRequest,
  subdomain: string
): Promise<{ errorResponse?: NextResponse; session?: any }> {
  const secretKey =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';

  const token = request.cookies.get('fbup_session')?.value;
  if (!token) {
    return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  try {
    const verified = await verifySessionToken(token, secretKey);
    if (verified.subdomain !== subdomain && verified.role !== 'admin') {
      return { errorResponse: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { session: verified };
  } catch (_e) {
    return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
}

async function fetchActivePageById(db: DatabaseClient, pageId: string, userId: string) {
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
    [pageId, userId]
  )) as any[];

  if (!rows || rows.length === 0 || !rows[0]) {
    return null;
  }
  return formatPageRow(rows[0]);
}

export async function handleGetPage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const auth = await authenticateTenantRequest(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session!;

  const db = dbClient ?? getDbClient();
  const page = await fetchActivePageById(db, pageId, session.userId);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  return NextResponse.json({ page });
}

export async function handleUpdatePage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const auth = await authenticateTenantRequest(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session!;

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

  const page = await fetchActivePageById(db, pageId, session.userId);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, page });
}

export async function handleDisconnectPage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const auth = await authenticateTenantRequest(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session!;

  const db = dbClient ?? getDbClient();

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
