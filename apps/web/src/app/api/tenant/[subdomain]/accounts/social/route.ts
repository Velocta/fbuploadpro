import { type NextRequest, NextResponse } from 'next/server';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import {
  fetchSocialAccountsWithDestinations,
  type ConnectDbClient,
} from '@/lib/connect/persist';
import {
  extractConnectSession,
  resolveConnectDbClient,
  sessionCanAccessTenant,
} from '@/lib/connect/session';

/**
 * GET /api/tenant/[subdomain]/accounts/social — the unified Accounts list
 * data: every connected social account in the workspace, across all
 * platforms, each with its destinations (Spec 123, Part C).
 */
export async function handleListSocialAccounts(
  request: NextRequest,
  subdomain: string,
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
    const accounts = await fetchSocialAccountsWithDestinations(
      client,
      workspaceId
    );
    return NextResponse.json({ accounts });
  } catch (err) {
    console.error('[accounts/social] Failed to list accounts:', err);
    return NextResponse.json(
      { error: "Couldn't load your connected accounts. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListSocialAccounts(request, subdomain);
}
