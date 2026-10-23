import { type NextRequest, NextResponse } from 'next/server';
import {
  type DatabasePageQueueSlotRow,
  canAccessTenant,
  CreateQueueSlotRequestSchema,
  getSessionSecret,
  ListQueueSlotsResponseSchema,
  PageQueueSlotSchema,
  UpdateQueueScheduleTimezoneRequestSchema,
  UpdateQueueScheduleTimezoneResponseSchema,
  verifySessionToken,
  type DatabaseClient,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/auth/clients';
import { logServerError } from '@/lib/server-analytics';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import { recomputeSlotScheduledTime } from '@/lib/slot-scheduler';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleListQueueSlots(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient | SupabaseClient
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

  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

/** Slot row as consumed here (spec 137 §3.7): the contracts slot row
 * plus the allowed_formats column the contracts type does not model. */
type SlotRow = DatabasePageQueueSlotRow & { allowed_formats?: string[] | null };

  let slotRows: SlotRow[] = [];
  let pageTimezone = 'UTC';

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    // 1. Verify page exists and belongs to user and workspace
    const pageRows = (await dbClient.query(
      'SELECT id, timezone FROM facebook_pages WHERE id = $1 AND user_id = $2 AND workspace_id = $3',
      [pageId, session.userId, workspaceId]
    )) as Record<string, unknown>[];

    if (!pageRows || pageRows.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    pageTimezone = String(pageRows[0].timezone || 'UTC');

    // 2. Fetch slots for this page and user
    slotRows = await dbClient.query<SlotRow>(
      `SELECT id, user_id, fb_page_id, slot_time, is_active, allowed_formats, created_at, updated_at
       FROM page_queue_slots
       WHERE fb_page_id = $1 AND user_id = $2
       ORDER BY slot_time ASC`,
      [pageId, session.userId]
    );
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: pageData, error: pageErr } = await supabase
      .from('facebook_pages')
      .select('id, timezone')
      .eq('id', pageId)
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (pageErr || !pageData) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    pageTimezone = String(pageData.timezone || 'UTC');

    const { data: slotsData, error: slotsErr } = await supabase
      .from('page_queue_slots')
      .select('id, user_id, fb_page_id, slot_time, is_active, allowed_formats, created_at, updated_at')
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
    timezone: pageTimezone,
    isActive: Boolean(row.is_active),
    allowedFormats: Array.isArray(row.allowed_formats) ? row.allowed_formats : ['text', 'image', 'reel', 'video', 'story'],
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
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
  dbClient?: DatabaseClient | SupabaseClient
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

  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
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

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    // 1. Verify page exists and belongs to user and workspace
    const pageRows = (await dbClient.query(
      'SELECT id, timezone FROM facebook_pages WHERE id = $1 AND user_id = $2 AND workspace_id = $3',
      [pageId, session.userId, workspaceId]
    )) as Record<string, unknown>[];

    if (!pageRows || pageRows.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    const pageTimezone = String(pageRows[0].timezone || 'UTC');

    // 2. Insert slot
    try {
      const allowedFormats = parsed.data.allowedFormats ?? ['text', 'image', 'reel', 'video', 'story'];
      const rows = (await dbClient.query(
        `INSERT INTO page_queue_slots (user_id, fb_page_id, slot_time, is_active, allowed_formats, created_at, updated_at)
         VALUES ($1, $2, $3, true, $4, now(), now())
         RETURNING id, user_id, fb_page_id, slot_time, is_active, allowed_formats, created_at, updated_at`,
        [session.userId, pageId, parsed.data.slotTime, allowedFormats]
      )) as Record<string, unknown>[];

      const row = rows[0];
      const responsePayload = PageQueueSlotSchema.parse({
        id: row.id,
        userId: row.user_id,
        pageId: row.fb_page_id,
        slotTime: typeof row.slot_time === 'string' ? row.slot_time : String(row.slot_time),
        timezone: pageTimezone,
        isActive: Boolean(row.is_active),
        allowedFormats: Array.isArray(row.allowed_formats) ? row.allowed_formats : allowedFormats,
        createdAt: new Date(row.created_at as string).toISOString(),
        updatedAt: new Date(row.updated_at as string).toISOString(),
      });

      return NextResponse.json(responsePayload, { status: 201 });
    } catch (err: unknown) {
      if (
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        err.code === '23505'
      ) {
        return NextResponse.json(
          {
            error: 'SLOT_ALREADY_EXISTS',
            message: 'A publishing slot at this time already exists for this page',
          },
          { status: 409 }
        );
      }
      logServerError('[pages/slots] Failed to create queue slot', err, {
        source: 'page-slots',
        subdomain,
      });
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to create queue slot' },
        { status: 500 }
      );
    }
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: pageData, error: pageErr } = await supabase
      .from('facebook_pages')
      .select('id, timezone')
      .eq('id', pageId)
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (pageErr || !pageData) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    const pageTimezone = String(pageData.timezone || 'UTC');

    const allowedFormats = parsed.data.allowedFormats ?? ['text', 'image', 'reel', 'video', 'story'];
    const { data: inserted, error: insertErr } = await supabase
      .from('page_queue_slots')
      .insert({
        user_id: session.userId,
        fb_page_id: pageId,
        slot_time: parsed.data.slotTime,
        is_active: true,
        allowed_formats: allowedFormats,
      })
      .select('id, user_id, fb_page_id, slot_time, is_active, allowed_formats, created_at, updated_at')
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
      timezone: pageTimezone,
      isActive: Boolean(inserted.is_active),
      allowedFormats: Array.isArray(inserted.allowed_formats) ? inserted.allowed_formats : allowedFormats,
      createdAt: new Date(inserted.created_at).toISOString(),
      updatedAt: new Date(inserted.updated_at).toISOString(),
    });

    return NextResponse.json(responsePayload, { status: 201 });
  }
}

