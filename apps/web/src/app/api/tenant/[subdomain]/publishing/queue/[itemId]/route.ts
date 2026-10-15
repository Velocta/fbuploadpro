import { type NextRequest, NextResponse } from 'next/server';
import {
  canAccessTenant,
  getSessionSecret,
  QueueItemSchema,
  UpdateQueueItemRequestSchema,
  verifySessionToken,
  type DatabaseClient,
} from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

function resolveScheduledTime(
  requestedTime?: string | null,
  existingTime?: string | null
): string {
  if (requestedTime !== undefined && requestedTime !== null) {
    return new Date(requestedTime).toISOString();
  }
  if (existingTime) {
    return new Date(existingTime).toISOString();
  }
  return new Date().toISOString();
}

export async function handleUpdateQueueItem(
  request: NextRequest,
  subdomain: string,
  itemId: string,
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
  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Request body validation
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = UpdateQueueItemRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }

  if (isLegacyClient(dbClient)) {
    // 4. Check existing item
    const existingRows = (await dbClient.query(
      `SELECT qi.id, qi.user_id, qi.fb_page_id, qi.slot_id, qi.media_id, qi.scheduled_time, qi.caption, qi.first_comment, qi.status, qi.retry_count, qi.max_retries, qi.fb_post_id, qi.fb_comment_id, qi.published_at, qi.created_at, qi.updated_at
       FROM queue_items qi
       WHERE qi.id = $1 AND qi.user_id = $2`,
      [itemId, session.userId]
    )) as any[];

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    const existing = existingRows[0];

    if (existing.status === 'published') {
      return NextResponse.json(
        { error: 'CANNOT_UPDATE_PUBLISHED_ITEM', message: 'Published queue items cannot be modified' },
        { status: 400 }
      );
    }

    // 5. Compute updated values
    const newCaption = parsed.data.caption ?? existing.caption ?? '';
    const newFirstComment = parsed.data.firstComment ?? existing.first_comment ?? null;
    const newScheduledTime = resolveScheduledTime(parsed.data.scheduledTime, existing.scheduled_time);
    const newStatus = parsed.data.status ?? existing.status;

    const updateRows = (await dbClient.query(
      `UPDATE queue_items
       SET caption = $1,
           first_comment = $2,
           scheduled_time = $3,
           status = $4,
           updated_at = now()
       WHERE id = $5 AND user_id = $6
       RETURNING id, user_id, fb_page_id, slot_id, media_id, scheduled_time, caption, first_comment, status, retry_count, max_retries, fb_post_id, fb_comment_id, published_at, created_at, updated_at`,
      [newCaption, newFirstComment, newScheduledTime, newStatus, itemId, session.userId]
    )) as any[];

    const updated = updateRows[0];

    // 6. Fetch joined media details
    const mediaRows = (await dbClient.query(
      `SELECT id, name, media_type, url, thumbnail_url, aspect_ratio, duration_seconds
       FROM media_items
       WHERE id = $1 AND user_id = $2`,
      [updated.media_id, session.userId]
    )) as any[];

    const mediaRecord = mediaRows[0];

    const queueItem = {
      id: updated.id,
      userId: updated.user_id,
      pageId: updated.fb_page_id,
      slotId: updated.slot_id ?? null,
      mediaId: updated.media_id,
      scheduledTime: new Date(updated.scheduled_time).toISOString(),
      caption: updated.caption ?? '',
      firstComment: updated.first_comment ?? null,
      status: updated.status,
      retryCount: Number(updated.retry_count ?? 0),
      maxRetries: Number(updated.max_retries ?? 3),
      fbPostId: updated.fb_post_id ?? null,
      fbCommentId: updated.fb_comment_id ?? null,
      publishedAt: updated.published_at ? new Date(updated.published_at).toISOString() : null,
      createdAt: new Date(updated.created_at).toISOString(),
      updatedAt: new Date(updated.updated_at).toISOString(),
      ...(mediaRecord
        ? {
            media: {
              name: mediaRecord.name,
              mediaType: mediaRecord.media_type,
              url: mediaRecord.url,
              thumbnailUrl: mediaRecord.thumbnail_url ?? null,
              aspectRatio: mediaRecord.aspect_ratio ?? 'unknown',
              durationSeconds:
                mediaRecord.duration_seconds != null ? Number(mediaRecord.duration_seconds) : null,
            },
          }
        : {}),
    };

    const validated = QueueItemSchema.parse(queueItem);
    return NextResponse.json(validated, { status: 200 });
  }

  const supabase = getRouteSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const { data: existing, error: existErr } = await supabase
    .from('queue_items')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', session.userId)
    .maybeSingle();

  if (existErr || !existing) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
  }

  if (existing.status === 'published') {
    return NextResponse.json(
      { error: 'CANNOT_UPDATE_PUBLISHED_ITEM', message: 'Published queue items cannot be modified' },
      { status: 400 }
    );
  }

  const newCaption = parsed.data.caption ?? existing.caption ?? '';
  const newFirstComment = parsed.data.firstComment ?? existing.first_comment ?? null;
  const newScheduledTime = resolveScheduledTime(parsed.data.scheduledTime, existing.scheduled_time);
  const newStatus = parsed.data.status ?? existing.status;

  const { data: updated, error: updateErr } = await supabase
    .from('queue_items')
    .update({
      caption: newCaption,
      first_comment: newFirstComment,
      scheduled_time: newScheduledTime,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', session.userId)
    .select()
    .single();

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'Failed to update queue item' }, { status: 500 });
  }

  const { data: mediaRecord } = await supabase
    .from('media_items')
    .select('id, name, media_type, url, thumbnail_url, aspect_ratio, duration_seconds')
    .eq('id', updated.media_id)
    .eq('user_id', session.userId)
    .maybeSingle();

  const queueItem = {
    id: updated.id,
    userId: updated.user_id,
    pageId: updated.fb_page_id,
    slotId: updated.slot_id ?? null,
    mediaId: updated.media_id,
    scheduledTime: new Date(updated.scheduled_time).toISOString(),
    caption: updated.caption ?? '',
    firstComment: updated.first_comment ?? null,
    status: updated.status,
    retryCount: Number(updated.retry_count ?? 0),
    maxRetries: Number(updated.max_retries ?? 3),
    fbPostId: updated.fb_post_id ?? null,
    fbCommentId: updated.fb_comment_id ?? null,
    publishedAt: updated.published_at ? new Date(updated.published_at).toISOString() : null,
    createdAt: new Date(updated.created_at).toISOString(),
    updatedAt: new Date(updated.updated_at).toISOString(),
    ...(mediaRecord
      ? {
          media: {
            name: mediaRecord.name,
            mediaType: mediaRecord.media_type,
            url: mediaRecord.url,
            thumbnailUrl: mediaRecord.thumbnail_url ?? null,
            aspectRatio: mediaRecord.aspect_ratio ?? 'unknown',
            durationSeconds:
              mediaRecord.duration_seconds != null ? Number(mediaRecord.duration_seconds) : null,
          },
        }
      : {}),
  };

  const validated = QueueItemSchema.parse(queueItem);
  return NextResponse.json(validated, { status: 200 });
}

