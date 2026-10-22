import { type NextRequest, NextResponse } from 'next/server';
import { isKnownPlatform } from '@/lib/connect/registry';
import { processPlatformRevocation } from '@/lib/connect/platform-callback';
import type { ConnectDbClient } from '@/lib/connect/persist';

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

  await processPlatformRevocation(
    request,
    platformParam,
    'deauthorize',
    dbClient
  );
  return NextResponse.json({ received: true });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await context.params;
  return handleConnectDeauthorize(request, platform);
}
