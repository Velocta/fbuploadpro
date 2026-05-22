import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function resetStaleDownloads(supabase, olderThanSeconds = 180, limit = 1000) {
  return supabase.rpc('reset_stale_download_jobs_v2', {
    p_older_than_seconds: olderThanSeconds,
    p_limit: limit,
  });
}

export async function failExhaustedDownloads(supabase, limit = 1000) {
  const { data: candidates, error } = await supabase
    .from('posting_jobs_v2')
    .select('job_id, reel_internal_id')
    .eq('status', 'download_pending')
    .gt('download_retries', 10)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error || !candidates?.length) {
    return { count: 0, error };
  }

  const jobIds = candidates.map((j) => j.job_id);
  const reelIds = candidates.map((j) => j.reel_internal_id).filter(Boolean);

  const [{ error: jobError }, { error: reelError }] = await Promise.all([
    supabase
      .from('posting_jobs_v2')
      .update({
        status: 'failed_to_download',
      })
      .in('job_id', jobIds),
    reelIds.length
      ? supabase
          .from('reels')
          .update({ status: 'failed' })
          .in('id', reelIds)
          .eq('status', 'processing')
      : Promise.resolve({ error: null }),
  ]);

  return {
    count: jobError || reelError ? 0 : jobIds.length,
    error: jobError || reelError || null,
  };
}

export async function claimDownloadJobs(supabase, limit) {
  return supabase.rpc('claim_download_jobs_v2', { p_limit: limit });
}

export async function getDownloadProcessingDepth(supabase) {
  const { count, error } = await supabase
    .from('posting_jobs_v2')
    .select('job_id', { count: 'exact', head: true })
    .eq('status', 'download_processing');
  return { count: count ?? 0, error };
}

export async function getDownloadBackpressureSnapshot(supabase) {
  const { data, error } = await supabase
    .from('posting_jobs_v2')
    .select('updated_at')
    .eq('status', 'download_pending')
    .order('updated_at', { ascending: true })
    .limit(10000);
  if (error) return { error };
  const oldest = data?.[0]?.updated_at ?? null;
  return { error: null, depth: data?.length ?? 0, oldest_updated_at: oldest };
}
