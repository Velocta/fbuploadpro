import { decryptToken, getTokenEncryptionKey, type DatabaseClient } from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTenantWorkspaceId } from './workspace-resolver';
import { getCredentials } from './platform-credentials';

export interface ResolvedBYOCCredentials {
  ok: true;
  workspaceId: string;
  fbAppId: string;
  decryptedAppSecret: string;
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
 * Reads the workspace's facebook row from `platform_credentials` via the
 * per-platform credentials service (spec 123) and decrypts
 * `encrypted_client_secret` in-memory using `TOKEN_ENCRYPTION_KEY`.
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

  const notConfigured: UnresolvedBYOCCredentials = {
    ok: false,
    error: 'BYOC_NOT_CONFIGURED',
    message: 'Facebook BYOC is not configured for this workspace. Configure your App ID and Secret in Settings.',
    status: 422,
  };

  if (!isLegacyClient(client ?? undefined) && !getRouteSupabase(client ?? undefined)) {
    return {
      ok: false,
      error: 'BYOC_NOT_CONFIGURED',
      message: 'Database service unavailable',
      status: 422,
    };
  }

  try {
    const creds = await getCredentials(workspaceId, 'facebook', client ?? undefined);

    if (!creds?.clientId || !creds?.encryptedClientSecret) {
      return notConfigured;
    }

    const decryptedAppSecret = await decryptToken(creds.encryptedClientSecret, getTokenEncryptionKey());
    return {
      ok: true,
      workspaceId,
      fbAppId: creds.clientId,
      decryptedAppSecret,
    };
  } catch (err) {
    console.warn('[BYOC Resolver] Failed to resolve Facebook credentials:', err);
    return notConfigured;
  }
}
