import { type NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  canAccessTenant,
  decryptToken,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { getDbClient } from '@/lib/db';

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long'
  );
}

function getEncryptionKey(): string {
  return (
    process.env.FB_ENCRYPTION_MASTER_KEY ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  );
}

async function extractSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get('fbup_session')?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token, getSessionSecret());
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  const session = await extractSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDbClient();

  // Find workspace BYOC credentials
  const byocRows = (await db.query(
    `SELECT c.workspace_id, c.fb_app_id AS "fbAppId", c.encrypted_fb_app_secret AS "encryptedSecret"
     FROM workspace_byoc_credentials c
     JOIN workspaces w ON w.id = c.workspace_id
     WHERE w.subdomain = $1
     LIMIT 1`,
    [subdomain]
  )) as Array<{
    workspace_id: string;
    fbAppId: string;
    encryptedSecret: string;
  }>;

  const credentials = byocRows?.[0];
  if (!credentials?.fbAppId || !credentials.encryptedSecret) {
    return NextResponse.json(
      {
        success: false,
        status: 'unverified',
        message: 'No Facebook App credentials configured for this workspace.',
        testedAt: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  let decryptedSecret: string;
  try {
    decryptedSecret = await decryptToken(credentials.encryptedSecret, getEncryptionKey());
  } catch (_e) {
    return NextResponse.json(
      {
        success: false,
        status: 'invalid',
        message: 'Decryption failed for stored App Secret.',
        testedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }

  // Test against Meta Graph API v26.0: verify App Access Token
  const metaUrl = new URL(`https://graph.facebook.com/v26.0/${credentials.fbAppId}`);
  metaUrl.searchParams.set('access_token', `${credentials.fbAppId}|${decryptedSecret}`);
  metaUrl.searchParams.set('fields', 'id,name,category');

  const nowIso = new Date().toISOString();

  try {
    const metaRes = await fetch(metaUrl.toString(), { method: 'GET' });
    if (!metaRes.ok) {
      const errJson = (await metaRes.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const msg = errJson?.error?.message || 'Meta Graph API rejected App ID or App Secret.';

      await db.query(
        `UPDATE workspace_byoc_credentials
         SET status = 'invalid', last_tested_at = now(), updated_at = now()
         WHERE workspace_id = $1`,
        [credentials.workspace_id]
      );

      return NextResponse.json({
        success: false,
        status: 'invalid',
        message: msg,
        testedAt: nowIso,
      });
    }

    const appData = (await metaRes.json()) as { id?: string; name?: string };
    const appName = appData?.name || `App ${credentials.fbAppId}`;

    await db.query(
      `UPDATE workspace_byoc_credentials
       SET status = 'valid', last_tested_at = now(), updated_at = now()
       WHERE workspace_id = $1`,
      [credentials.workspace_id]
    );

    return NextResponse.json({
      success: true,
      status: 'valid',
      message: `Successfully connected to "${appName}".`,
      appName,
      testedAt: nowIso,
    });
  } catch (netErr) {
    return NextResponse.json({
      success: false,
      status: 'unverified',
      message: netErr instanceof Error ? netErr.message : 'Network failure testing connection.',
      testedAt: nowIso,
    });
  }
}
