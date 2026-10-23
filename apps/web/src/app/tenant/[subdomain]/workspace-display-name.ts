import { cache } from 'react';
import { getServerSessionContext } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/auth/clients';
import { reportError } from '@/lib/report-error';

/**
 * Server-only: resolve the workspace display name for a tenant subdomain.
 * Returns null when the lookup fails — callers fall back to the subdomain.
 *
 * Wrapped in React `cache()` (spec 130 §5.8, discharging spec 137 §11(b)):
 * within one request the tenant layout's `generateMetadata`, the layout
 * body and the workspace home page share ONE session lookup + ONE
 * Supabase query instead of performing the same lookup three times.
 *
 * Failure contract (named and tested, not a silent swallow): a failed
 * lookup is reported through the `reportError` seam and resolves to
 * null — it never throws into render, so a name-lookup outage degrades
 * to the subdomain-slug fallback instead of breaking the shell.
 */
export const getWorkspaceDisplayName = cache(
  async (subdomain: string): Promise<string | null> => {
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
    } catch (error) {
      reportError(error, { source: 'workspace-display-name' });
      return null;
    }
  }
);