async function realignPendingQueueItemsPostgres(
  dbClient: DatabaseClient,
  pageId: string,
  userId: string,
  newTimezone: string
): Promise<number> {
  const pendingRows = (await dbClient.query(
    `SELECT qi.id, qi.scheduled_time, s.slot_time
     FROM legacy_queue_items qi
     JOIN page_queue_slots s ON s.id = qi.slot_id
     WHERE qi.fb_page_id = $1 AND qi.user_id = $2 AND qi.status = 'queued'
     ORDER BY qi.scheduled_time ASC`,
    [pageId, userId]
  )) as Record<string, unknown>[];

  if (!pendingRows || pendingRows.length === 0) {
    return 0;
  }

  const occupiedTimes = new Set<number>();
  const now = new Date();
  let realignedCount = 0;

  for (const row of pendingRows) {
    const originalTime = new Date(row.scheduled_time as string);
    const slotTimeStr = typeof row.slot_time === 'string' ? row.slot_time : String(row.slot_time);
    const newScheduledTime = recomputeSlotScheduledTime({
      originalScheduledTime: originalTime,
      slotTime: slotTimeStr,
      newTimezone,
      now,
      occupiedTimes,
    });
    occupiedTimes.add(newScheduledTime.getTime());

    await dbClient.query(
      `UPDATE legacy_queue_items
       SET scheduled_time = $1, updated_at = now()
       WHERE id = $2`,
      [newScheduledTime.toISOString(), row.id]
    );
    realignedCount++;
  }

  return realignedCount;
}

