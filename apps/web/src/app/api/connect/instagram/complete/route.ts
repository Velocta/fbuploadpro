import { type NextRequest, NextResponse } from 'next/server';
import {
  DatabaseDestinationMetadataSchema,
  getSessionSecret,
} from '@fbuploadpro/contracts';
import { handleConnectComplete } from '@/app/api/connect/[platform]/complete/route';
import {
  verifyPendingDestinations,
  PENDING_COOKIE_NAME,
  type PendingDestinationsPayload,
} from '@/lib/connect/state';
import {
  resolveConnectDbClient,
} from '@/lib/connect/session';
import {
  mergeRowMetadata,
  type ConnectDbClient,
} from '@/lib/connect/persist';
import type { InstagramDiscoveredDestination } from '@/lib/connect/platforms/instagram';

/**
 * POST /api/connect/instagram/complete — finishes an Instagram connect
 * (Spec 124, closing spec 132's G-IG.1(iii) gap). A static segment, so
 * it wins over the framework's `[platform]` complete route for
 * Instagram only.
 *
 * The heavy lifting is the framework's: session check, pending cookie
 * verification, and persisting the destinations the user picked. This
 * wrapper adds the one Instagram-specific write the framework has no
 * field for: the account's provider-reported type (`accountType`,
 * carried through the pending cookie on the discovered destination)
 * is merged into each picked destination's `metadata` as
 * `account_type`.
 *
 * That key is what the story gate reads: the worker's Instagram
 * publisher refuses stories for non-Business accounts from it, and
 * the web destination detail surfaces it so the composer offers
 * Stories only to known-Business destinations (spec 132 §4.1).
 * Before this route existed nothing ever wrote the key, so Stories
 * were offered to nobody.
 *
 * The merge is an UPDATE keyed on the persisted destination, so a
 * RECONNECT backfills destinations connected earlier (and picks up an
 * account-type change, e.g. Creator → Business). Destinations that are
 * never reconnected keep no `account_type` and stay "unknown" — the
 * type is never guessed or backfilled from anything but the
 * provider's own report at connect time.
 */

interface PendingPick {
  pending: PendingDestinationsPayload;
  /** Per picked destination: the type the provider reported for it. */
  picks: Array<{ externalDestinationId: string; accountType: string | null }>;
}

function accountTypeOf(destination: unknown): string | null {
  const raw = (destination as InstagramDiscoveredDestination | undefined)
    ?.accountType;
  if (typeof raw !== 'string') return null;
  // Validated against the contracts metadata schema before it is
  // written: a malformed value must never land in `destinations.
  // metadata`, where row validation would fail loudly on every read.
  const parsed = DatabaseDestinationMetadataSchema.safeParse({
    account_type: raw,
  });
  if (!parsed.success) {
    console.error(
      '[connect/instagram] Provider reported an account type the contracts reject; not persisting it:',
      raw
    );
    return null;
  }
  return parsed.data.account_type ?? null;
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
  } catch (err) {
    // Not fatal here: the framework's complete handler re-verifies
    // the cookie and produces the connect error response. We only
    // lose the account-type patch for this attempt, so log it.
    console.error(
      '[connect/instagram] Pending cookie could not be verified for the account-type patch:',
      err
    );
    return null;
  }
  if (pending.platform !== 'instagram') return null;

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
  } catch (err) {
    console.error(
      '[connect/instagram] Complete request body could not be parsed:',
      err
    );
    return { pending, picks: [] };
  }

  const picks = pending.destinations
    .filter((destination) =>
      requestedIds.has(destination.externalDestinationId)
    )
    .map((destination) => ({
      externalDestinationId: destination.externalDestinationId,
      accountType: accountTypeOf(destination),
    }));
  return { pending, picks };
}

async function persistAccountTypes(
  client: ConnectDbClient,
  pick: PendingPick
): Promise<void> {
  for (const destination of pick.picks) {
    // No reported type → nothing is written. The destination stays
    // "unknown" rather than gaining a guessed type.
    if (!destination.accountType) continue;
    await mergeRowMetadata(
      client,
      'destinations',
      {
        account_id: pick.pending.accountId,
        external_destination_id: destination.externalDestinationId,
      },
      { account_type: destination.accountType }
    );
  }
}

export async function handleInstagramComplete(
  request: NextRequest,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  // Read the pending pick BEFORE delegating: the framework consumes
  // the request body and clears the pending cookie in its response.
  const pick = await readPendingPick(request);

  const response = await handleConnectComplete(request, 'instagram', dbClient);

  if (response.status === 200 && pick && pick.picks.length > 0) {
    const client = resolveConnectDbClient(dbClient);
    if (client) {
      try {
        await persistAccountTypes(client, pick);
      } catch (err) {
        // The destinations are saved; a missing account type fails
        // the story gate closed (Stories stay unoffered) until a
        // reconnect rewrites it. Never fail the connect over it.
        console.error(
          '[connect/instagram] Failed to persist account type:',
          err
        );
      }
    }
  }
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleInstagramComplete(request);
}
