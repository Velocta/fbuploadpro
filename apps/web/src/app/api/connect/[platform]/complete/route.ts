import { type NextRequest, NextResponse } from 'next/server';
import { getSessionSecret } from '@fbuploadpro/contracts';
import { isKnownPlatform } from '@/lib/connect/registry';
import {
  verifyPendingDestinations,
  PENDING_COOKIE_NAME,
} from '@/lib/connect/state';
import {
  persistPickedDestinations,
  type ConnectDbClient,
} from '@/lib/connect/persist';
import {
  extractConnectSession,
  resolveConnectDbClient,
  sessionCanAccessTenant,
} from '@/lib/connect/session';

/**
 * POST /api/connect/[platform]/complete — finishes a connect flow.
 *
 * Body: { destinationIds: string[] } — the external destination IDs the
 * user picked in the destination picker. Only destinations from the signed
 * pending cookie can be persisted; anything else is ignored. Returns the
 * unified Accounts landing URL.
 */
export async function handleConnectComplete(
  request: NextRequest,
  platformParam: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  if (!isKnownPlatform(platformParam)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 });
  }
  const platform = platformParam;

  const session = await extractConnectSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pendingCookie = request.cookies.get(PENDING_COOKIE_NAME)?.value;
  if (!pendingCookie) {
    return NextResponse.json(
      { error: 'This connection has expired. Please start again.' },
      { status: 410 }
    );
  }

  let pending;
  try {
    pending = await verifyPendingDestinations(
      pendingCookie,
      getSessionSecret()
    );
  } catch (err) {
    console.error('[connect/complete] Pending cookie invalid:', err);
    return NextResponse.json(
      { error: 'This connection has expired. Please start again.' },
      { status: 410 }
    );
  }

  if (
    pending.platform !== platform ||
    pending.tenantSubdomain !== session.subdomain ||
    !sessionCanAccessTenant(session, pending.tenantSubdomain)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { destinationIds?: unknown };
  try {
    body = (await request.json()) as { destinationIds?: unknown };
  } catch {
    return NextResponse.json(
      { error: 'Please choose at least one destination to add.' },
      { status: 400 }
    );
  }

  const requestedIds = new Set(
    Array.isArray(body.destinationIds)
      ? body.destinationIds.filter(
          (id): id is string => typeof id === 'string'
        )
      : []
  );
  const picked = pending.destinations.filter((destination) =>
    requestedIds.has(destination.externalDestinationId)
  );
  if (picked.length === 0) {
    return NextResponse.json(
      { error: 'Please choose at least one destination to add.' },
      { status: 400 }
    );
  }

  const client = resolveConnectDbClient(dbClient);
  if (!client) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  try {
    await persistPickedDestinations(client, {
      workspaceId: pending.workspaceId,
      accountId: pending.accountId,
      platform,
      destinations: picked,
    });
  } catch (err) {
    console.error('[connect/complete] Failed to persist destinations:', err);
    return NextResponse.json(
      { error: "Couldn't save your choices. Please try again." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({
    accountsUrl: `/tenant/${pending.tenantSubdomain}/accounts`,
    addedCount: picked.length,
  });
  response.cookies.set(PENDING_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return response;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await context.params;
  return handleConnectComplete(request, platform);
}
