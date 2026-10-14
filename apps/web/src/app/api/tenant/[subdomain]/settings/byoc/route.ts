import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  getTokenEncryptionKey,
  SaveBYOCCredentialsRequestSchema,
  verifySessionToken,
  canAccessTenant,
  encryptToken,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';

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

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    // Find workspace via Supabase PostgREST
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('subdomain', subdomain)
      .maybeSingle();

    const workspaceId = workspace?.id as string | undefined;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Find BYOC credentials via Supabase PostgREST
    const { data: byoc } = await supabase
      .from('workspace_byoc_credentials')
      .select('workspace_id, fb_app_id, encrypted_fb_app_secret, webhook_verify_token, status, last_tested_at')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    return NextResponse.json({
      workspaceId,
      subdomain,
      fbAppId: byoc?.fb_app_id || '',
      hasSecret: Boolean(byoc?.encrypted_fb_app_secret),
      webhookVerifyToken: byoc?.webhook_verify_token || null,
      status: byoc?.status || 'unverified',
      lastTestedAt: byoc?.last_tested_at || null,
    });
  } catch (err) {
    console.error('[BYOC Settings API] Unhandled GET exception:', err);
    return NextResponse.json({ error: 'Failed to retrieve BYOC settings' }, { status: 500 });
  }
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('subdomain', subdomain)
      .maybeSingle();

    const workspaceId = workspace?.id as string | undefined;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const encryptionKey = getTokenEncryptionKey();

    if (fbAppSecret && fbAppSecret.length > 0) {
      const encryptedSecret = await encryptToken(fbAppSecret, encryptionKey);

      const { error: upsertErr } = await supabase.from('workspace_byoc_credentials').upsert(
        {
          workspace_id: workspaceId,
          user_id: session.userId,
          fb_app_id: fbAppId,
          encrypted_fb_app_secret: encryptedSecret,
          webhook_verify_token: webhookVerifyToken || null,
          status: 'unverified',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' }
      );

      if (upsertErr) {
        console.error('[BYOC Settings API] Upsert credentials error:', upsertErr);
        return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
      }
    } else {
      const { error: updateErr } = await supabase
        .from('workspace_byoc_credentials')
        .update({
          fb_app_id: fbAppId,
          webhook_verify_token: webhookVerifyToken || null,
          status: 'unverified',
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId);

      if (updateErr) {
        console.error('[BYOC Settings API] Update credentials error:', updateErr);
        return NextResponse.json({ error: 'Failed to update credentials' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      hasSecret: true,
      status: 'unverified',
    });
  } catch (err) {
    console.error('[BYOC Settings API] Unhandled PUT exception:', err);
    return NextResponse.json({ error: 'Failed to save BYOC credentials' }, { status: 500 });
  }
}
