import { type NextRequest, NextResponse } from 'next/server';
import {
  canAccessTenant,
  EnqueueMediaRequestSchema,
  getSessionSecret,
  ListQueueItemsQuerySchema,
  ListQueueItemsResponseSchema,
  QueueItemSchema,
  validatePostFormatEligibility,
  verifySessionToken,
  type DatabaseClient,
  type DatabaseMediaItemRow,
  type PostFormat,
} from '@fbuploadpro/contracts';
import { calculateNextVacantSlot } from '../../../../../../lib/slot-scheduler';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import { bodyTooLargeResponse, enforceIpRateLimit, readJsonBody } from '@/lib/request-body';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Row shapes consumed by the queue handlers (spec 137 §3.7).
 * QueueMediaRecord: the media columns the enqueue handlers read
 * (file_size is read by the eligibility check even though the selects
 * do not project it — modelled optional, as it is at runtime).
 * SlotCalcRow / QueuedTimeRow: the inputs of calculateNextVacantSlot.
 * QueueListRow: the legacy list query's joined projection;
 * QueueListSupabaseRow: the same item with the embedded media relation.
 */
export type QueueMediaRecord = Pick<
  DatabaseMediaItemRow,
  | 'id'
  | 'name'
  | 'media_type'
  | 'url'
  | 'thumbnail_url'
  | 'aspect_ratio'
  | 'duration_seconds'
> & { width: number | null; height: number | null; file_size?: number | null };

interface SlotCalcRow {
  id: string;
  slot_time: string;
  is_active: boolean;
  allowed_formats?: string[] | null;
}

interface QueuedTimeRow {
  scheduled_time: string | Date;
}

interface QueueListRow {
  id: string;
  user_id: string;
  fb_page_id: string;
  slot_id: string | null;
  media_id: string | null;
  post_format: string | null;
  media_type: string | null;
  link_url: string | null;
  scheduled_time: string | Date;
  caption: string | null;
  first_comment: string | null;
  status: string;
  retry_count: number | string | null;
  max_retries: number | string | null;
  fb_post_id: string | null;
  fb_comment_id: string | null;
  published_at: string | Date | null;
  created_at: string;
  updated_at: string;
  media_name: string | null;
  media_thumbnail_url: string | null;
  media_url: string | null;
  media_aspect_ratio: string | null;
  media_duration_seconds: number | string | null;
}

interface QueueListSupabaseRow extends Omit<QueueListRow, 'media_name' | 'media_thumbnail_url' | 'media_url' | 'media_aspect_ratio' | 'media_duration_seconds' | 'media_type'> {
  media: {
    name: string;
    media_type: string;
    thumbnail_url: string | null;
    url: string;
    aspect_ratio: string | null;
    duration_seconds: number | null;
  } | null;
}

/**
 * Reads the bulk enqueue handler (spec 139 A15) batches ONCE for a whole
 * request and shares with every per-item call: the workspace resolution,
 * the target page row, and every referenced media row (fetched with a
 * single `.in()` query). Per-item semantics are unchanged — a page or
 * media row missing from the prefetch is exactly the per-item query
 * returning no row. Only the Supabase path consumes the prefetch; the
 * legacy SQL path always reads live.
 */
export interface EnqueueMediaPrefetch {
  workspaceId: string;
  page: { id: string; timezone?: string | null } | null;
  mediaById: ReadonlyMap<string, QueueMediaRecord>;
}

