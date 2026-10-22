import { type NextRequest, NextResponse } from 'next/server';
import { isKnownPlatform } from '@/lib/connect/registry';
import { extractExternalAccountId } from '@/lib/connect/platform-callback';
import {
  markSocialAccountRevoked,
  type ConnectDbClient,
} from '@/lib/connect/persist';
import { resolveConnectDbClient } from '@/lib/connect/session';

/**
 * POST /api/connect/[platform]/deauthorize — stable public address a
 * platform calls when a user removes the app on their side. When the
 * account can be identified, its row is marked revoked so the workspace
 * sees it needs reconnecting. Always answers 200 so the platform does not
 * retry a notification we have already recorded.
 */
export async function handleConnectDeauthorize(
  request: NextRequest,
  platformParam: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  if (!isKnownPlatform(platformParam)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 });
  }
  const platform = platformParam;

  const externalAccountId = await extractExternalAccountId(request);
  console.info('[connect/deauthorize] Received deauthorization notice', {
    platform,
    identified: Boolean(externalAccountId),
  });

  if (externalAccountId) {
    const client = resolveConnectDbClient(dbClient);
    if (client) {
      const { updated } = await markSocialAccountRevoked(
        client,
        platform,
        externalAccountId
      );
      console.info('[connect/deauthorize] Accounts marked revoked', {
        platform,
        updated,
      });
    } else {
      console.error(
        '[connect/deauthorize] No database client available to record revocation',
        { platform }
      );
    }
  }

  return NextResponse.json({ received: true });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await context.params;
  return handleConnectDeauthorize(request, platform);
}
