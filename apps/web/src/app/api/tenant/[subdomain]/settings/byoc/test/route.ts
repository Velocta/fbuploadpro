import { type NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  canAccessTenant,
  decryptToken,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';

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

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  // Find workspace via Supabase PostgREST
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('subdomain', subdomain)
    .maybeSingle();

  if (!ws?.id) {
    return NextResponse.json(
      {
        success: false,
        status: 'unverified',
        message: 'Workspace not found.',
        testedAt: new Date().toISOString(),
      },
      { status: 404 }
    );
  }

  const { data: credentials } = await supabase
    .from('workspace_byoc_credentials')
    .select('workspace_id, fb_app_id, encrypted_fb_app_secret')
    .eq('workspace_id', ws.id)
    .maybeSingle();

  if (!credentials?.fb_app_id || !credentials.encrypted_fb_app_secret) {
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
    decryptedSecret = await decryptToken(credentials.encrypted_fb_app_secret, getEncryptionKey());
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
  const metaUrl = new URL(`https://graph.facebook.com/v26.0/${credentials.fb_app_id}`);
  metaUrl.searchParams.set('access_token', `${credentials.fb_app_id}|${decryptedSecret}`);
  metaUrl.searchParams.set('fields', 'id,name,category');

  const nowIso = new Date().toISOString();

  try {
    const metaRes = await fetch(metaUrl.toString(), { method: 'GET' });
    if (!metaRes.ok) {
      const errJson = (await metaRes.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const msg = errJson?.error?.message || 'Meta Graph API rejected App ID or App Secret.';

      await supabase
        .from('workspace_byoc_credentials')
        .update({ status: 'invalid', last_tested_at: nowIso, updated_at: nowIso })
        .eq('workspace_id', ws.id);

      return NextResponse.json({
        success: false,
        status: 'invalid',
        message: msg,
        testedAt: nowIso,
      });
    }

    const appData = (await metaRes.json()) as { id?: string; name?: string };
    const appName = appData?.name || `App ${credentials.fb_app_id}`;

    await supabase
      .from('workspace_byoc_credentials')
      .update({ status: 'valid', last_tested_at: nowIso, updated_at: nowIso })
      .eq('workspace_id', ws.id);

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
