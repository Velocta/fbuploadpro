import { type NextRequest, NextResponse } from 'next/server';
import {
  QueueItemSchema,
  UpdateQueueItemRequestSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleUpdateQueueItem(
  request: NextRequest,
  subdomain: string,
  itemId: string,
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

  const db = dbClient ?? getDbClient();

  // 4. Check existing item
  const existingRows = (await db.query(
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
  const resolveScheduledTime = (): string => {
    if (parsed.data.scheduledTime !== undefined) {
      return new Date(parsed.data.scheduledTime).toISOString();
    }
    if (existing.scheduled_time) {
      return new Date(existing.scheduled_time).toISOString();
    }
    return new Date().toISOString();
  };

  const newCaption = parsed.data.caption ?? existing.caption ?? '';
  const newFirstComment = parsed.data.firstComment ?? existing.first_comment ?? null;
  const newScheduledTime = resolveScheduledTime();
  const newStatus = parsed.data.status ?? existing.status;

  const updateRows = (await db.query(
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
  const mediaRows = (await db.query(
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

export async function handleDeleteQueueItem(
  request: NextRequest,
  subdomain: string,
  itemId: string,
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

  // 3. Check existing item
  const existingRows = (await db.query(
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
  await db.query(
    `DELETE FROM queue_items WHERE id = $1 AND user_id = $2`,
    [itemId, session.userId]
  );

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
