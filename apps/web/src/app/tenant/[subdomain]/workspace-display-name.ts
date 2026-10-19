import { getServerSessionContext } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase-auth';

/**
 * Server-only: resolve the workspace display name for a tenant subdomain.
 * Returns null when the lookup fails — callers fall back to the subdomain.
 */
export async function getWorkspaceDisplayName(subdomain: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return null;
    const session = await getServerSessionContext();
    let query = supabase.from('workspaces').select('name').eq('subdomain', subdomain);
    if (session?.userId) {
      query = query.eq('owner_id', session.userId);
    }
    const { data } = await query.maybeSingle();
    const name = (data as { name?: unknown } | null)?.name;
    return typeof name === 'string' && name.trim() ? name : null;
  } catch {
    return null;
  }
}
