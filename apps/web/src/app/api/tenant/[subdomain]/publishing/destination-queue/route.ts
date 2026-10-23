import { type NextRequest, NextResponse } from 'next/server';
import {
  DestinationEnqueueRequestSchema,
  DestinationEnqueueResponseSchema,
  resolveDestinationPlatformOptions,
  type DestinationEnqueueKind,
} from '@fbuploadpro/contracts';
import { resolveSocialRouteContext } from '@/lib/connect/session';
import type { ConnectDbClient } from '@/lib/connect/persist';
import {
  bodyTooLargeResponse,
  enforceIpRateLimit,
  readJsonBody,
} from '@/lib/request-body';
import { calculateNextVacantSlot } from '@/lib/slot-scheduler';
import {
  fetchDestinationForEnqueue,
  fetchDestinationQueuedTimes,
  fetchDestinationSlots,
  fetchOwnedMedia,
  insertDestinationQueueItem,
  type OwnedMediaRow,
} from '@/lib/publishing/destination-enqueue';

/**
 * POST /api/tenant/[subdomain]/publishing/destination-queue
 *
 * The unified destination enqueue (spec 119/132 enabling backend).
 * Inserts ONE row into the unified `queue_items` for a destination in
 * the workspace, in exactly the state the unified claim RPC picks up
 * (`status = 'queued'`; the intent decides `scheduled_time`/`slot_id`):
 *
 *   - now       → scheduled_time = now (claimable on the next pass)
 *   - scheduled → scheduled_time = the requested time (claim holds it
 *                 until then via its `scheduled_time <= now()` rule)
 *   - queue     → scheduled_time/slot_id resolved from the
 *                 destination's unified `posting_slots`, next vacant
 *                 occurrence for the item's format
 *
 * Tenant isolation: session + tenant access via the shared social
 * route context; the destination must belong to the resolved
 * workspace, its stored platform must equal the request's platform
 * (no platform spoofing), and every media id must belong to the
 * session user.
 */
