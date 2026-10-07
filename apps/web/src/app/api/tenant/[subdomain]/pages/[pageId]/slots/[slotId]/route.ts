import { type NextRequest, NextResponse } from 'next/server';
import {
  PageQueueSlotSchema,
  UpdateQueueSlotRequestSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleUpdateQueueSlot(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  slotId: string,
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
      { error: 'INVALID_REQUEST', message: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const parsed = UpdateQueueSlotRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();

  // 1. Verify page exists and belongs to user
  const pageRows = (await db.query(
    'SELECT id FROM facebook_pages WHERE id = $1 AND user_id = $2',
    [pageId, session.userId]
  )) as any[];

  if (!pageRows || pageRows.length === 0) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  // 2. Update slot scoped to user, page, and slot id
  try {
    const updateRows = (await db.query(
      `UPDATE page_queue_slots
       SET slot_time = COALESCE($1, slot_time),
           timezone = COALESCE($2, timezone),
           is_active = COALESCE($3, is_active),
           updated_at = now()
       WHERE id = $4 AND fb_page_id = $5 AND user_id = $6
       RETURNING id, user_id, fb_page_id, slot_time, timezone, is_active, created_at, updated_at`,
      [
        parsed.data.slotTime ?? null,
        parsed.data.timezone ?? null,
        parsed.data.isActive ?? null,
        slotId,
        pageId,
        session.userId,
      ]
    )) as any[];

    if (!updateRows || updateRows.length === 0) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    const row = updateRows[0];
    const responsePayload = PageQueueSlotSchema.parse({
      id: row.id,
      userId: row.user_id,
      pageId: row.fb_page_id,
      slotTime: typeof row.slot_time === 'string' ? row.slot_time : String(row.slot_time),
      timezone: row.timezone,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    });

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json(
        {
          error: 'SLOT_ALREADY_EXISTS',
          message: 'A publishing slot at this time already exists for this page',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update queue slot' },
      { status: 500 }
    );
  }
}

export async function handleDeleteQueueSlot(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  slotId: string,
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

  // 1. Verify page exists and belongs to user
  const pageRows = (await db.query(
    'SELECT id FROM facebook_pages WHERE id = $1 AND user_id = $2',
    [pageId, session.userId]
  )) as any[];

  if (!pageRows || pageRows.length === 0) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  // 2. Delete slot scoped to slotId, pageId, and userId
  const deleteRows = (await db.query(
    `DELETE FROM page_queue_slots
     WHERE id = $1 AND fb_page_id = $2 AND user_id = $3
     RETURNING id`,
    [slotId, pageId, session.userId]
  )) as any[];

  if (!deleteRows || deleteRows.length === 0) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, slotId });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string; slotId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId, slotId } = await context.params;
  return handleUpdateQueueSlot(request, subdomain, pageId, slotId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string; slotId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId, slotId } = await context.params;
  return handleDeleteQueueSlot(request, subdomain, pageId, slotId);
}
