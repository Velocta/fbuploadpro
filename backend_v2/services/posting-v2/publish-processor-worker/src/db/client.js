import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function resetStalePublishing(supabase, olderThanSeconds = 180, limit = 1000) {
  return supabase.rpc('reset_stale_publish_jobs_v2', {
    p_older_than_seconds: olderThanSeconds,
    p_limit: limit,
  });
}

export async function claimPublishJobs(supabase, limit) {
  return supabase.rpc('claim_publish_jobs_v2', { p_limit: limit });
}

export async function getPublishBackpressureSnapshot(supabase) {
  const { data, error } = await supabase
    .from('posting_jobs_v2')
    .select('updated_at')
    .eq('status', 'pending_publish')
    .order('updated_at', { ascending: true })
    .limit(10000);
  if (error) return { error };
  const oldest = data?.[0]?.updated_at ?? null;
  return { error: null, depth: data?.length ?? 0, oldest_updated_at: oldest };
}
