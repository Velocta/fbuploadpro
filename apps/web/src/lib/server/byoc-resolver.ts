import { decryptToken, getTokenEncryptionKey, type DatabaseClient } from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantWorkspaceId } from './workspace-resolver';

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
  userId: string,
  role?: string
): Promise<ResolveBYOCResult> {
  const workspaceId = await resolveTenantWorkspaceId(client, subdomain, userId, role);
  if (!workspaceId) {
    return {
      ok: false,
      error: 'WORKSPACE_NOT_FOUND',
      message: 'Workspace not found',
      status: 404,
    };
  }

  const encryptionKey = getTokenEncryptionKey();

  if (isLegacyClient(client ?? undefined)) {
    const legacyClient = client as DatabaseClient;
    try {
      const credRows = (await legacyClient.query(
        `SELECT fb_app_id, encrypted_fb_app_secret, webhook_verify_token
         FROM workspace_byoc_credentials
         WHERE workspace_id = $1
         LIMIT 1`,
        [workspaceId]
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
        workspaceId,
        fbAppId: creds.fb_app_id,
        decryptedAppSecret,
        webhookVerifyToken: creds.webhook_verify_token ?? null,
      };
    } catch (err) {
      console.warn('[BYOC Resolver] Failed to resolve legacy BYOC credentials:', err);
      return {
        ok: false,
        error: 'BYOC_NOT_CONFIGURED',
        message: 'Facebook BYOC is not configured for this workspace. Configure your App ID and Secret in Settings.',
        status: 422,
      };
    }
  }

  const supabase = getRouteSupabase(client ?? undefined);
  if (!supabase) {
    return {
      ok: false,
      error: 'BYOC_NOT_CONFIGURED',
      message: 'Database service unavailable',
      status: 422,
    };
  }

  try {
    const { data: creds, error: credError } = await supabase
      .from('workspace_byoc_credentials')
      .select('fb_app_id, encrypted_fb_app_secret, webhook_verify_token')
      .eq('workspace_id', workspaceId)
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
      workspaceId,
      fbAppId: creds.fb_app_id,
      decryptedAppSecret,
      webhookVerifyToken: creds.webhook_verify_token ?? null,
    };
  } catch (err) {
    console.warn('[BYOC Resolver] Failed to resolve Supabase BYOC credentials:', err);
    return {
      ok: false,
      error: 'BYOC_NOT_CONFIGURED',
      message: 'Facebook BYOC is not configured for this workspace. Configure your App ID and Secret in Settings.',
      status: 422,
    };
  }
}
