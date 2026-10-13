import { type NextRequest, NextResponse } from 'next/server';
import {
  SaveBYOCCredentialsRequestSchema,
  verifySessionToken,
  canAccessTenant,
  encryptToken,
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

export async function GET(
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

  // Find workspace
  const workspaceRows = (await db.query(
    `SELECT id, name, subdomain FROM workspaces WHERE subdomain = $1 LIMIT 1`,
    [subdomain]
  )) as Array<{ id: string; name: string; subdomain: string }>;

  let workspaceId = workspaceRows?.[0]?.id;
  if (!workspaceId) {
    // Attempt backfill
    const inserted = (await db.query(
      `INSERT INTO workspaces (id, owner_id, name, subdomain)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (subdomain) DO UPDATE SET owner_id = EXCLUDED.owner_id
       RETURNING id`,
      [session.userId, subdomain, subdomain]
    )) as Array<{ id: string }>;
    workspaceId = inserted?.[0]?.id;
  }

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Find BYOC credentials
  const byocRows = (await db.query(
    `SELECT workspace_id AS "workspaceId", fb_app_id AS "fbAppId",
            encrypted_fb_app_secret AS "encryptedSecret",
            webhook_verify_token AS "webhookVerifyToken",
            status, last_tested_at AS "lastTestedAt"
     FROM workspace_byoc_credentials
     WHERE workspace_id = $1 LIMIT 1`,
    [workspaceId]
  )) as Array<{
    workspaceId: string;
    fbAppId: string;
    encryptedSecret?: string;
    webhookVerifyToken?: string | null;
    status: 'unverified' | 'valid' | 'invalid';
    lastTestedAt?: string | null;
  }>;

  const byoc = byocRows?.[0];

  return NextResponse.json({
    workspaceId,
    subdomain,
    fbAppId: byoc?.fbAppId || '',
    hasSecret: Boolean(byoc?.encryptedSecret),
    webhookVerifyToken: byoc?.webhookVerifyToken || null,
    status: byoc?.status || 'unverified',
    lastTestedAt: byoc?.lastTestedAt || null,
  });
}

export async function PUT(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const parseResult = SaveBYOCCredentialsRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.errors[0]?.message || 'Validation failed' },
      { status: 400 }
    );
  }

  const { fbAppId, fbAppSecret, webhookVerifyToken } = parseResult.data;
  const db = getDbClient();

  // Find workspace
  const workspaceRows = (await db.query(
    `SELECT id FROM workspaces WHERE subdomain = $1 LIMIT 1`,
    [subdomain]
  )) as Array<{ id: string }>;

  const workspaceId = workspaceRows?.[0]?.id;
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const encryptionKey = getEncryptionKey();

  if (fbAppSecret && fbAppSecret.length > 0) {
    const encryptedSecret = await encryptToken(fbAppSecret, encryptionKey);

    await db.query(
      `INSERT INTO workspace_byoc_credentials (
        workspace_id, user_id, fb_app_id, encrypted_fb_app_secret, webhook_verify_token, status, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'unverified', now())
      ON CONFLICT (workspace_id)
      DO UPDATE SET
        fb_app_id = EXCLUDED.fb_app_id,
        encrypted_fb_app_secret = EXCLUDED.encrypted_fb_app_secret,
        webhook_verify_token = EXCLUDED.webhook_verify_token,
        status = 'unverified',
        updated_at = now()`,
      [workspaceId, session.userId, fbAppId, encryptedSecret, webhookVerifyToken || null]
    );
  } else {
    // Only update app ID and webhook verify token without overwriting existing secret
    await db.query(
      `UPDATE workspace_byoc_credentials
       SET fb_app_id = $1,
           webhook_verify_token = $2,
           status = 'unverified',
           updated_at = now()
       WHERE workspace_id = $3`,
      [fbAppId, webhookVerifyToken || null, workspaceId]
    );
  }

  return NextResponse.json({
    success: true,
    hasSecret: true,
    status: 'unverified',
  });
}
