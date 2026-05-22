import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function markDownloadSuccess(supabase, jobId, patch) {
  return supabase
    .from('posting_jobs_v2')
    .update({
      status: 'pending_publish',
      ...patch,
    })
    .eq('job_id', jobId)
    .eq('status', 'download_processing');
}

export async function markDownloadRetry(supabase, jobId, code, message) {
  const { data: current, error: fetchError } = await supabase
    .from('posting_jobs_v2')
    .select('download_retries')
    .eq('job_id', jobId)
    .single();

  if (fetchError) return { error: fetchError };

  return supabase
    .from('posting_jobs_v2')
    .update({
      status: 'download_pending',
      download_started_at: null,
      download_retries: Number(current?.download_retries || 0) + 1,
      last_error_code: code ?? null,
      last_error_message: message ?? null,
    })
    .eq('job_id', jobId)
    .eq('status', 'download_processing');
}
