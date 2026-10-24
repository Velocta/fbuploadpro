import { type NextRequest, NextResponse } from 'next/server';
import {
  resolvePublishLimit,
  type PublishLimitOverride,
} from '@fbuploadpro/contracts';
import { resolveSocialRouteContext } from '@/lib/connect/session';
import type { ConnectDbClient } from '@/lib/connect/persist';
import {
  ListDestinationQueueResponseSchema,
  type DestinationLimitState,
} from '@/lib/api/schemas/unified-queue';
import {
  fetchDestinationQueueContext,
  fetchDestinationQueueItems,
  fetchDestinationQueueMedia,
  toUnifiedQueueItemView,
  type DestinationQueueContext,
} from '@/lib/publishing/destination-queue';

/**
 * GET /api/tenant/[subdomain]/destinations/[destinationId]/queue
 *
 * The unified per-destination queue list (spec 134 PR-134-3, T24): every
 * `queue_items` row for one destination in the caller's workspace, in
 * claim order (scheduled time, then creation — the order the unified
 * claim RPC drains). The panel filters/sorts client-side over this one
 * read, exactly like the Page-section panel does over its list.
 *
 * T23 data-path finding (recorded in the PR): a web-composed post now
 * lands in unified `queue_items` (composer create → destination
 * enqueue, PRs 750/756/759) and the worker publishes only from unified
 * `queue_items`. During the cutover the legacy Facebook Page section
 * still reads `legacy_queue_items`, so posts composed on the web no
 * longer appear there — they appear here. Pre-cutover legacy items
 * stay in the Page section until Phase 7 drops the legacy tables.
 *
 * The response also carries the destination's D5 limit state, derived
 * here from the contracts limits config (the single source for the
 * numbers) + the destination's live metering columns, so no numeric
 * limit is ever spelled in UI code.
 */
export async function handleListDestinationQueue(
  request: NextRequest,
  subdomain: string,
  destinationId: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  const context = await resolveSocialRouteContext(request, subdomain, dbClient);
  if (context.errorResponse) {
    return context.errorResponse;
  }
  const { session, client, workspaceId } = context;

  const destination = await fetchDestinationQueueContext(
    client,
    workspaceId,
    destinationId
  );
  if (!destination) {
    return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
  }

  const rows = await fetchDestinationQueueItems(client, workspaceId, destination.id);

  const mediaIds = [
    ...new Set(
      rows
        .map((row) => row.media_item_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const mediaRows = await fetchDestinationQueueMedia(client, session.userId, mediaIds);
  const mediaById = new Map(mediaRows.map((media) => [media.id, media]));

  const response = ListDestinationQueueResponseSchema.parse({
    destinationId: destination.id,
    platform: destination.platform,
    timezone: destination.timezone,
    destinationStatus: destination.status,
    limit: destinationLimitState(destination),
    items: rows.map((row) => toUnifiedQueueItemView(row, mediaById)),
  });
  return NextResponse.json(response, { status: 200 });
}

/**
 * The binding D5 window for the destination: the published-posts cap
 * when the platform configures one, else the publish-calls cap. The
 * per-destination override rides `destinations.metadata.claim_limits`
 * (the same source the claim path honours).
 */
function destinationLimitState(
  destination: DestinationQueueContext
): DestinationLimitState | null {
  const override = destination.metadata?.claim_limits;
  const config = resolvePublishLimit(
    destination.platform,
    isLimitOverride(override) ? override : null
  );
  const window = config?.publishedPosts ?? config?.publishCalls;
  if (!window) return null;
  return {
    windowLimit: window.maxCount,
    windowSeconds: window.windowSeconds,
    rateUsagePct: destination.rateUsagePct,
    nextAllowedPublishAt: destination.nextAllowedPublishAt
      ? new Date(destination.nextAllowedPublishAt).toISOString()
      : null,
  };
}

function isLimitOverride(value: unknown): value is PublishLimitOverride {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return 'publishedPosts' in record || 'publishCalls' in record;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; destinationId: string }> }
): Promise<NextResponse> {
  const { subdomain, destinationId } = await context.params;
  return handleListDestinationQueue(request, subdomain, destinationId);
}
