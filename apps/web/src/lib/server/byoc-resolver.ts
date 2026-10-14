import { decryptToken, getTokenEncryptionKey, type DatabaseClient } from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedBYOCCredentials {
  ok: true;
  workspaceId: string;
  fbAppId: string;
  decryptedAppSecret: string;
  webhookVerifyToken: string | null;
}

export interface UnresolvedBYOCCredentials {
  ok: false;
  error: 'WORKSPACE_NOT_FOUND' | 'BYOC_NOT_CONFIGURED';
  message: string;
  status: 404 | 422;
}

export type ResolveBYOCResult = ResolvedBYOCCredentials | UnresolvedBYOCCredentials;

/**
 * Resolves verified Facebook BYOC credentials for the specified workspace.
 * Strictly checks that the workspace matches both `subdomain` and `owner_id = userId`.
 * Decrypts `encrypted_fb_app_secret` in-memory using `TOKEN_ENCRYPTION_KEY`.
 * Never falls back to global platform process.env credentials.
 */
export async function resolveWorkspaceFacebookCredentials(
  client: DatabaseClient | SupabaseClient<any> | null | undefined,
  subdomain: string,
  userId: string
): Promise<ResolveBYOCResult> {
  const encryptionKey = getTokenEncryptionKey();

  if (isLegacyClient(client)) {
    try {
      const wsRows = (await client.query(
        'SELECT id FROM workspaces WHERE subdomain = $1 AND owner_id = $2 LIMIT 1',
        [subdomain, userId]
      )) as Array<{ id: string }>;

      const workspace = wsRows?.[0];
      if (!workspace?.id) {
        return {
          ok: false,
          error: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found',
          status: 404,
        };
      }

      const credRows = (await client.query(
        `SELECT fb_app_id, encrypted_fb_app_secret, webhook_verify_token
         FROM workspace_byoc_credentials
         WHERE workspace_id = $1
         LIMIT 1`,
        [workspace.id]
      )) as Array<{
        fb_app_id?: string;
        encrypted_fb_app_secret?: string;
        webhook_verify_token?: string | null;
      }>;

      const creds = credRows?.[0];
      if (!creds?.fb_app_id || !creds?.encrypted_fb_app_secret) {
        return {
          ok: false,
          error: 'BYOC_NOT_CONFIGURED',
          message: 'Facebook BYOC is not configured for this workspace. Configure your App ID and Secret in Settings.',
          status: 422,
        };
      }

      const decryptedAppSecret = await decryptToken(creds.encrypted_fb_app_secret, encryptionKey);
      return {
        ok: true,
        workspaceId: workspace.id,
        fbAppId: creds.fb_app_id,
        decryptedAppSecret,
        webhookVerifyToken: creds.webhook_verify_token ?? null,
      };
    } catch (_err) {
      return {
        ok: false,
        error: 'BYOC_NOT_CONFIGURED',
        message: 'Facebook BYOC is not configured for this workspace. Configure your App ID and Secret in Settings.',
        status: 422,
      };
    }
  }

  const supabase = getRouteSupabase(client);
  if (!supabase) {
    return {
      ok: false,
      error: 'BYOC_NOT_CONFIGURED',
      message: 'Database service unavailable',
      status: 422,
    };
  }

  try {
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('owner_id', userId)
      .maybeSingle();

    if (wsError || !workspace?.id) {
      return {
        ok: false,
        error: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace not found',
        status: 404,
      };
    }

    const { data: creds, error: credError } = await supabase
      .from('workspace_byoc_credentials')
      .select('fb_app_id, encrypted_fb_app_secret, webhook_verify_token')
      .eq('workspace_id', workspace.id)
      .maybeSingle();

    if (credError || !creds?.fb_app_id || !creds?.encrypted_fb_app_secret) {
      return {
        ok: false,
        error: 'BYOC_NOT_CONFIGURED',
        message: 'Facebook BYOC is not configured for this workspace. Configure your App ID and Secret in Settings.',
        status: 422,
      };
    }

    const decryptedAppSecret = await decryptToken(creds.encrypted_fb_app_secret, encryptionKey);
    return {
      ok: true,
      workspaceId: workspace.id,
      fbAppId: creds.fb_app_id,
      decryptedAppSecret,
      webhookVerifyToken: creds.webhook_verify_token ?? null,
    };
  } catch (_err) {
    return {
      ok: false,
      error: 'BYOC_NOT_CONFIGURED',
      message: 'Facebook BYOC is not configured for this workspace. Configure your App ID and Secret in Settings.',
      status: 422,
    };
  }
}
