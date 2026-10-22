import { type NextRequest, NextResponse } from 'next/server';
import { isKnownPlatform } from '@/lib/connect/registry';
import { extractExternalAccountId } from '@/lib/connect/platform-callback';
import {
  markSocialAccountRevoked,
  type ConnectDbClient,
} from '@/lib/connect/persist';
import { resolveConnectDbClient } from '@/lib/connect/session';

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
  const platform = platformParam;

  const externalAccountId = await extractExternalAccountId(request);
  const confirmationCode = crypto
    .randomUUID()
    .replaceAll('-', '')
    .slice(0, 16);
  console.info('[connect/data-deletion] Received data deletion request', {
    platform,
    identified: Boolean(externalAccountId),
    confirmationCode,
  });

  if (externalAccountId) {
    const client = resolveConnectDbClient(dbClient);
    if (client) {
      const { updated } = await markSocialAccountRevoked(
        client,
        platform,
        externalAccountId
      );
      console.info('[connect/data-deletion] Accounts marked revoked', {
        platform,
        updated,
      });
    } else {
      console.error(
        '[connect/data-deletion] No database client available to record revocation',
        { platform }
      );
    }
  }

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
