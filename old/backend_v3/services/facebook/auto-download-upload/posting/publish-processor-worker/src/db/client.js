import { createClient } from '@supabase/supabase-js';

let cachedSupabase = null;

export function getSupabaseClient(env) {
  if (!cachedSupabase) {
    cachedSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return cachedSupabase;
}

export async function resetStalePublishing(supabase, olderThanSeconds = 180, limit = 1000) {
  return supabase.rpc('reset_stale_publish_jobs_adu', {
    p_older_than_seconds: olderThanSeconds,
    p_limit: limit,
  });
}

export async function claimPublishJobs(supabase, limit) {
  return supabase.rpc('claim_publish_jobs_adu', { p_limit: limit });
}

export async function releasePublishJob(supabase, jobId, errorCode = null, errorMessage = null) {
  return supabase.rpc('release_publish_job_adu', {
    p_job_id: jobId,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });
}
