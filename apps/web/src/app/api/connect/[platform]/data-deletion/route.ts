import { type NextRequest, NextResponse } from 'next/server';
import { isKnownPlatform } from '@/lib/connect/registry';
import { processPlatformRevocation } from '@/lib/connect/platform-callback';
import type { ConnectDbClient } from '@/lib/connect/persist';

/**
 * POST /api/connect/[platform]/data-deletion — stable public address a
 * platform calls when a user asks for their data to be removed. The
 * matching account is marked revoked (it can no longer publish) and the
 * platform receives the standard confirmation response pointing at the
 * Accounts page, where the workspace owner manages connected accounts.
 * Platform-specific deletion handling belongs to spec 124+.
 */
export async function handleConnectDataDeletion(
  request: NextRequest,
  platformParam: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  if (!isKnownPlatform(platformParam)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 });
  }

  const confirmationCode = crypto
    .randomUUID()
    .replaceAll('-', '')
    .slice(0, 16);
  const { externalAccountId } = await processPlatformRevocation(
    request,
    platformParam,
    'data-deletion',
    dbClient
  );
  console.info('[connect/data-deletion] Confirmation issued', {
    platform: platformParam,
    identified: Boolean(externalAccountId),
    confirmationCode,
  });

  const statusUrl = new URL('/accounts', request.url);
  return NextResponse.json({
    url: statusUrl.toString(),
    confirmation_code: confirmationCode,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await context.params;
  return handleConnectDataDeletion(request, platform);
}
