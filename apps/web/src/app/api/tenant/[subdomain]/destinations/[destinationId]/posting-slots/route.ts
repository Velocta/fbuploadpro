import { type NextRequest, NextResponse } from 'next/server';
import {
  DestinationPostingSlotSchema,
  ListDestinationPostingSlotsResponseSchema,
} from '@fbuploadpro/contracts';
import { resolveSocialRouteContext } from '@/lib/connect/session';
import type { ConnectDbClient } from '@/lib/connect/persist';
import { bodyTooLargeResponse, readJsonBody } from '@/lib/request-body';
import {
  CreateDestinationSlotRequestSchema,
  UpdateDestinationTimezoneRequestSchema,
} from '@/lib/api/schemas/unified-queue';
import {
  fetchDestinationForEnqueue,
  fetchDestinationSlots,
} from '@/lib/publishing/destination-enqueue';
import {
  fetchDestinationQueueContext,
  insertDestinationSlot,
  updateDestinationTimezone,
} from '@/lib/publishing/destination-queue';

/**
 * GET /api/tenant/[subdomain]/destinations/[destinationId]/posting-slots
 *
 * The destination posting-times read (spec 119/132 enabling backend):
 * the destination's unified `posting_slots` plus its timezone, which
 * is what the platform composers' Schedule/Queue intents and the
 * spec 134 per-destination surfaces render posting times from.
 *
 * Workspace-scoped and read-only: a destination outside the caller's
 * workspace reads as not found, exactly like the destination detail
 * route — existence never leaks across tenants.
 */
export async function handleListDestinationPostingSlots(
  request: NextRequest,
  subdomain: string,
  destinationId: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  const context = await resolveSocialRouteContext(request, subdomain, dbClient);
  if (context.errorResponse) {
    return context.errorResponse;
  }
  const { client, workspaceId } = context;

  const destination = await fetchDestinationForEnqueue(
    client,
    workspaceId,
    destinationId
  );
  if (!destination) {
    return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
  }

  const slots = await fetchDestinationSlots(client, destination.id);

  const response = ListDestinationPostingSlotsResponseSchema.parse({
    destinationId: destination.id,
    timezone: destination.timezone,
    slots: slots.map((slot) => ({
      id: slot.id,
      destinationId: destination.id,
      kind: slot.kind ?? [],
      timeOfDay: slot.time_of_day,
      isActive: Boolean(slot.is_active),
    })),
  });
  return NextResponse.json(response, { status: 200 });
}

/** Every queue kind — a new slot's default format coverage. */
const ALL_SLOT_KINDS = ['text', 'image', 'video', 'story', 'carousel'];

/**
 * POST /api/tenant/[subdomain]/destinations/[destinationId]/posting-slots
 *
 * Creates one unified posting slot (spec 134 PR-134-3, T24 — the write
 * side of the read above, mirroring the legacy pages slots create).
 * `posting_slots` carries a UNIQUE(destination_id, time_of_day)
 * constraint (#753): a second slot at the same time is a 409 with the
 * plain-language reason, never a 500.
 */
export async function handleCreateDestinationPostingSlot(
  request: NextRequest,
  subdomain: string,
  destinationId: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  const context = await resolveSocialRouteContext(request, subdomain, dbClient);
  if (context.errorResponse) {
    return context.errorResponse;
  }
  const { client, workspaceId } = context;

  const destination = await fetchDestinationQueueContext(
    client,
    workspaceId,
    destinationId
  );
  if (!destination) {
    return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    if (bodyResult.reason === 'too-large') return bodyTooLargeResponse();
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = CreateDestinationSlotRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const result = await insertDestinationSlot(client, destination.id, {
    kind: parsed.data.kind ?? ALL_SLOT_KINDS,
    timeOfDay: normalizeTimeOfDay(parsed.data.timeOfDay),
    isActive: parsed.data.isActive ?? true,
  });
  if (!result.ok) {
    if (result.reason === 'duplicate') {
      return NextResponse.json(
        {
          error: 'SLOT_TIME_TAKEN',
          message: 'A posting time already exists at that time.',
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create posting time' }, { status: 500 });
  }

  const response = DestinationPostingSlotSchema.parse({
    id: result.slot.id,
    destinationId: destination.id,
    kind: result.slot.kind ?? [],
    timeOfDay: result.slot.time_of_day,
    isActive: Boolean(result.slot.is_active),
  });
  return NextResponse.json(response, { status: 201 });
}

/**
 * PATCH /api/tenant/[subdomain]/destinations/[destinationId]/posting-slots
 *
 * The destination timezone write — the collection PATCH, exactly as
 * the legacy pages slots route shapes it (its PATCH is the
 * schedule-timezone update). Slot times are local times: changing the
 * timezone re-bases the destination's posting slots to the new zone
 * (the per-destination timezone feature) without moving the times.
 */
export async function handleUpdateDestinationTimezone(
  request: NextRequest,
  subdomain: string,
  destinationId: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  const context = await resolveSocialRouteContext(request, subdomain, dbClient);
  if (context.errorResponse) {
    return context.errorResponse;
  }
  const { client, workspaceId } = context;

  const destination = await fetchDestinationQueueContext(
    client,
    workspaceId,
    destinationId
  );
  if (!destination) {
    return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    if (bodyResult.reason === 'too-large') return bodyTooLargeResponse();
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = UpdateDestinationTimezoneRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const updated = await updateDestinationTimezone(
    client,
    workspaceId,
    destination.id,
    parsed.data.timezone
  );
  if (!updated) {
    return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
  }

  return NextResponse.json(
    { success: true, timezone: parsed.data.timezone },
    { status: 200 }
  );
}

/** 'HH:MM' → 'HH:MM:SS' (the stored TIME shape); already-full values pass through. */
function normalizeTimeOfDay(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; destinationId: string }> }
): Promise<NextResponse> {
  const { subdomain, destinationId } = await context.params;
  return handleListDestinationPostingSlots(request, subdomain, destinationId);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; destinationId: string }> }
): Promise<NextResponse> {
  const { subdomain, destinationId } = await context.params;
  return handleCreateDestinationPostingSlot(request, subdomain, destinationId);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; destinationId: string }> }
): Promise<NextResponse> {
  const { subdomain, destinationId } = await context.params;
  return handleUpdateDestinationTimezone(request, subdomain, destinationId);
}
