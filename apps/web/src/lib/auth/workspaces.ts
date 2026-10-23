/**
 * Workspace subdomain resolution + provisioning (spec 137 §3.2.5 split).
 *
 * Split from the former 1,314-line auth monolith
 * by spec 137 PR-A1b (audit #6 / spec §3.2.5). Function bodies are
 * verbatim; only imports/exports were re-wired to the new modules.
 */

import { getSupabaseAdminClient } from './clients';

export async function resolveUniqueSubdomain(baseSubdomain: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return baseSubdomain;

  try {
    const query = supabase.from('workspaces').select('subdomain');
    let data: Array<{ subdomain: string }> | null = null;
    let error: { message: string } | null = null;

    if (typeof (query as any)?.ilike === 'function') {
      const res = await (query as any).ilike('subdomain', `${baseSubdomain}%`);
      data = res?.data;
      error = res?.error;
    } else if (typeof (query as any)?.eq === 'function') {
      // Fallback for test mocks that only stub eq
      const res = await (query as any).eq('subdomain', baseSubdomain).maybeSingle();
      if (res?.data) {
        data = [res.data];
      }
      error = res?.error;
    } else {
      const res = await (query as any);
      data = res?.data;
      error = res?.error;
    }

    if (error) {
      console.error('[Supabase PostgREST] resolveUniqueSubdomain error:', error.message);
      return baseSubdomain;
    }

    const existing = new Set(
      (data || [])
        .map((row: { subdomain?: string }) => row?.subdomain?.toLowerCase())
        .filter(Boolean) as string[]
    );

    if (!existing.has(baseSubdomain.toLowerCase())) {
      return baseSubdomain;
    }

    let counter = 1;
    while (existing.has(`${baseSubdomain.toLowerCase()}${counter}`)) {
      counter++;
    }
    return `${baseSubdomain}${counter}`;
  } catch (err) {
    console.error('[Supabase PostgREST] resolveUniqueSubdomain exception:', err);
    return baseSubdomain;
  }
}

export async function ensureWorkspaceForUser(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  userId: string,
  userNameOrFallback: string,
  preferredSubdomain: string
): Promise<string> {
  // 1. Check if the user already owns an existing workspace
  try {
    const { data: existingWorkspace } = await supabase
      .from('workspaces')
      .select('id, subdomain')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingWorkspace?.subdomain) {
      return existingWorkspace.subdomain;
    }
  } catch (err) {
    console.error('[Supabase PostgREST] ensureWorkspaceForUser check existing error:', err);
  }

  // 2. Resolve unique subdomain candidate
  let candidate = await resolveUniqueSubdomain(preferredSubdomain);

  // 3. Insert explicitly with retry on unique constraint violation (SQLSTATE 23505)
  let lastFatalError: Error | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { error: insertError } = await supabase.from('workspaces').insert({
        owner_id: userId,
        name: userNameOrFallback,
        subdomain: candidate,
      });

      if (!insertError) {
        return candidate;
      }

      const isConflict =
        insertError.code === '23505' ||
        insertError.message?.toLowerCase().includes('duplicate key') ||
        insertError.message?.toLowerCase().includes('unique constraint');

      if (isConflict) {
        const randomSuffix = crypto.randomUUID().slice(0, 6);
        candidate = `${preferredSubdomain}-${randomSuffix}`;
      } else {
        console.error('[Supabase PostgREST] Workspace insert error:', insertError.message);
        lastFatalError = new Error(`Failed to provision workspace: ${insertError.message || insertError.code}`);
        break;
      }
    } catch (insertEx) {
      console.error('[Supabase PostgREST] Workspace insert exception:', insertEx);
      const isTransient = attempt < 4;
      if (isTransient) {
        const randomSuffix = crypto.randomUUID().slice(0, 6);
        candidate = `${preferredSubdomain}-${randomSuffix}`;
      } else {
        lastFatalError = insertEx instanceof Error ? insertEx : new Error('Failed to provision workspace');
      }
    }
  }

  throw lastFatalError ?? new Error('Failed to provision workspace');
}
