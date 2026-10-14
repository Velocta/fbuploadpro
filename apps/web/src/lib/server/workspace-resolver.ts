import type { DatabaseClient } from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves the workspace ID for a given tenant subdomain owned by userId.
 * Returns null if the workspace does not exist or does not belong to the user.
 */
export async function resolveTenantWorkspaceId(
  client: DatabaseClient | SupabaseClient<any> | null | undefined,
  subdomain: string,
  userId: string
): Promise<string | null> {
  if (isLegacyClient(client ?? undefined)) {
    try {
      const rows = (await (client as DatabaseClient).query(
        'SELECT id FROM workspaces WHERE subdomain = $1 AND owner_id = $2 LIMIT 1',
        [subdomain, userId]
      )) as Array<{ id: string }>;
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
    const { data: ws, error } = await supabase
      .from('workspaces')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('owner_id', userId)
      .maybeSingle();

    if (error || !ws?.id) {
      return null;
    }
    return ws.id;
  } catch {
    // Query error: workspace unresolved
    return null;
  }
}
