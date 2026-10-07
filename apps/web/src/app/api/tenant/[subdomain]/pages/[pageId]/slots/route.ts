import { type NextRequest, NextResponse } from 'next/server';
import {
  CreateQueueSlotRequestSchema,
  ListQueueSlotsResponseSchema,
  PageQueueSlotSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleListQueueSlots(
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

  // 1. Verify page exists and belongs to user
  const pageRows = (await db.query(
    'SELECT id FROM facebook_pages WHERE id = $1 AND user_id = $2',
    [pageId, session.userId]
  )) as any[];

  if (!pageRows || pageRows.length === 0) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  // 2. Fetch slots for this page and user
  const slotRows = (await db.query(
    `SELECT id, user_id, fb_page_id, slot_time, timezone, is_active, created_at, updated_at
     FROM page_queue_slots
     WHERE fb_page_id = $1 AND user_id = $2
     ORDER BY slot_time ASC`,
    [pageId, session.userId]
  )) as any[];

  const slots = slotRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    pageId: row.fb_page_id,
    slotTime: typeof row.slot_time === 'string' ? row.slot_time : String(row.slot_time),
    timezone: row.timezone,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));

  const responsePayload = ListQueueSlotsResponseSchema.parse({
    slots,
    total: slots.length,
  });

  return NextResponse.json(responsePayload);
}

export async function handleCreateQueueSlot(
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
      { error: 'INVALID_REQUEST', message: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const payloadToValidate =
    typeof rawBody === 'object' && rawBody !== null
      ? { pageId, ...rawBody }
      : rawBody;

  const parsed = CreateQueueSlotRequestSchema.safeParse(payloadToValidate);
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

  // 2. Insert slot
  try {
    const rows = (await db.query(
      `INSERT INTO page_queue_slots (user_id, fb_page_id, slot_time, timezone, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, now(), now())
       RETURNING id, user_id, fb_page_id, slot_time, timezone, is_active, created_at, updated_at`,
      [session.userId, pageId, parsed.data.slotTime, parsed.data.timezone ?? 'UTC']
    )) as any[];

    const row = rows[0];
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

    return NextResponse.json(responsePayload, { status: 201 });
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
      { error: 'INTERNAL_ERROR', message: 'Failed to create queue slot' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleListQueueSlots(request, subdomain, pageId);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleCreateQueueSlot(request, subdomain, pageId);
}