export async function handleDestinationEnqueue(
  request: NextRequest,
  subdomain: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  const context = await resolveSocialRouteContext(request, subdomain, dbClient);
  if (context.errorResponse) {
    return context.errorResponse;
  }
  const { session, client, workspaceId } = context;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    if (bodyResult.reason === 'too-large') return bodyTooLargeResponse();
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = DestinationEnqueueRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Apply the platform's schema to the options as a whole: an omitted
  // options object must still satisfy it (YouTube has no omission
  // path) and schema defaults (TikTok privacy) must materialise
  // before the row is written.
  const optionsResult = resolveDestinationPlatformOptions(
    data.platform,
    data.platformOptions as Record<string, unknown> | undefined
  );
  if (!optionsResult.ok) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: optionsResult.error },
      { status: 400 }
    );
  }

  const destination = await fetchDestinationForEnqueue(
    client,
    workspaceId,
    data.destinationId
  );
  if (!destination) {
    return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
  }
  if (destination.platform !== data.platform) {
    return NextResponse.json(
      {
        error: 'PLATFORM_MISMATCH',
        message: 'The destination belongs to a different platform than the request.',
      },
      { status: 400 }
    );
  }

  // Media ownership + kind compatibility. The row stores the primary
  // (first) media denormalised — media_url/media_storage_key copied
  // from the library row — so a claim stays valid even if the library
  // item is later removed (media_item_id is ON DELETE SET NULL).
  let primaryMedia: OwnedMediaRow | null = null;
  if (data.mediaItemIds.length > 0) {
    const mediaRows = await fetchOwnedMedia(client, session.userId, data.mediaItemIds);
    if (mediaRows.length !== data.mediaItemIds.length) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }
    primaryMedia = mediaRows.find((m) => m.id === data.mediaItemIds[0]) ?? null;

    if (primaryMedia && (data.kind === 'image' || data.kind === 'video')) {
      const mediaKind = primaryMedia.media_type === 'video' ? 'video' : 'image';
      if (mediaKind !== data.kind) {
        return NextResponse.json(
          {
            error: 'INVALID_FORMAT',
            message: `The selected media is a ${mediaKind}, which does not match a ${data.kind} post.`,
          },
          { status: 400 }
        );
      }
    }
  }

  // Intent → row state.
  let scheduledTime: string;
  let slotId: string | null = null;

  if (data.intent === 'now') {
    scheduledTime = new Date().toISOString();
  } else if (data.intent === 'scheduled') {
    // Presence + futurity are schema-enforced; the cast-free read is
    // via the refined field.
    scheduledTime = new Date(data.scheduledAt as string).toISOString();
  } else {
    const allSlots = await fetchDestinationSlots(client, destination.id);

    let candidateSlots = allSlots;
    if (data.slotId) {
      const pinned = allSlots.find((s) => s.id === data.slotId);
      if (!pinned) {
        return NextResponse.json({ error: 'Queue slot not found' }, { status: 404 });
      }
      candidateSlots = [pinned];
    } else if (!allSlots.some((s) => s.is_active)) {
      return NextResponse.json(
        {
          error: 'NO_SLOTS_CONFIGURED',
          message:
            'No active posting times configured for this destination. Please configure a posting time or provide a schedule.',
        },
        { status: 400 }
      );
    }

    const existingQueued = await fetchDestinationQueuedTimes(client, destination.id);
    // Slot coverage is recorded in the slot's kind list; backfilled
    // Facebook slots carry the platform format vocabulary ('reel'),
    // so match on the platform format when the request carries one.
    const formatForSlot: string = data.platformFormat ?? data.kind;
    const computed = calculateNextVacantSlot({
      slots: candidateSlots.map((s) => ({
        id: s.id,
        slotTime: s.time_of_day,
        timezone: destination.timezone,
        isActive: Boolean(s.is_active),
        allowedFormats: s.kind ?? null,
      })),
      existingScheduledTimes: existingQueued,
      now: new Date(),
      postFormat: formatForSlot,
    });

    if (!computed) {
      return NextResponse.json(
        {
          error: 'NO_VACANT_SLOTS',
          message: 'No vacant posting time available for this destination',
        },
        { status: 400 }
      );
    }
    slotId = computed.slotId;
    scheduledTime = computed.scheduledTime.toISOString();
  }

  const created = await insertDestinationQueueItem(client, {
    workspaceId,
    destinationId: destination.id,
    platform: destination.platform,
    kind: data.kind as DestinationEnqueueKind,
    platformFormat: data.platformFormat ?? null,
    caption: data.caption,
    title: data.title ?? null,
    firstComment: data.firstComment ?? null,
    mediaItemId: primaryMedia?.id ?? null,
    mediaUrl: primaryMedia?.url ?? null,
    mediaStorageKey: primaryMedia?.storage_key ?? null,
    linkUrl: data.linkUrl ?? null,
    platformOptions: optionsResult.options,
    scheduledTime,
    slotId,
  });

  if (!created) {
    return NextResponse.json({ error: 'Failed to enqueue post' }, { status: 500 });
  }

  const response = DestinationEnqueueResponseSchema.parse({
    id: created.id,
    workspaceId: created.workspace_id,
    destinationId: created.destination_id,
    platform: created.platform,
    kind: created.kind,
    platformFormat: created.platform_format ?? null,
    status: created.status,
    scheduledTime: new Date(created.scheduled_time).toISOString(),
    slotId: created.slot_id ?? null,
    createdAt: new Date(created.created_at).toISOString(),
  });
  return NextResponse.json(response, { status: 201 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  const limited = await enforceIpRateLimit(request, 'tenant_destination_enqueue', 60);
  if (limited) return limited;
  return handleDestinationEnqueue(request, subdomain);
}
