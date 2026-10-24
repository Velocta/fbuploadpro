import { type NextRequest, NextResponse } from 'next/server';
import { DestinationPostingSlotSchema } from '@fbuploadpro/contracts';
import { resolveSocialRouteContext } from '@/lib/connect/session';
import type { ConnectDbClient } from '@/lib/connect/persist';
import { bodyTooLargeResponse, readJsonBody } from '@/lib/request-body';
import { UpdateDestinationSlotRequestSchema } from '@/lib/api/schemas/unified-queue';
import { fetchDestinationSlots } from '@/lib/publishing/destination-enqueue';
import {
  deleteDestinationSlot,
  fetchDestinationQueueContext,
  updateDestinationSlot,
} from '@/lib/publishing/destination-queue';

/**
 * PATCH / DELETE
 * /api/tenant/[subdomain]/destinations/[destinationId]/posting-slots/[slotId]
 *
 * The per-slot writes (spec 134 PR-134-3, T24), mirroring the legacy
 * pages `slots/[slotId]` handlers: PATCH writes the slot's full state
 * (the panel computes it from the current row, like the legacy
 * handlers' full-row update), DELETE removes the slot — queued items
 * that referenced it keep their scheduled time (`slot_id` is
 * ON DELETE SET NULL), so removing a posting time never strands a
 * queued post. Moving a slot onto an existing time is a 409.
 */
export async function handleUpdateDestinationPostingSlot(
  request: NextRequest,
  subdomain: string,
  destinationId: string,
  slotId: string,
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

  const existing = (await fetchDestinationSlots(client, destination.id)).find(
    (slot) => slot.id === slotId
  );
  if (!existing) {
    return NextResponse.json({ error: 'Posting time not found' }, { status: 404 });
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    if (bodyResult.reason === 'too-large') return bodyTooLargeResponse();
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = UpdateDestinationSlotRequestSchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const result = await updateDestinationSlot(client, destination.id, slotId, {
    kind: parsed.data.kind ?? existing.kind ?? [],
    timeOfDay: normalizeTimeOfDay(parsed.data.timeOfDay ?? existing.time_of_day),
    isActive: parsed.data.isActive ?? Boolean(existing.is_active),
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
    if (result.reason === 'not-found') {
      return NextResponse.json({ error: 'Posting time not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update posting time' }, { status: 500 });
  }

  const response = DestinationPostingSlotSchema.parse({
    id: result.slot.id,
    destinationId: destination.id,
    kind: result.slot.kind ?? [],
    timeOfDay: result.slot.time_of_day,
    isActive: Boolean(result.slot.is_active),
  });
  return NextResponse.json(response, { status: 200 });
}

export async function handleDeleteDestinationPostingSlot(
  request: NextRequest,
  subdomain: string,
  destinationId: string,
  slotId: string,
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

  const deleted = await deleteDestinationSlot(client, destination.id, slotId);
  if (!deleted) {
    return NextResponse.json({ error: 'Posting time not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, slotId }, { status: 200 });
}

/** 'HH:MM' → 'HH:MM:SS' (the stored TIME shape); already-full values pass through. */
function normalizeTimeOfDay(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; destinationId: string; slotId: string }> }
): Promise<NextResponse> {
  const { subdomain, destinationId, slotId } = await context.params;
  return handleUpdateDestinationPostingSlot(request, subdomain, destinationId, slotId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; destinationId: string; slotId: string }> }
): Promise<NextResponse> {
  const { subdomain, destinationId, slotId } = await context.params;
  return handleDeleteDestinationPostingSlot(request, subdomain, destinationId, slotId);
}
