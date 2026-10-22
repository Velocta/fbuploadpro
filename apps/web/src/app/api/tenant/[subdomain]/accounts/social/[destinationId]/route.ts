import { type NextRequest, NextResponse } from 'next/server';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import {
  fetchDestinationDetail,
  type ConnectDbClient,
} from '@/lib/connect/persist';
import {
  extractConnectSession,
  resolveConnectDbClient,
  sessionCanAccessTenant,
} from '@/lib/connect/session';

/**
 * GET /api/tenant/[subdomain]/accounts/social/[destinationId] — one
 * destination plus its owning account. Backs the dedicated-section landing
 * page (spec 128 builds the section internals on this data).
 */
export async function handleGetSocialDestination(
  request: NextRequest,
  subdomain: string,
  destinationId: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  const session = await extractConnectSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!sessionCanAccessTenant(session, subdomain)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = resolveConnectDbClient(dbClient);
  if (!client) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  const workspaceId = await resolveTenantWorkspaceId(
    client,
    subdomain,
    session.userId,
    session.role
  );
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404 }
    );
  }

  try {
    const destination = await fetchDestinationDetail(
      client,
      workspaceId,
      destinationId
    );
    if (!destination) {
      return NextResponse.json(
        { error: 'Destination not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ destination });
  } catch (err) {
    console.error('[accounts/social] Failed to load destination:', err);
    return NextResponse.json(
      { error: "Couldn't load this destination. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ subdomain: string; destinationId: string }>;
  }
): Promise<NextResponse> {
  const { subdomain, destinationId } = await context.params;
  return handleGetSocialDestination(request, subdomain, destinationId);
}
