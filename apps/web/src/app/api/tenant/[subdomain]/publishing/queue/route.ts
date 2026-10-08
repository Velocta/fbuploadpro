import { type NextRequest, NextResponse } from 'next/server';
import {
  EnqueueMediaRequestSchema,
  ListQueueItemsQuerySchema,
  ListQueueItemsResponseSchema,
  QueueItemSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { calculateNextVacantSlot } from '../../../../../../lib/slot-scheduler';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleEnqueueMedia(
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

  const parsed = EnqueueMediaRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { pageId, mediaId, slotId: requestedSlotId, scheduledTime: requestedScheduledTime, caption, firstComment } =
    parsed.data;

  const db = dbClient ?? getDbClient();

  // 4. Verify page exists and belongs to user
  const pageRows = (await db.query(
    'SELECT id FROM facebook_pages WHERE id = $1 AND user_id = $2',
    [pageId, session.userId]
  )) as any[];

  if (!pageRows || pageRows.length === 0) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  // 6. Verify media item exists and belongs to user
  const mediaRows = (await db.query(
    `SELECT id, name, media_type, url, thumbnail_url, aspect_ratio, duration_seconds
     FROM media_items
     WHERE id = $1 AND user_id = $2`,
    [mediaId, session.userId]
  )) as any[];

  if (!mediaRows || mediaRows.length === 0) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  const mediaRecord = mediaRows[0];

  // 7. Resolve slot and scheduledTime
  let finalSlotId: string | null = null;
  let finalScheduledTime: string;

  if (requestedSlotId) {
    // Validate requested slot
    const slotRows = (await db.query(
      `SELECT id, slot_time, timezone, is_active
       FROM page_queue_slots
       WHERE id = $1 AND fb_page_id = $2 AND user_id = $3`,
      [requestedSlotId, pageId, session.userId]
    )) as any[];

    if (!slotRows || slotRows.length === 0) {
      return NextResponse.json(
        { error: 'Queue slot not found' },
        { status: 404 }
      );
    }

    const slot = slotRows[0];
    finalSlotId = slot.id;

    if (requestedScheduledTime) {
      finalScheduledTime = new Date(requestedScheduledTime).toISOString();
    } else {
      const existingQueued = (await db.query(
        `SELECT scheduled_time FROM queue_items WHERE fb_page_id = $1 AND user_id = $2 AND status = 'queued'`,
        [pageId, session.userId]
      )) as any[];

      const computed = calculateNextVacantSlot({
        slots: [
          {
            id: slot.id,
            slotTime:
              typeof slot.slot_time === 'string'
                ? slot.slot_time
                : String(slot.slot_time),
            timezone: slot.timezone,
            isActive: Boolean(slot.is_active),
          },
        ],
        existingScheduledTimes: (existingQueued || []).map(
          (q: any) => new Date(q.scheduled_time)
        ),
        now: new Date(),
      });

      if (!computed) {
        return NextResponse.json(
          {
            error: 'NO_VACANT_SLOTS',
            message: 'No vacant slot available for specified slot',
          },
          { status: 400 }
        );
      }
      finalScheduledTime = computed.scheduledTime.toISOString();
    }
  } else if (requestedScheduledTime) {
    finalSlotId = null;
    finalScheduledTime = new Date(requestedScheduledTime).toISOString();
  } else {
    // Auto-compute next vacant slot across all active slots for this page
    const activeSlots = (await db.query(
      `SELECT id, slot_time, timezone, is_active
       FROM page_queue_slots
       WHERE fb_page_id = $1 AND user_id = $2 AND is_active = true
       ORDER BY slot_time ASC`,
      [pageId, session.userId]
    )) as any[];

    if (!activeSlots || activeSlots.length === 0) {
      return NextResponse.json(
        {
          error: 'NO_SLOTS_CONFIGURED',
          message:
            'No active queue slots configured for this page. Please configure a slot or provide scheduledTime.',
        },
        { status: 400 }
      );
    }

    const existingQueued = (await db.query(
      `SELECT scheduled_time FROM queue_items WHERE fb_page_id = $1 AND user_id = $2 AND status = 'queued'`,
      [pageId, session.userId]
    )) as any[];

    const computed = calculateNextVacantSlot({
      slots: activeSlots.map((s: any) => ({
        id: s.id,
        slotTime:
          typeof s.slot_time === 'string' ? s.slot_time : String(s.slot_time),
        timezone: s.timezone,
        isActive: Boolean(s.is_active),
      })),
      existingScheduledTimes: (existingQueued || []).map(
        (q: any) => new Date(q.scheduled_time)
      ),
      now: new Date(),
    });

    if (!computed) {
      return NextResponse.json(
        {
          error: 'NO_VACANT_SLOTS',
          message: 'No vacant slot available for this page',
        },
        { status: 400 }
      );
    }

    finalSlotId = computed.slotId;
    finalScheduledTime = computed.scheduledTime.toISOString();
  }

  // 8. Insert into queue_items
  const insertRows = (await db.query(
    `INSERT INTO queue_items (
       user_id,
       fb_page_id,
       slot_id,
       media_id,
       scheduled_time,
       caption,
       first_comment,
       status,
       retry_count,
       max_retries
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued', 0, 3)
     RETURNING
       id,
       user_id,
       fb_page_id,
       slot_id,
       media_id,
       scheduled_time,
       caption,
       first_comment,
       status,
       retry_count,
       max_retries,
       fb_post_id,
       fb_comment_id,
       published_at,
       created_at,
       updated_at`,
    [
      session.userId,
      pageId,
      finalSlotId,
      mediaId,
      finalScheduledTime,
      caption ?? '',
      firstComment ?? null,
    ]
  )) as any[];

  const createdRow = insertRows[0];

  const queueItem = {
    id: createdRow.id,
    userId: createdRow.user_id,
    pageId: createdRow.fb_page_id,
    slotId: createdRow.slot_id ?? null,
    mediaId: createdRow.media_id,
    scheduledTime: new Date(createdRow.scheduled_time).toISOString(),
    caption: createdRow.caption ?? '',
    firstComment: createdRow.first_comment ?? null,
    status: createdRow.status,
    retryCount: Number(createdRow.retry_count ?? 0),
    maxRetries: Number(createdRow.max_retries ?? 3),
    fbPostId: createdRow.fb_post_id ?? null,
    fbCommentId: createdRow.fb_comment_id ?? null,
    publishedAt: createdRow.published_at
      ? new Date(createdRow.published_at).toISOString()
      : null,
    createdAt: new Date(createdRow.created_at).toISOString(),
    updatedAt: new Date(createdRow.updated_at).toISOString(),
    media: {
      name: mediaRecord.name,
      mediaType: mediaRecord.media_type,
      url: mediaRecord.url,
      thumbnailUrl: mediaRecord.thumbnail_url ?? null,
      aspectRatio: mediaRecord.aspect_ratio ?? 'unknown',
      durationSeconds:
        mediaRecord.duration_seconds != null
          ? Number(mediaRecord.duration_seconds)
          : null,
    },
  };

  const validated = QueueItemSchema.parse(queueItem);
  return NextResponse.json(validated, { status: 201 });
}

export async function handleListQueueItems(
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

  const parsedQuery = ListQueueItemsQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'INVALID_QUERY', details: parsedQuery.error.issues },
      { status: 400 }
    );
  }

  const { pageId, status, limit, offset } = parsedQuery.data;

  const db = dbClient ?? getDbClient();

  // 4. Build query filters
  const conditions = ['qi.user_id = $1'];
  const params: any[] = [session.userId];

  if (pageId) {
    params.push(pageId);
    conditions.push(`qi.fb_page_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`qi.status = $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  // 5. Total count
  const countSql = `SELECT COUNT(*) AS total FROM queue_items qi WHERE ${whereClause}`;
  const countRows = (await db.query(countSql, params)) as any[];
  const total = countRows.length > 0 ? Number(countRows[0].total) : 0;

  // 6. Paginated list with joined media
  const listParams = [...params, limit, offset];
  const listSql = `
    SELECT
      qi.id,
      qi.user_id,
      qi.fb_page_id,
      qi.slot_id,
      qi.media_id,
      qi.scheduled_time,
      qi.caption,
      qi.first_comment,
      qi.status,
      qi.retry_count,
      qi.max_retries,
      qi.fb_post_id,
      qi.fb_comment_id,
      qi.published_at,
      qi.created_at,
      qi.updated_at,
      m.name AS media_name,
      m.media_type AS media_type,
      m.thumbnail_url AS media_thumbnail_url,
      m.url AS media_url,
      m.aspect_ratio AS media_aspect_ratio,
      m.duration_seconds AS media_duration_seconds
    FROM queue_items qi
    LEFT JOIN media_items m ON qi.media_id = m.id AND qi.user_id = m.user_id
    WHERE ${whereClause}
    ORDER BY qi.scheduled_time ASC, qi.created_at ASC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const rows = (await db.query(listSql, listParams)) as any[];

  const items = (rows || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    pageId: row.fb_page_id,
    slotId: row.slot_id ?? null,
    mediaId: row.media_id,
    scheduledTime: new Date(row.scheduled_time).toISOString(),
    caption: row.caption ?? '',
    firstComment: row.first_comment ?? null,
    status: row.status,
    retryCount: Number(row.retry_count ?? 0),
    maxRetries: Number(row.max_retries ?? 3),
    fbPostId: row.fb_post_id ?? null,
    fbCommentId: row.fb_comment_id ?? null,
    publishedAt: row.published_at
      ? new Date(row.published_at).toISOString()
      : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    media: row.media_name
      ? {
          name: row.media_name,
          mediaType: row.media_type,
          thumbnailUrl: row.media_thumbnail_url ?? null,
          url: row.media_url,
          aspectRatio: row.media_aspect_ratio ?? 'unknown',
          durationSeconds:
            row.media_duration_seconds != null
              ? Number(row.media_duration_seconds)
              : null,
        }
      : undefined,
  }));

  const responsePayload = ListQueueItemsResponseSchema.parse({
    items,
    total,
    limit,
    offset,
  });

  return NextResponse.json(responsePayload, { status: 200 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListQueueItems(request, subdomain);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleEnqueueMedia(request, subdomain);
}
