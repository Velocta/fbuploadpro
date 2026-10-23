import { type NextRequest, NextResponse } from 'next/server';
import { ListDestinationPostingSlotsResponseSchema } from '@fbuploadpro/contracts';
import { resolveSocialRouteContext } from '@/lib/connect/session';
import type { ConnectDbClient } from '@/lib/connect/persist';
import {
  fetchDestinationForEnqueue,
  fetchDestinationSlots,
} from '@/lib/publishing/destination-enqueue';

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; destinationId: string }> }
): Promise<NextResponse> {
  const { subdomain, destinationId } = await context.params;
  return handleListDestinationPostingSlots(request, subdomain, destinationId);
}
