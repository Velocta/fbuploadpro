import { type NextRequest, NextResponse } from 'next/server';
import {
  CreateQueueSlotRequestSchema,
  getSessionSecret,
  ListQueueSlotsResponseSchema,
  PageQueueSlotSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { DatabaseClient, Database } from '@fbuploadpro/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleListQueueSlots(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();

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

  let slotRows: any[] = [];

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    // 1. Verify page exists and belongs to user
    const pageRows = (await dbClient.query(
      'SELECT id FROM facebook_pages WHERE id = $1 AND user_id = $2',
      [pageId, session.userId]
    )) as any[];

    if (!pageRows || pageRows.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // 2. Fetch slots for this page and user
    slotRows = (await dbClient.query(
      `SELECT id, user_id, fb_page_id, slot_time, timezone, is_active, created_at, updated_at
       FROM page_queue_slots
       WHERE fb_page_id = $1 AND user_id = $2
       ORDER BY slot_time ASC`,
      [pageId, session.userId]
    )) as any[];
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()) as SupabaseClient<any> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: pageData, error: pageErr } = await supabase
      .from('facebook_pages')
      .select('id')
      .eq('id', pageId)
      .eq('user_id', session.userId)
      .maybeSingle();

    if (pageErr || !pageData) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const { data: slotsData, error: slotsErr } = await supabase
      .from('page_queue_slots')
      .select('id, user_id, fb_page_id, slot_time, timezone, is_active, created_at, updated_at')
      .eq('fb_page_id', pageId)
      .eq('user_id', session.userId)
      .order('slot_time', { ascending: true });

    if (slotsErr) {
      return NextResponse.json({ error: slotsErr.message }, { status: 500 });
    }
    slotRows = slotsData || [];
  }

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
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();

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

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    // 1. Verify page exists and belongs to user
    const pageRows = (await dbClient.query(
      'SELECT id FROM facebook_pages WHERE id = $1 AND user_id = $2',
      [pageId, session.userId]
    )) as any[];

    if (!pageRows || pageRows.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // 2. Insert slot
    try {
      const rows = (await dbClient.query(
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
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()) as SupabaseClient<any> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: pageData, error: pageErr } = await supabase
      .from('facebook_pages')
      .select('id')
      .eq('id', pageId)
      .eq('user_id', session.userId)
      .maybeSingle();

    if (pageErr || !pageData) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('page_queue_slots')
      .insert({
        user_id: session.userId,
        fb_page_id: pageId,
        slot_time: parsed.data.slotTime,
        timezone: parsed.data.timezone ?? 'UTC',
        is_active: true,
      })
      .select('id, user_id, fb_page_id, slot_time, timezone, is_active, created_at, updated_at')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json(
          {
            error: 'SLOT_ALREADY_EXISTS',
            message: 'A publishing slot at this time already exists for this page',
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: insertErr.message },
        { status: 500 }
      );
    }

    const responsePayload = PageQueueSlotSchema.parse({
      id: inserted.id,
      userId: inserted.user_id,
      pageId: inserted.fb_page_id,
      slotTime: typeof inserted.slot_time === 'string' ? inserted.slot_time : String(inserted.slot_time),
      timezone: inserted.timezone,
      isActive: Boolean(inserted.is_active),
      createdAt: new Date(inserted.created_at).toISOString(),
      updatedAt: new Date(inserted.updated_at).toISOString(),
    });

    return NextResponse.json(responsePayload, { status: 201 });
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
