import { type NextRequest, NextResponse } from 'next/server';
import { getSessionSecret, type DatabaseClient } from '@fbuploadpro/contracts';
import { handleConnectComplete } from '@/app/api/connect/[platform]/complete/route';
import {
  verifyPendingDestinations,
  PENDING_COOKIE_NAME,
  type PendingDestinationsPayload,
} from '@/lib/connect/state';
import {
  resolveConnectDbClient,
} from '@/lib/connect/session';
import type { ConnectDbClient } from '@/lib/connect/persist';
import type { YouTubeDiscoveredDestination } from '@/lib/connect/youtube';
import { getRouteSupabase, isLegacyClient } from '@/lib/route-auth';

/**
 * POST /api/connect/youtube/complete — finishes a YouTube connect
 * (Spec 125). A static segment, so it wins over the framework's
 * `[platform]` complete route for YouTube only.
 *
 * The heavy lifting is the framework's: session check, pending
 * cookie verification, and persisting the destinations the user
 * confirmed in the read-back step. This wrapper adds the one
 * YouTube-specific write the framework has no field for: the
 * provider account ref (`providerAccountId`, carried through the
 * pending cookie on the discovered destination) is merged into
 * `social_accounts.metadata` and into each picked destination's
 * `metadata` — the worker's YouTube publisher reads it from the
 * destination when it submits posts to the provider.
 */

interface PendingPick {
  pending: PendingDestinationsPayload;
  pickedExternalIds: string[];
  providerAccountId: string | null;
}

async function readPendingPick(
  request: NextRequest
): Promise<PendingPick | null> {
  const pendingCookie = request.cookies.get(PENDING_COOKIE_NAME)?.value;
  if (!pendingCookie) return null;
  let pending: PendingDestinationsPayload;
  try {
    pending = await verifyPendingDestinations(
      pendingCookie,
      getSessionSecret()
    );
  } catch {
    return null;
  }
  if (pending.platform !== 'youtube') return null;

  let requestedIds = new Set<string>();
  try {
    const body = (await request.clone().json()) as {
      destinationIds?: unknown;
    };
    if (Array.isArray(body.destinationIds)) {
      requestedIds = new Set(
        body.destinationIds.filter(
          (id): id is string => typeof id === 'string'
        )
      );
    }
  } catch {
    return { pending, pickedExternalIds: [], providerAccountId: null };
  }

  const picked = pending.destinations.filter((destination) =>
    requestedIds.has(destination.externalDestinationId)
  );
  const firstPicked = picked[0] as
    | YouTubeDiscoveredDestination
    | undefined;
  const providerAccountId = firstPicked
    ? firstPicked.providerAccountId
    : null;
  return {
    pending,
    pickedExternalIds: picked.map((d) => d.externalDestinationId),
    providerAccountId,
  };
}

async function mergeMetadataJson(
  client: ConnectDbClient,
  table: 'social_accounts' | 'destinations',
  match: Record<string, string>,
  providerAccountId: string
): Promise<void> {
  const patch = { providerAccountId };

  if (isLegacyClient(client)) {
    const legacy = client as DatabaseClient;
    const conditions = Object.keys(match)
      .map((column, index) => `${column} = $${index + 2}`)
      .join(' AND ');
    await legacy.query(
      `UPDATE ${table} SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE ${conditions}`,
      [JSON.stringify(patch), ...Object.values(match)]
    );
    return;
  }

  const supabase = getRouteSupabase(client);
  if (!supabase) return;
  let query = supabase.from(table).select('id, metadata');
  for (const [column, value] of Object.entries(match)) {
    query = query.eq(column, value);
  }
  const { data, error } = await query;
  if (error || !data) return;
  for (const row of data as Array<{
    id: string;
    metadata: Record<string, unknown> | null;
  }>) {
    await supabase
      .from(table)
      .update({ metadata: { ...(row.metadata ?? {}), ...patch } })
      .eq('id', row.id);
  }
}

async function persistProviderAccountRef(
  client: ConnectDbClient,
  pick: PendingPick
): Promise<void> {
  if (!pick.providerAccountId || pick.pickedExternalIds.length === 0) {
    return;
  }
  await mergeMetadataJson(
    client,
    'social_accounts',
    { id: pick.pending.accountId },
    pick.providerAccountId
  );
  for (const externalId of pick.pickedExternalIds) {
    await mergeMetadataJson(
      client,
      'destinations',
      {
        account_id: pick.pending.accountId,
        external_destination_id: externalId,
      },
      pick.providerAccountId
    );
  }
}

export async function handleYouTubeComplete(
  request: NextRequest,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  // Read the pending pick BEFORE delegating: the framework consumes
  // the request body and clears the pending cookie in its response.
  const pick = await readPendingPick(request);

  const response = await handleConnectComplete(request, 'youtube', dbClient);

  if (response.status === 200 && pick?.providerAccountId) {
    const client = resolveConnectDbClient(dbClient);
    if (client) {
      try {
        await persistProviderAccountRef(client, pick);
      } catch (err) {
        // The destinations are saved; a missing provider ref fails
        // publishing closed with a reconnect message until a
        // reconnect rewrites it. Never fail the connect over it.
        console.error(
          '[connect/youtube] Failed to persist provider account ref:',
          err
        );
      }
    }
  }
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleYouTubeComplete(request);
}