async function realignPendingQueueItemsSupabase(
  supabase: SupabaseClient,
  pageId: string,
  userId: string,
  newTimezone: string
): Promise<number> {
  const { data: queueData, error: queueErr } = await supabase
    .from('legacy_queue_items')
    .select('id, scheduled_time, slot_id')
    .eq('fb_page_id', pageId)
    .eq('user_id', userId)
    .eq('status', 'queued')
    .not('slot_id', 'is', null)
    .order('scheduled_time', { ascending: true });

  if (queueErr || !queueData || queueData.length === 0) {
    return 0;
  }

  const slotIds = [...new Set(queueData.map((item) => item.slot_id).filter(Boolean))];
  const { data: slotsData, error: slotsErr } = await supabase
    .from('page_queue_slots')
    .select('id, slot_time')
    .in('id', slotIds);

  if (slotsErr || !slotsData || slotsData.length === 0) {
    return 0;
  }

  const slotMap = new Map<string, string>();
  for (const s of slotsData) {
    slotMap.set(s.id, typeof s.slot_time === 'string' ? s.slot_time : String(s.slot_time));
  }

  const occupiedTimes = new Set<number>();
  const now = new Date();
  let realignedCount = 0;

  for (const item of queueData) {
    const slotTime = slotMap.get(item.slot_id);
    if (!slotTime) continue;

    const originalTime = new Date(item.scheduled_time);
    const newScheduledTime = recomputeSlotScheduledTime({
      originalScheduledTime: originalTime,
      slotTime,
      newTimezone,
      now,
      occupiedTimes,
    });
    occupiedTimes.add(newScheduledTime.getTime());

    await supabase
      .from('legacy_queue_items')
      .update({
        scheduled_time: newScheduledTime.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', item.id);
    realignedCount++;
  }

  return realignedCount;
}

async function updateScheduleTimezonePostgres(
  dbClient: DatabaseClient,
  pageId: string,
  userId: string,
  workspaceId: string,
  newTimezone: string
): Promise<{ notFound?: boolean; updatedCount?: number; realignedQueueCount?: number }> {
  const updatedPages = (await dbClient.query(
    `UPDATE facebook_pages
     SET timezone = $1, updated_at = now()
     WHERE id = $2 AND user_id = $3 AND workspace_id = $4
     RETURNING id`,
    [newTimezone, pageId, userId, workspaceId]
  )) as Record<string, unknown>[];

  if (!updatedPages || updatedPages.length === 0) {
    return { notFound: true };
  }

  const slotRows = await dbClient.query<{ count: number }>(
    'SELECT count(*)::int as count FROM page_queue_slots WHERE fb_page_id = $1 AND user_id = $2',
    [pageId, userId]
  );

  const realignedQueueCount = await realignPendingQueueItemsPostgres(
    dbClient,
    pageId,
    userId,
    newTimezone
  );

  return {
    updatedCount: Number(slotRows[0]?.count ?? 0),
    realignedQueueCount,
  };
}

async function updateScheduleTimezoneSupabase(
  supabase: SupabaseClient,
  pageId: string,
  userId: string,
  workspaceId: string,
  newTimezone: string
): Promise<{ notFound?: boolean; error?: string; updatedCount?: number; realignedQueueCount?: number }> {
  const { data: updatedPage, error: updateErr } = await supabase
    .from('facebook_pages')
    .update({
      timezone: newTimezone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pageId)
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .select('id')
    .maybeSingle();

  if (updateErr) {
    return { error: updateErr.message };
  }

  if (!updatedPage) {
    return { notFound: true };
  }

  const { count } = await supabase
    .from('page_queue_slots')
    .select('id', { count: 'exact', head: true })
    .eq('fb_page_id', pageId)
    .eq('user_id', userId);

  const realignedQueueCount = await realignPendingQueueItemsSupabase(
    supabase,
    pageId,
    userId,
    newTimezone
  );

  return {
    updatedCount: count ?? 0,
    realignedQueueCount,
  };
}

export async function handleUpdateQueueScheduleTimezone(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient | SupabaseClient
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

  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
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

  const parsed = UpdateQueueScheduleTimezoneRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const newTimezone = parsed.data.timezone;

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    const result = await updateScheduleTimezonePostgres(
      dbClient as DatabaseClient,
      pageId,
      session.userId,
      workspaceId,
      newTimezone
    );

    if (result.notFound) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const responsePayload = UpdateQueueScheduleTimezoneResponseSchema.parse({
      success: true,
      timezone: newTimezone,
      updatedCount: result.updatedCount ?? 0,
      realignedQueueCount: result.realignedQueueCount ?? 0,
    });
    return NextResponse.json(responsePayload);
  }

  const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient | null;
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const result = await updateScheduleTimezoneSupabase(
    supabase,
    pageId,
    session.userId,
    workspaceId,
    newTimezone
  );

  if (result.notFound) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }
  if (result.error) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: result.error }, { status: 500 });
  }

  const responsePayload = UpdateQueueScheduleTimezoneResponseSchema.parse({
    success: true,
    timezone: newTimezone,
    updatedCount: result.updatedCount ?? 0,
    realignedQueueCount: result.realignedQueueCount ?? 0,
  });
  return NextResponse.json(responsePayload);
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleUpdateQueueScheduleTimezone(request, subdomain, pageId);
}
