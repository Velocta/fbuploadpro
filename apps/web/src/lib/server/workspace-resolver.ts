import type { DatabaseClient, UserRole } from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import { logServerError } from '@/lib/server-analytics';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves the workspace ID for a given tenant subdomain owned by userId (or any owner if role === 'admin').
 * Returns null if the workspace does not exist or does not belong to the user.
 */
export async function resolveTenantWorkspaceId(
  client: DatabaseClient | SupabaseClient | null | undefined,
  subdomain: string,
  userId: string,
  role?: UserRole | string
): Promise<string | null> {
  const isAdmin = role === 'admin';

  if (isLegacyClient(client ?? undefined)) {
    try {
      const sql = isAdmin
        ? 'SELECT id FROM workspaces WHERE subdomain = $1 LIMIT 1'
        : 'SELECT id FROM workspaces WHERE subdomain = $1 AND owner_id = $2 LIMIT 1';
      const params = isAdmin ? [subdomain] : [subdomain, userId];
      const rows = (await (client as DatabaseClient).query(sql, params)) as Array<{ id: string }>;
      return rows?.[0]?.id ?? null;
    } catch (err) {
      // Database query error: workspace unresolved. Logged (spec 139
      // B19) — a DB outage must not silently masquerade as a 404.
      logServerError('[workspace-resolver] Legacy workspace lookup failed', err, {
        source: 'workspace-resolver',
        subdomain,
      });
      return null;
    }
  }

  const supabase = getRouteSupabase(client ?? undefined);
  if (!supabase) {
    return null;
  }

  try {
    let query = supabase.from('workspaces').select('id').eq('subdomain', subdomain);
    if (!isAdmin) {
      query = query.eq('owner_id', userId);
    }
    const { data: ws, error } = await query.maybeSingle();

    if (error) {
      // Logged (spec 139 B19): a query failure is not a missing workspace.
      logServerError('[workspace-resolver] Workspace lookup failed', error, {
        source: 'workspace-resolver',
        subdomain,
      });
      return null;
    }
    if (!ws?.id) {
      return null;
    }
    return ws.id;
  } catch (err) {
    // Query error: workspace unresolved (logged, spec 139 B19).
    logServerError('[workspace-resolver] Workspace lookup threw', err, {
      source: 'workspace-resolver',
      subdomain,
    });
    return null;
  }
}