export async function handleDeleteQueueItem(
  request: NextRequest,
  subdomain: string,
  itemId: string,
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
  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (isLegacyClient(dbClient)) {
    // 3. Check existing item
    const existingRows = (await dbClient.query(
      `SELECT id, user_id, status FROM queue_items WHERE id = $1 AND user_id = $2`,
      [itemId, session.userId]
    )) as any[];

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    const existing = existingRows[0];
    if (existing.status === 'published') {
      return NextResponse.json(
        { error: 'CANNOT_DELETE_PUBLISHED_ITEM', message: 'Published queue items cannot be deleted' },
        { status: 400 }
      );
    }

    // 4. Delete item
    await dbClient.query(
      `DELETE FROM queue_items WHERE id = $1 AND user_id = $2`,
      [itemId, session.userId]
    );

    return NextResponse.json({ success: true, itemId }, { status: 200 });
  }

  const supabase = getRouteSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const { data: existing, error: existErr } = await supabase
    .from('queue_items')
    .select('id, user_id, status')
    .eq('id', itemId)
    .eq('user_id', session.userId)
    .maybeSingle();

  if (existErr || !existing) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
  }

  if (existing.status === 'published') {
    return NextResponse.json(
      { error: 'CANNOT_DELETE_PUBLISHED_ITEM', message: 'Published queue items cannot be deleted' },
      { status: 400 }
    );
  }

  const { error: deleteErr } = await supabase
    .from('queue_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', session.userId);

  if (deleteErr) {
    return NextResponse.json({ error: 'Failed to delete queue item' }, { status: 500 });
  }

  return NextResponse.json({ success: true, itemId }, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; itemId: string }> }
): Promise<NextResponse> {
  const { subdomain, itemId } = await context.params;
  return handleUpdateQueueItem(request, subdomain, itemId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; itemId: string }> }
): Promise<NextResponse> {
  const { subdomain, itemId } = await context.params;
  return handleDeleteQueueItem(request, subdomain, itemId);
}
