import { type NextRequest, NextResponse } from 'next/server';
import {
  EnqueueMediaRequestSchema,
  getSessionSecret,
  ListQueueItemsQuerySchema,
  ListQueueItemsResponseSchema,
  QueueItemSchema,
  verifySessionToken,
  type DatabaseClient,
} from '@fbuploadpro/contracts';
import { calculateNextVacantSlot } from '../../../../../../lib/slot-scheduler';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleEnqueueMedia(
  request: NextRequest,
  subdomain: string,
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

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (isLegacyClient(dbClient)) {
    // 4. Verify page exists and belongs to user and workspace
    const pageRows = (await dbClient.query(
      'SELECT id FROM facebook_pages WHERE id = $1 AND user_id = $2 AND workspace_id = $3',
      [pageId, session.userId, workspaceId]
    )) as any[];

    if (!pageRows || pageRows.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // 6. Verify media item exists and belongs to user
    const mediaRows = (await dbClient.query(
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
      const slotRows = (await dbClient.query(
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
        const existingQueued = (await dbClient.query(
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
      finalScheduledTime = new Date(requestedScheduledTime).toISOString();
    } else {
      const activeSlots = (await dbClient.query(
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

      const existingQueued = (await dbClient.query(
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

    const insertRows = (await dbClient.query(
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

  const supabase = getRouteSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  // 4. Verify page exists and belongs to user and workspace
  const { data: pageRow } = await supabase
    .from('facebook_pages')
    .select('id')
    .eq('id', pageId)
    .eq('user_id', session.userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!pageRow) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  // 6. Verify media item exists and belongs to user
  const { data: mediaRecord } = await supabase
    .from('media_items')
    .select('id, name, media_type, url, thumbnail_url, aspect_ratio, duration_seconds')
    .eq('id', mediaId)
    .eq('user_id', session.userId)
    .maybeSingle();

  if (!mediaRecord) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  // 7. Resolve slot and scheduledTime
  let finalSlotId: string | null = null;
  let finalScheduledTime: string;

  if (requestedSlotId) {
    const { data: slot } = await supabase
      .from('page_queue_slots')
      .select('id, slot_time, timezone, is_active')
      .eq('id', requestedSlotId)
      .eq('fb_page_id', pageId)
      .eq('user_id', session.userId)
      .maybeSingle();

    if (!slot) {
      return NextResponse.json(
        { error: 'Queue slot not found' },
        { status: 404 }
      );
    }

    finalSlotId = slot.id;

    if (requestedScheduledTime) {
      finalScheduledTime = new Date(requestedScheduledTime).toISOString();
    } else {
      const { data: existingQueued } = await supabase
        .from('queue_items')
        .select('scheduled_time')
        .eq('fb_page_id', pageId)
        .eq('user_id', session.userId)
        .eq('status', 'queued');

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
    finalScheduledTime = new Date(requestedScheduledTime).toISOString();
  } else {
    const { data: activeSlots } = await supabase
      .from('page_queue_slots')
      .select('id, slot_time, timezone, is_active')
      .eq('fb_page_id', pageId)
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .order('slot_time', { ascending: true });

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

    const { data: existingQueued } = await supabase
      .from('queue_items')
      .select('scheduled_time')
      .eq('fb_page_id', pageId)
      .eq('user_id', session.userId)
      .eq('status', 'queued');

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
  const { data: createdRow, error: insertErr } = await supabase
    .from('queue_items')
    .insert({
      user_id: session.userId,
      fb_page_id: pageId,
      slot_id: finalSlotId,
      media_id: mediaId,
      scheduled_time: finalScheduledTime,
      caption: caption ?? '',
      first_comment: firstComment ?? null,
      status: 'queued',
      retry_count: 0,
      max_retries: 3,
    })
    .select()
    .single();

  if (insertErr || !createdRow) {
    return NextResponse.json({ error: 'Failed to enqueue media' }, { status: 500 });
  }

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

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (isLegacyClient(dbClient)) {

    // 4. Build query filters scoped to workspace pages
    const conditions = [
      'qi.user_id = $1',
      'EXISTS (SELECT 1 FROM facebook_pages fp WHERE fp.id = qi.fb_page_id AND fp.workspace_id = $2 AND fp.user_id = $1)'
    ];
    const params: any[] = [session.userId, workspaceId];

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
    const countRows = (await dbClient.query(countSql, params)) as any[];
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

    const rows = (await dbClient.query(listSql, listParams)) as any[];

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

  const supabase = getRouteSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const { data: workspacePages } = await supabase
    .from('facebook_pages')
    .select('id')
    .eq('user_id', session.userId)
    .eq('workspace_id', workspaceId)
    .neq('status', 'disconnected');

  const workspacePageIds = (workspacePages || []).map((p) => p.id);
  if (workspacePageIds.length === 0) {
    return NextResponse.json({ items: [], total: 0, limit, offset }, { status: 200 });
  }

  let queryBuilder = supabase
    .from('queue_items')
    .select(
      'id, user_id, fb_page_id, slot_id, media_id, scheduled_time, caption, first_comment, status, retry_count, max_retries, fb_post_id, fb_comment_id, published_at, created_at, updated_at, media:media_items(name, media_type, thumbnail_url, url, aspect_ratio, duration_seconds)',
      { count: 'exact' }
    )
    .eq('user_id', session.userId)
    .in('fb_page_id', workspacePageIds);

  if (pageId) {
    queryBuilder = queryBuilder.eq('fb_page_id', pageId);
  }
  if (status) {
    queryBuilder = queryBuilder.eq('status', status);
  }

  queryBuilder = queryBuilder
    .order('scheduled_time', { ascending: true })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  const { data: rows, count: totalCount, error } = await queryBuilder;

  if (error) {
    return NextResponse.json({ error: 'Failed to list queue items' }, { status: 500 });
  }

  const items = (rows || []).map((row: any) => {
    const m = row.media;
    return {
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
      media: m
        ? {
            name: m.name,
            mediaType: m.media_type,
            thumbnailUrl: m.thumbnail_url ?? null,
            url: m.url,
            aspectRatio: m.aspect_ratio ?? 'unknown',
            durationSeconds:
              m.duration_seconds != null
                ? Number(m.duration_seconds)
                : null,
          }
        : undefined,
    };
  });

  const responsePayload = ListQueueItemsResponseSchema.parse({
    items,
    total: totalCount ?? 0,
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
