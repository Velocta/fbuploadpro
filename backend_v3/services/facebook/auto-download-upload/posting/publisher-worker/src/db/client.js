import { createClient } from '@supabase/supabase-js';

/** Must match claim_publish_jobs_adu filter (publish_retries <= 5). */
export const MAX_PUBLISH_RETRIES = 5;

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function incrementPublishRetry(supabase, jobId, code, message) {
  const { data: current, error: fetchError } = await supabase
    .from('adu_posting_jobs')
    .select('publish_retries')
    .eq('job_id', jobId)
    .single();

  if (fetchError) return { error: fetchError, data: null, exhausted: false };

  const nextRetries = Number(current?.publish_retries || 0) + 1;
  const exhausted = nextRetries > MAX_PUBLISH_RETRIES;

  const { error, data } = await supabase
    .from('adu_posting_jobs')
    .update({
      status: exhausted ? 'failed_to_publish' : 'pending_publish',
      publish_started_at: null,
      publish_retries: nextRetries,
      last_error_code: exhausted ? 'publish_retries_exhausted' : (code ?? null),
      last_error_message: exhausted
        ? String(message || 'Maximum publish retries exceeded').slice(0, 500)
        : (message ?? null),
    })
    .eq('job_id', jobId)
    .eq('status', 'publishing')
    .select('job_id')
    .maybeSingle();

  return { error, data, exhausted };
}

export async function finalizePosted(supabase, jobId, graphPostId = null) {
  return supabase.rpc('finalize_posting_job_adu', {
    p_job_id: jobId,
    p_graph_post_id: graphPostId,
  });
}

export async function verifyFinalization(supabase, jobId) {
  const { data: job, error: jobError } = await supabase
    .from('adu_posting_jobs')
    .select('job_id, reel_internal_id, status')
    .eq('job_id', jobId)
    .single();
  if (jobError) return { ok: false, reason: `job_lookup_failed ${jobError.message}` };
  if (!job?.reel_internal_id) return { ok: false, reason: 'job_missing_reel_internal_id' };

  const [{ data: reel, error: reelError }, { data: txRows, error: txError }] = await Promise.all([
    supabase.from('reels').select('status').eq('id', job.reel_internal_id).single(),
    supabase
      .from('token_transactions')
      .select('id', { count: 'exact' })
      .eq('reel_id', job.reel_internal_id)
      .eq('type', 'usage'),
  ]);

  if (reelError) return { ok: false, reason: `reel_lookup_failed ${reelError.message}` };
  if (txError) return { ok: false, reason: `usage_lookup_failed ${txError.message}` };

  const usageCount = txRows?.length ?? 0;
  const ok = job.status === 'published' && reel?.status === 'posted' && usageCount === 1;
  if (!ok) {
    return {
      ok: false,
      reason: `integrity_mismatch job=${job.status} reel=${reel?.status} usage_count=${usageCount}`,
    };
  }
  return { ok: true };
}

export async function countRecentIntegrityIncidents(supabase, windowSeconds = 300) {
  const thresholdIso = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await supabase
    .from('adu_posting_jobs')
    .select('job_id', { count: 'exact', head: true })
    .eq('status', 'integrity_error')
    .gte('updated_at', thresholdIso);
  return { count: count ?? 0, error };
}

export async function pauseIntake(supabase) {
  return supabase.from('system_settings').update({ posting_v2_intake_paused: true }).eq('id', 1);
}

export async function emitIntegrityAlert(supabase, message, metadata = {}) {
  return supabase.from('errors').insert({
    error_message: String(message).slice(0, 500),
    error_phase: 'posting_v2_integrity',
    metadata,
  });
}

export async function emitPublishError(supabase, message, metadata = {}) {
  return supabase.from('errors').insert({
    error_message: String(message).slice(0, 500),
    error_phase: 'posting_v2_publish',
    metadata,
  });
}

export async function failPublishForVerificationRequired(supabase, jobId, pageId, message) {
  const [{ error: jobError }, { error: pageError }] = await Promise.all([
    supabase
      .from('adu_posting_jobs')
      .update({
        status: 'failed_to_publish',
        publish_started_at: null,
        last_error_code: 'facebook_verification_required',
        last_error_message: String(message || '').slice(0, 500),
      })
      .eq('job_id', jobId)
      .eq('status', 'publishing'),
    pageId
      ? supabase
          .from('pages')
          .update({ status: 'fb_verification_required' })
          .eq('id', pageId)
      : Promise.resolve({ error: null }),
  ]);
  return { error: jobError || pageError || null };
}

export async function markPublishFailedForFacebookRobots(supabase, jobId, message) {
  return supabase
    .from('adu_posting_jobs')
    .update({
      status: 'failed_to_publish',
      publish_started_at: null,
      last_error_code: 'facebook_file_url_robots',
      last_error_message: String(message || '').slice(0, 500),
    })
    .eq('job_id', jobId)
    .eq('status', 'publishing');
}

/** Meta Graph OAuth 368 / spam throttle ("We limit how often you can post"). Terminal: failed_to_publish. */
export async function markPublishFailedForFacebookRateLimit(supabase, jobId, message) {
  return supabase
    .from('adu_posting_jobs')
    .update({
      status: 'failed_to_publish',
      publish_started_at: null,
      last_error_code: 'facebook_oauth_368',
      last_error_message: String(message || '').slice(0, 500),
    })
    .eq('job_id', jobId)
    .eq('status', 'publishing');
}
