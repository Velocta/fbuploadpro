import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  getTokenEncryptionKey,
  SaveBYOCCredentialsRequestSchema,
  verifySessionToken,
  canAccessTenant,
  encryptToken,
  decryptToken,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';

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
    const workspaceId = await resolveTenantWorkspaceId(supabase, subdomain, session.userId);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const { data: byoc } = await supabase
      .from('workspace_byoc_credentials')
      .select('workspace_id, fb_app_id, encrypted_fb_app_secret, status, last_tested_at, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    let decryptedSecret = '';
    if (byoc?.encrypted_fb_app_secret) {
      try {
        decryptedSecret = await decryptToken(byoc.encrypted_fb_app_secret, getTokenEncryptionKey());
      } catch (err) {
        console.error('[BYOC Settings API] Failed to decrypt app secret for settings view:', err);
      }
    }

    return NextResponse.json({
      workspaceId,
      subdomain,
      fbAppId: byoc?.fb_app_id || '',
      fbAppSecret: decryptedSecret,
      hasSecret: Boolean(byoc?.encrypted_fb_app_secret),
      status: byoc?.status || 'unverified',
      lastTestedAt: byoc?.last_tested_at || null,
      connectedAt: byoc?.created_at || byoc?.updated_at || null,
    });
  } catch (err) {
    console.error('[BYOC Settings API] Unhandled GET exception:', err);
    return NextResponse.json({ error: 'Failed to retrieve BYOC settings' }, { status: 500 });
  }
}

async function saveOrUpdateBYOCCredentials(
  supabase: any,
  workspaceId: string,
  userId: string,
  data: { fbAppId: string; fbAppSecret?: string | undefined }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const encryptionKey = getTokenEncryptionKey();

  if (data.fbAppSecret && data.fbAppSecret.length > 0) {
    const encryptedSecret = await encryptToken(data.fbAppSecret, encryptionKey);

    const { error: upsertErr } = await supabase.from('workspace_byoc_credentials').upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        fb_app_id: data.fbAppId,
        encrypted_fb_app_secret: encryptedSecret,
        status: 'unverified',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' }
    );

    if (upsertErr) {
      console.error('[BYOC Settings API] Upsert credentials error:', upsertErr);
      return { ok: false, error: 'Failed to save credentials', status: 500 };
    }
    return { ok: true };
  }

  // First verify that existing credentials with secret exist
  const { data: existingCreds } = await supabase
    .from('workspace_byoc_credentials')
    .select('encrypted_fb_app_secret')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!existingCreds?.encrypted_fb_app_secret) {
    return { ok: false, error: 'Enter your Facebook App Secret to complete setup.', status: 400 };
  }

  const { error: updateErr } = await supabase
    .from('workspace_byoc_credentials')
    .update({
      fb_app_id: data.fbAppId,
      status: 'unverified',
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId);

  if (updateErr) {
    console.error('[BYOC Settings API] Update credentials error:', updateErr);
    return { ok: false, error: 'Failed to update credentials', status: 500 };
  }

  return { ok: true };
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

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const workspaceId = await resolveTenantWorkspaceId(supabase, subdomain, session.userId);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const saveResult = await saveOrUpdateBYOCCredentials(
      supabase,
      workspaceId,
      session.userId,
      parseResult.data
    );

    if (!saveResult.ok) {
      return NextResponse.json({ error: saveResult.error }, { status: saveResult.status });
    }

    return NextResponse.json({
      success: true,
      hasSecret: true,
      status: 'unverified',
      connectedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[BYOC Settings API] Unhandled PUT exception:', err);
    return NextResponse.json({ error: 'Failed to save BYOC credentials' }, { status: 500 });
  }
}

export async function DELETE(
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
    const workspaceId = await resolveTenantWorkspaceId(supabase, subdomain, session.userId);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Delete ONLY the App ID and App Secret (workspace_byoc_credentials row)
    // Connected accounts, Facebook pages, media items, and scheduled posts remain 100% intact.
    const { error: deleteErr } = await supabase
      .from('workspace_byoc_credentials')
      .delete()
      .eq('workspace_id', workspaceId);

    if (deleteErr) {
      console.error('[BYOC Settings API] Delete credentials error:', deleteErr);
      return NextResponse.json({ error: 'Failed to disconnect Facebook' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      disconnected: true,
    });
  } catch (err) {
    console.error('[BYOC Settings API] Unhandled DELETE exception:', err);
    return NextResponse.json({ error: 'Failed to disconnect Facebook' }, { status: 500 });
  }
}
