import { createClient } from '@supabase/supabase-js';

let cachedSupabase = null;

export function getSupabaseClient(env) {
  if (!cachedSupabase) {
    cachedSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return cachedSupabase;
}

export async function resetStalePublishing(supabase, olderThanSeconds = 300, limit = 1000) {
  const threshold = new Date(Date.now() - olderThanSeconds * 1000).toISOString();
  
  // 1. Find jobs that are stuck in publishing status
  const { data: staleJobs, error: fetchError } = await supabase
    .from('facebook_inapp_schedule_posting_jobs')
    .select('job_id, post_id, retry_count')
    .eq('status', 'publishing')
    .lt('updated_at', threshold)
    .limit(limit);
    
  if (fetchError || !staleJobs?.length) {
    return { error: fetchError, data: 0 };
  }
  
  let resetCount = 0;
  for (const job of staleJobs) {
    // Reset post status back to pending
    const { error: postErr } = await supabase
      .from('facebook_inapp_schedule_posts')
      .update({
        status: 'pending',
        error_message: 'Stale publish reset',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.post_id)
      .eq('status', 'publishing');
      
    if (postErr) continue;
    
    // Reset job status to pending_publish and increment retry_count
    await supabase
      .from('facebook_inapp_schedule_posting_jobs')
      .update({
        status: 'pending_publish',
        retry_count: (job.retry_count || 0) + 1,
        last_error_code: 'stale_reset',
        last_error_message: 'Publishing process timed out / got stuck.',
        updated_at: new Date().toISOString()
      })
      .eq('job_id', job.job_id);
      
    resetCount++;
  }
  
  return { error: null, data: resetCount };
}

export async function claimPublishJobs(supabase, limit) {
  return supabase.rpc('claim_due_inapp_posting_jobs', { p_limit: limit });
}

export async function releasePublishJob(supabase, jobId, postId, errorCode = null, errorMessage = null) {
  const tasks = [
    supabase
      .from('facebook_inapp_schedule_posts')
      .update({
        status: 'pending',
        error_message: errorMessage ? `${errorCode || 'error'}: ${errorMessage}` : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId),
    supabase
      .from('facebook_inapp_schedule_posting_jobs')
      .update({
        status: 'pending_publish',
        last_error_code: errorCode,
        last_error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
  ];
  
  const results = await Promise.all(tasks);
  const error = results.find((r) => r.error)?.error ?? null;
  return { error };
}