export async function handleEnqueueMedia(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient,
  prefetch?: EnqueueMediaPrefetch
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
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    if (bodyResult.reason === 'too-large') return bodyTooLargeResponse();
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }
  const rawBody: unknown = bodyResult.value;

  const parsed = EnqueueMediaRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    pageId,
    mediaId,
    slotId: requestedSlotId,
    scheduledTime: requestedScheduledTime,
    caption,
    firstComment,
    postFormat: requestedFormat,
    linkUrl,
  } = parsed.data;

  const workspaceId =
    prefetch && !isLegacyClient(dbClient)
      ? prefetch.workspaceId
      : await resolveTenantWorkspaceId(dbClient, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (isLegacyClient(dbClient)) {
    // 4. Verify page exists and belongs to user and workspace
    const pageRows = (await dbClient.query(
      'SELECT id, timezone FROM facebook_pages WHERE id = $1 AND user_id = $2 AND workspace_id = $3',
      [pageId, session.userId, workspaceId]
    )) as Record<string, unknown>[];

    if (!pageRows || pageRows.length === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    const pageTimezone = String(pageRows[0].timezone || 'UTC');

    let finalPostFormat: PostFormat;
    let mediaRecord: QueueMediaRecord | null = null;

    if (requestedFormat === 'text' || (!mediaId && !requestedFormat)) {
      finalPostFormat = 'text';
      if (!caption || caption.trim().length === 0) {
        return NextResponse.json(
          { error: 'INVALID_REQUEST', message: 'Caption is required for text posts' },
          { status: 400 }
        );
      }
    } else if (mediaId) {
      const mediaRows = await dbClient.query<QueueMediaRecord>(
        `SELECT id, name, media_type, url, thumbnail_url, aspect_ratio, duration_seconds, width, height
         FROM media_items
         WHERE id = $1 AND user_id = $2`,
        [mediaId, session.userId]
      );

      if (!mediaRows || mediaRows.length === 0) {
        return NextResponse.json({ error: 'Media not found' }, { status: 404 });
      }

      mediaRecord = mediaRows[0];
      finalPostFormat = requestedFormat ?? (mediaRecord.media_type === 'video' ? 'video' : 'image');
      const validation = validatePostFormatEligibility({
        postFormat: finalPostFormat,
        caption,
        firstComment,
        linkUrl,
        media: {
          mediaType: mediaRecord.media_type,
          fileSize: mediaRecord.file_size,
          durationSeconds: mediaRecord.duration_seconds,
          aspectRatio: mediaRecord.aspect_ratio,
        },
      });
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'INVALID_FORMAT', message: validation.error || 'Media is not eligible for this format' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'mediaId is required for non-text posts' },
        { status: 400 }
      );
    }

    if (finalPostFormat === 'story' && firstComment && firstComment.trim().length > 0) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'First comment is not supported for story posts' },
        { status: 400 }
      );
    }

    // 7. Resolve slot and scheduledTime
    let finalSlotId: string | null = null;
    let finalScheduledTime: string;

    if (requestedSlotId) {
      const slotRows = (await dbClient.query(
        `SELECT id, slot_time, is_active, allowed_formats
         FROM page_queue_slots
         WHERE id = $1 AND fb_page_id = $2 AND user_id = $3`,
        [requestedSlotId, pageId, session.userId]
      )) as Record<string, unknown>[];

      if (!slotRows || slotRows.length === 0) {
        return NextResponse.json(
          { error: 'Queue slot not found' },
          { status: 404 }
        );
      }

      const slot = slotRows[0] as Record<string, unknown> & {
        id: string;
        slot_time: string;
        is_active: boolean;
        allowed_formats: string[] | null;
      };
      finalSlotId = slot.id;

      if (requestedScheduledTime) {
        finalScheduledTime = new Date(requestedScheduledTime).toISOString();
      } else {
        const existingQueued = await dbClient.query<QueuedTimeRow>(
          `SELECT scheduled_time FROM legacy_queue_items WHERE fb_page_id = $1 AND user_id = $2 AND status = 'queued'`,
          [pageId, session.userId]
        );

        const computed = calculateNextVacantSlot({
          slots: [
            {
              id: slot.id,
              slotTime:
                typeof slot.slot_time === 'string'
                  ? slot.slot_time
                  : String(slot.slot_time),
              timezone: pageTimezone,
              isActive: Boolean(slot.is_active),
              allowedFormats: slot.allowed_formats ?? null,
            },
          ],
          existingScheduledTimes: (existingQueued || []).map(
            (q: QueuedTimeRow) => new Date(q.scheduled_time)
          ),
          now: new Date(),
          postFormat: finalPostFormat,
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
      const activeSlots = await dbClient.query<SlotCalcRow>(
        `SELECT id, slot_time, is_active, allowed_formats
         FROM page_queue_slots
         WHERE fb_page_id = $1 AND user_id = $2 AND is_active = true
         ORDER BY slot_time ASC`,
        [pageId, session.userId]
      );

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

      const existingQueued = await dbClient.query<QueuedTimeRow>(
        `SELECT scheduled_time FROM legacy_queue_items WHERE fb_page_id = $1 AND user_id = $2 AND status = 'queued'`,
        [pageId, session.userId]
      );

      const computed = calculateNextVacantSlot({
        slots: activeSlots.map((s: SlotCalcRow) => ({
          id: s.id,
          slotTime:
            typeof s.slot_time === 'string' ? s.slot_time : String(s.slot_time),
          timezone: pageTimezone,
          isActive: Boolean(s.is_active),
          allowedFormats: s.allowed_formats ?? null,
        })),
        existingScheduledTimes: (existingQueued || []).map(
          (q: QueuedTimeRow) => new Date(q.scheduled_time)
        ),
        now: new Date(),
        postFormat: finalPostFormat,
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
      `INSERT INTO legacy_queue_items (
         user_id,
         fb_page_id,
         slot_id,
         media_id,
         post_format,
         link_url,
         scheduled_time,
         caption,
         first_comment,
         status,
         retry_count,
         max_retries
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued', 0, 3)
       RETURNING
         id,
         user_id,
         fb_page_id,
         slot_id,
         media_id,
         post_format,
         link_url,
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
        mediaId ?? null,
        finalPostFormat,
        linkUrl ?? null,
        finalScheduledTime,
        caption ?? '',
        firstComment ?? null,
      ]
    )) as Record<string, unknown>[];

    const createdRow = insertRows[0];

    const queueItem = {
      id: createdRow.id,
      userId: createdRow.user_id,
      pageId: createdRow.fb_page_id,
      slotId: createdRow.slot_id ?? null,
      mediaId: createdRow.media_id ?? null,
      postFormat: (createdRow.post_format as PostFormat) ?? finalPostFormat,
      linkUrl: createdRow.link_url ?? linkUrl ?? null,
      scheduledTime: new Date(createdRow.scheduled_time as string).toISOString(),
      caption: createdRow.caption ?? '',
      firstComment: createdRow.first_comment ?? null,
      status: createdRow.status,
      retryCount: Number(createdRow.retry_count ?? 0),
      maxRetries: Number(createdRow.max_retries ?? 3),
      fbPostId: createdRow.fb_post_id ?? null,
      fbCommentId: createdRow.fb_comment_id ?? null,
      publishedAt: createdRow.published_at
        ? new Date(createdRow.published_at as string).toISOString()
        : null,
      createdAt: new Date(createdRow.created_at as string).toISOString(),
      updatedAt: new Date(createdRow.updated_at as string).toISOString(),
      ...(mediaRecord
        ? {
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
          }
        : {}),
    };

    const validated = QueueItemSchema.parse(queueItem);
    return NextResponse.json(validated, { status: 201 });
  }

  const supabase = getRouteSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  // 4. Verify page exists and belongs to user and workspace
  const { data: pageRow } = prefetch
    ? { data: prefetch.page }
    : await supabase
        .from('facebook_pages')
        .select('id, timezone')
        .eq('id', pageId)
        .eq('user_id', session.userId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

  if (!pageRow) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }
  const pageTimezone = String(pageRow.timezone || 'UTC');

  let finalPostFormat: PostFormat;
  let mediaRecord: QueueMediaRecord | null = null;

  if (requestedFormat === 'text' || (!mediaId && !requestedFormat)) {
    finalPostFormat = 'text';
    if (!caption || caption.trim().length === 0) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Caption is required for text posts' },
        { status: 400 }
      );
    }
  } else if (mediaId) {
    const { data: mediaData } = prefetch
      ? { data: prefetch.mediaById.get(mediaId) ?? null }
      : await supabase
          .from('media_items')
          .select('id, name, media_type, url, thumbnail_url, aspect_ratio, duration_seconds, width, height')
          .eq('id', mediaId)
          .eq('user_id', session.userId)
          .maybeSingle();

    if (!mediaData) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    mediaRecord = mediaData;
    finalPostFormat = requestedFormat ?? (mediaRecord.media_type === 'video' ? 'video' : 'image');
    const validation = validatePostFormatEligibility({
      postFormat: finalPostFormat,
      caption,
      firstComment,
      linkUrl,
      media: {
        mediaType: mediaRecord.media_type,
        fileSize: mediaRecord.file_size,
        durationSeconds: mediaRecord.duration_seconds,
        aspectRatio: mediaRecord.aspect_ratio,
      },
    });
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'INVALID_FORMAT', message: validation.error || 'Media is not eligible for this format' },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'mediaId is required for non-text posts' },
      { status: 400 }
    );
  }

  if (finalPostFormat === 'story' && firstComment && firstComment.trim().length > 0) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'First comment is not supported for story posts' },
      { status: 400 }
    );
  }

  // 7. Resolve slot and scheduledTime
  let finalSlotId: string | null = null;
  let finalScheduledTime: string;

  if (requestedSlotId) {
    const { data: slot } = await supabase
      .from('page_queue_slots')
      .select('id, slot_time, is_active, allowed_formats')
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
        .from('legacy_queue_items')
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
            timezone: pageTimezone,
            isActive: Boolean(slot.is_active),
            allowedFormats: (slot.allowed_formats as string[] | null) ?? null,
          },
        ],
        existingScheduledTimes: (existingQueued || []).map(
          (q: QueuedTimeRow) => new Date(q.scheduled_time)
        ),
        now: new Date(),
        postFormat: finalPostFormat,
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
      .select('id, slot_time, is_active, allowed_formats')
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
      .from('legacy_queue_items')
      .select('scheduled_time')
      .eq('fb_page_id', pageId)
      .eq('user_id', session.userId)
      .eq('status', 'queued');

    const computed = calculateNextVacantSlot({
      slots: activeSlots.map((s: SlotCalcRow) => ({
        id: s.id,
        slotTime:
          typeof s.slot_time === 'string' ? s.slot_time : String(s.slot_time),
        timezone: pageTimezone,
        isActive: Boolean(s.is_active),
        allowedFormats: s.allowed_formats ?? null,
      })),
      existingScheduledTimes: (existingQueued || []).map(
        (q: QueuedTimeRow) => new Date(q.scheduled_time)
      ),
      now: new Date(),
      postFormat: finalPostFormat,
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

  // 8. Insert into legacy_queue_items
  const { data: createdRow, error: insertErr } = await supabase
    .from('legacy_queue_items')
    .insert({
      user_id: session.userId,
      fb_page_id: pageId,
      slot_id: finalSlotId,
      media_id: mediaId ?? null,
      post_format: finalPostFormat,
      link_url: linkUrl ?? null,
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
    mediaId: createdRow.media_id ?? null,
    postFormat: (createdRow.post_format as PostFormat) ?? finalPostFormat,
    linkUrl: createdRow.link_url ?? linkUrl ?? null,
    scheduledTime: new Date(createdRow.scheduled_time as string).toISOString(),
    caption: createdRow.caption ?? '',
    firstComment: createdRow.first_comment ?? null,
    status: createdRow.status,
    retryCount: Number(createdRow.retry_count ?? 0),
    maxRetries: Number(createdRow.max_retries ?? 3),
    fbPostId: createdRow.fb_post_id ?? null,
    fbCommentId: createdRow.fb_comment_id ?? null,
    publishedAt: createdRow.published_at
      ? new Date(createdRow.published_at as string).toISOString()
      : null,
    createdAt: new Date(createdRow.created_at as string).toISOString(),
    updatedAt: new Date(createdRow.updated_at as string).toISOString(),
    ...(mediaRecord
      ? {
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
        }
      : {}),
  };

  const validated = QueueItemSchema.parse(queueItem);
  return NextResponse.json(validated, { status: 201 });
}

export async function handleListQueueItems(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient
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

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (isLegacyClient(dbClient)) {

    // 4. Build query filters scoped to workspace pages
    const conditions = [
      'qi.user_id = $1',
      'EXISTS (SELECT 1 FROM facebook_pages fp WHERE fp.id = qi.fb_page_id AND fp.workspace_id = $2 AND fp.user_id = $1)'
    ];
    const params: unknown[] = [session.userId, workspaceId];

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
    const countSql = `SELECT COUNT(*) AS total FROM legacy_queue_items qi WHERE ${whereClause}`;
    const countRows = (await dbClient.query(countSql, params)) as Record<string, unknown>[];
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
        qi.post_format,
        qi.link_url,
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
      FROM legacy_queue_items qi
      LEFT JOIN media_items m ON qi.media_id = m.id AND qi.user_id = m.user_id
      WHERE ${whereClause}
      ORDER BY qi.scheduled_time ASC, qi.created_at ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const rows = await dbClient.query<QueueListRow>(listSql, listParams);

    const items = (rows || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      pageId: row.fb_page_id,
      slotId: row.slot_id ?? null,
      mediaId: row.media_id ?? null,
      postFormat: (row.post_format as PostFormat) ?? (row.media_type === 'video' ? 'video' : 'image'),
      linkUrl: row.link_url ?? null,
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
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
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

    let queuedCount = 0;
    let publishedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let cancelledCount = 0;

    const statusCountSql = `
      SELECT qi.status, COUNT(*) as cnt
      FROM legacy_queue_items qi
      WHERE qi.user_id = $1
        AND EXISTS (SELECT 1 FROM facebook_pages fp WHERE fp.id = qi.fb_page_id AND fp.workspace_id = $2 AND fp.user_id = $1)
        ${pageId ? 'AND qi.fb_page_id = $3' : ''}
      GROUP BY qi.status
    `;
    const countParams = pageId ? [session.userId, workspaceId, pageId] : [session.userId, workspaceId];
    try {
      const statusRows = (await dbClient.query(statusCountSql, countParams)) as Record<string, unknown>[];
      for (const row of statusRows || []) {
        const cnt = Number(row.cnt ?? 0);
        if (row.status === 'queued') queuedCount = cnt;
        else if (row.status === 'published') publishedCount = cnt;
        else if (row.status === 'failed') failedCount = cnt;
        else if (row.status === 'skipped') skippedCount = cnt;
        else if (row.status === 'cancelled') cancelledCount = cnt;
      }
    } catch (_e) {
      // Non-fatal counter fallback
    }

    const responsePayload = ListQueueItemsResponseSchema.parse({
      items,
      total,
      limit,
      offset,
      queuedCount,
      publishedCount,
      failedCount,
      skippedCount,
      cancelledCount,
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
    .from('legacy_queue_items')
    .select(
      'id, user_id, fb_page_id, slot_id, media_id, post_format, link_url, scheduled_time, caption, first_comment, status, retry_count, max_retries, fb_post_id, fb_comment_id, published_at, created_at, updated_at, media:media_items(name, media_type, thumbnail_url, url, aspect_ratio, duration_seconds)',
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

  // supabase-js models the embedded media relation as an array; the
  // runtime value is the single joined object (or null), which is what
  // QueueListSupabaseRow describes — hence the bridge through unknown
  // for this one inference gap (spec 137 §3.7).
  const typedRows = (rows || []) as unknown as QueueListSupabaseRow[];
  const items = typedRows.map((row) => {
    const m = row.media;
    return {
      id: row.id,
      userId: row.user_id,
      pageId: row.fb_page_id,
      slotId: row.slot_id ?? null,
      mediaId: row.media_id ?? null,
      postFormat: (row.post_format as PostFormat) ?? (m?.media_type === 'video' ? 'video' : 'image'),
      linkUrl: row.link_url ?? null,
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
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
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

  let queuedCount = 0;
  let publishedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let cancelledCount = 0;

  // Counts are RPC-first (spec 139 A14). When the grouped RPC is
  // unavailable, errors, or returns no row, the fallback is BOUNDED:
  // one head/count query per status (a constant number of queries that
  // transfers zero rows) instead of selecting every queue row for the
  // page/workspace and counting in JS, which grew with queue history
  // and silently truncated at the PostgREST row cap. Count-query
  // errors are swallowed exactly as before — the counts stay at zero.
  let rpcCountsApplied = false;
  if (pageId && typeof (supabase as SupabaseClient).rpc === 'function') {
    try {
      const { data: countData } = await (supabase as SupabaseClient).rpc('get_page_queue_status_counts', {
        p_page_id: pageId,
        p_user_id: session.userId,
      });
      if (Array.isArray(countData) && countData.length > 0) {
        const counts = countData[0];
        queuedCount = Number(counts.queued_count ?? 0);
        publishedCount = Number(counts.published_count ?? 0);
        failedCount = Number(counts.failed_count ?? 0);
        skippedCount = Number(counts.skipped_count ?? 0);
        cancelledCount = Number(counts.cancelled_count ?? 0);
        rpcCountsApplied = true;
      }
    } catch (_e) {
      // Fall through to the bounded fallback below.
    }
  }

  if (!rpcCountsApplied) {
    try {
      const QUEUE_LIST_COUNT_STATUSES = ['queued', 'published', 'failed', 'skipped', 'cancelled'] as const;
      const perStatus = await Promise.all(
        QUEUE_LIST_COUNT_STATUSES.map(async (status) => {
          let countQuery = supabase
            .from('legacy_queue_items')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', session.userId);
          countQuery = pageId
            ? countQuery.eq('fb_page_id', pageId)
            : countQuery.in('fb_page_id', workspacePageIds);
          const { count, error } = await countQuery.eq('status', status);
          if (error) throw error;
          return [status, count ?? 0] as const;
        })
      );
      for (const [status, count] of perStatus) {
        if (status === 'queued') queuedCount = count;
        else if (status === 'published') publishedCount = count;
        else if (status === 'failed') failedCount = count;
        else if (status === 'skipped') skippedCount = count;
        else if (status === 'cancelled') cancelledCount = count;
      }
    } catch (_e) {
      // Fallback: counts stay at zero, as before.
    }
  }

  const responsePayload = ListQueueItemsResponseSchema.parse({
    items,
    total: totalCount ?? 0,
    limit,
    offset,
    queuedCount,
    publishedCount,
    failedCount,
    skippedCount,
    cancelledCount,
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
  const limited = await enforceIpRateLimit(request, 'tenant_queue_enqueue', 60);
  if (limited) return limited;
  return handleEnqueueMedia(request, subdomain);
}
