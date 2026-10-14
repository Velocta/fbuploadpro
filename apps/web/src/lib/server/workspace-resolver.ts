import type { DatabaseClient, UserRole } from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves the workspace ID for a given tenant subdomain owned by userId (or any owner if role === 'admin').
 * Returns null if the workspace does not exist or does not belong to the user.
 */
export async function resolveTenantWorkspaceId(
  client: DatabaseClient | SupabaseClient<any> | null | undefined,
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
    } catch {
      // Database query error: workspace unresolved
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

    if (error || !ws?.id) {
      return null;
    }
    return ws.id;
  } catch {
    // Query error: workspace unresolved
    return null;
  }
}
