import { type NextRequest, NextResponse } from 'next/server';
import { getSessionSecret, signMagicLinkToken, verifySessionToken } from '@fbuploadpro/contracts';

async function extractExpectedAccountFromBody(request: NextRequest): Promise<{
  expectedFbAccountId?: string | undefined;
  expectedDisplayName?: string | undefined;
}> {
  try {
    const body = (await request.json()) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return {};
    }
    const expectedFbAccountId =
      typeof body.expectedFbAccountId === 'string' && body.expectedFbAccountId.trim()
        ? body.expectedFbAccountId.trim()
        : undefined;
    const expectedDisplayName =
      typeof body.expectedDisplayName === 'string' && body.expectedDisplayName.trim()
        ? body.expectedDisplayName.trim()
        : undefined;
    return { expectedFbAccountId, expectedDisplayName };
  } catch {
    return {};
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;

  const sessionSecret = getSessionSecret();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // 1. Session auth guard
  const sessionCookie = request.cookies.get('fbup_session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let session;
  try {
    session = await verifySessionToken(sessionCookie, sessionSecret);
  } catch (_e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Tenant isolation check
  if (session.subdomain !== subdomain && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Generate 15-minute cryptographically signed magic token
  const { expectedFbAccountId, expectedDisplayName } =
    await extractExpectedAccountFromBody(request);

  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const expiresInSeconds = 900; // 15 minutes
  const exp = now + expiresInSeconds;

  const token = await signMagicLinkToken(
    {
      tenantSubdomain: subdomain,
      userId: session.userId,
      nonce,
      iat: now,
      exp,
      ...(expectedFbAccountId ? { expectedFbAccountId } : {}),
      ...(expectedDisplayName ? { expectedDisplayName } : {}),
    },
    sessionSecret
  );

  const magicUrl = `${appUrl}/connect/facebook?token=${token}`;

  return NextResponse.json({
    success: true,
    magicUrl,
    expiresAt: new Date(exp * 1000).toISOString(),
    expiresInSeconds,
  });
}
