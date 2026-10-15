import { type NextRequest, NextResponse } from 'next/server';
import {
  canAccessTenant,
  getSessionSecret,
  PageQueueSlotSchema,
  UpdateQueueSlotRequestSchema,
  verifySessionToken,
  type DatabaseClient,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleUpdateQueueSlot(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  slotId: string,
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

  const parsed = UpdateQueueSlotRequestSchema.safeParse(rawBody);
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

    // 2. Update slot scoped to user, page, and slot id
    try {
      const updateRows = (await dbClient.query(
        `UPDATE page_queue_slots
         SET slot_time = COALESCE($1, slot_time),
             timezone = COALESCE($2, timezone),
             is_active = COALESCE($3, is_active),
             allowed_formats = COALESCE($4, allowed_formats),
             updated_at = now()
         WHERE id = $5 AND fb_page_id = $6 AND user_id = $7
         RETURNING id, user_id, fb_page_id, slot_time, timezone, is_active, allowed_formats, created_at, updated_at`,
        [
          parsed.data.slotTime ?? null,
          parsed.data.timezone ?? null,
          parsed.data.isActive ?? null,
          parsed.data.allowedFormats ?? null,
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
        allowedFormats: Array.isArray(row.allowed_formats) ? row.allowed_formats : ['text', 'image', 'reel', 'video', 'story'],
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

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.slotTime !== undefined) updatePayload.slot_time = parsed.data.slotTime;
    if (parsed.data.timezone !== undefined) updatePayload.timezone = parsed.data.timezone;
    if (parsed.data.isActive !== undefined) updatePayload.is_active = parsed.data.isActive;
    if (parsed.data.allowedFormats !== undefined) updatePayload.allowed_formats = parsed.data.allowedFormats;

    const { data: updated, error: updateErr } = await supabase
      .from('page_queue_slots')
      .update(updatePayload)
      .eq('id', slotId)
      .eq('fb_page_id', pageId)
      .eq('user_id', session.userId)
      .select('id, user_id, fb_page_id, slot_time, timezone, is_active, allowed_formats, created_at, updated_at')
      .maybeSingle();

    if (updateErr) {
      if (updateErr.code === '23505') {
        return NextResponse.json(
          {
            error: 'SLOT_ALREADY_EXISTS',
            message: 'A publishing slot at this time already exists for this page',
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: updateErr.message },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    const responsePayload = PageQueueSlotSchema.parse({
      id: updated.id,
      userId: updated.user_id,
      pageId: updated.fb_page_id,
      slotTime: typeof updated.slot_time === 'string' ? updated.slot_time : String(updated.slot_time),
      timezone: updated.timezone,
      isActive: Boolean(updated.is_active),
      allowedFormats: Array.isArray(updated.allowed_formats) ? updated.allowed_formats : ['text', 'image', 'reel', 'video', 'story'],
      createdAt: new Date(updated.created_at).toISOString(),
      updatedAt: new Date(updated.updated_at).toISOString(),
    });

    return NextResponse.json(responsePayload, { status: 200 });
  }
}

export async function handleDeleteQueueSlot(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  slotId: string,
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

  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    // 2. Delete slot scoped to slotId, pageId, and userId
    const deleteRows = (await dbClient.query(
      `DELETE FROM page_queue_slots
       WHERE id = $1 AND fb_page_id = $2 AND user_id = $3
       RETURNING id`,
      [slotId, pageId, session.userId]
    )) as any[];

    if (!deleteRows || deleteRows.length === 0) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, slotId });
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

    const { data: deleted, error: delErr } = await supabase
      .from('page_queue_slots')
      .delete()
      .eq('id', slotId)
      .eq('fb_page_id', pageId)
      .eq('user_id', session.userId)
      .select('id');

    if (delErr || !deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, slotId });
  }
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
