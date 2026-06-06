import { createClient } from '@supabase/supabase-js';

/** Must match claim_publish_jobs_adu filter (publish_retries <= 5). */
export const MAX_PUBLISH_RETRIES = 5;

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Release a reel stuck in processing after a terminal publish failure.
 * - redownload: clear buffer metadata and queue for VPS downloader again
 * - default: restore to downloaded when R2 media may still exist
 */
export async function releaseReelAfterTerminalPublishFailure(
  supabase,
  reelInternalId,
  { redownload = false } = {},
) {
  if (!reelInternalId) return { error: null };

  if (redownload) {
    return supabase
      .from('reels')
      .update({
        status: 'pending',
        media_object_key: null,
        media_size_bytes: null,
        media_content_type: null,
        media_sha256: null,
        downloaded_at: null,
        download_claimed_at: null,
      })
      .eq('id', reelInternalId)
      .eq('status', 'processing');
  }

  return supabase
    .from('reels')
    .update({ status: 'downloaded' })
    .eq('id', reelInternalId)
    .eq('status', 'processing');
}

async function markPublishJobTerminal(supabase, jobId, errorCode, message) {
  return supabase
    .from('adu_posting_jobs')
    .update({
      status: 'failed_to_publish',
      publish_started_at: null,
      last_error_code: errorCode,
      last_error_message: String(message || '').slice(0, 500),
    })
    .eq('job_id', jobId)
    .eq('status', 'publishing');
}

export async function incrementPublishRetry(supabase, jobId, reelInternalId, code, message) {
  const { data: current, error: fetchError } = await supabase
    .from('adu_posting_jobs')
    .select('publish_retries')
    .eq('job_id', jobId)
    .single();

  if (fetchError) return { error: fetchError, data: null, exhausted: false };

  const nextRetries = Number(current?.publish_retries || 0) + 1;
  const exhausted = nextRetries > MAX_PUBLISH_RETRIES;
  const errorCode = exhausted ? 'publish_retries_exhausted' : (code ?? null);
  const errorMessage = exhausted
    ? String(message || 'Maximum publish retries exceeded').slice(0, 500)
    : (message ?? null);

  const { error, data } = await supabase
    .from('adu_posting_jobs')
    .update({
      status: exhausted ? 'failed_to_publish' : 'pending_publish',
      publish_started_at: null,
      publish_retries: nextRetries,
      last_error_code: errorCode,
      last_error_message: errorMessage,
    })
    .eq('job_id', jobId)
    .eq('status', 'publishing')
    .select('job_id')
    .maybeSingle();

  if (error) return { error, data, exhausted };

  if (exhausted && reelInternalId) {
    const redownload = code === 'media_object_missing';
    const { error: reelError } = await releaseReelAfterTerminalPublishFailure(supabase, reelInternalId, {
      redownload,
    });
    if (reelError) return { error: reelError, data, exhausted };
  }

  return { error: null, data, exhausted };
}

export async function finalizePosted(supabase, jobId, graphPostId = null) {
  return supabase.rpc('finalize_posting_job_adu', {
    p_job_id: jobId,
    p_graph_post_id: graphPostId,
  });
}

export async function recordPublishGraphId(supabase, jobId, graphPostId) {
  return supabase.rpc('record_adu_publish_graph_id', {
    p_job_id: jobId,
    p_graph_post_id: graphPostId,
  });
}

export async function releasePublishJob(supabase, jobId, errorCode = null, errorMessage = null) {
  return supabase.rpc('release_publish_job_adu', {
    p_job_id: jobId,
    p_error_code: errorCode,
    p_error_message: errorMessage,
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
  const ok =
    job.status === 'published' &&
    reel?.status === 'posted' &&
    (usageCount === 1 || usageCount === 0);
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

export async function failPublishForVerificationRequired(
  supabase,
  jobId,
  pageId,
  reelInternalId,
  message,
) {
  const [{ error: jobError }, { error: pageError }, { error: reelError }] = await Promise.all([
    markPublishJobTerminal(supabase, jobId, 'facebook_verification_required', message),
    pageId
      ? supabase
          .from('pages')
          .update({ status: 'fb_verification_required' })
          .eq('id', pageId)
      : Promise.resolve({ error: null }),
    releaseReelAfterTerminalPublishFailure(supabase, reelInternalId),
  ]);
  return { error: jobError || pageError || reelError || null };
}

/** R2 object missing — terminal immediately; re-queue reel for download (do not retry publish). */
export async function failPublishForMissingMedia(supabase, jobId, reelInternalId, message) {
  const [{ error: jobError }, { error: reelError }] = await Promise.all([
    markPublishJobTerminal(supabase, jobId, 'media_object_missing', message),
    releaseReelAfterTerminalPublishFailure(supabase, reelInternalId, { redownload: true }),
  ]);
  return { error: jobError || reelError || null };
}

export async function failPublishForInactivePage(supabase, jobId, reelInternalId, message) {
  const [{ error: jobError }, { error: reelError }] = await Promise.all([
    markPublishJobTerminal(supabase, jobId, 'page_not_active', message),
    releaseReelAfterTerminalPublishFailure(supabase, reelInternalId),
  ]);
  return { error: jobError || reelError || null };
}

/**
 * OAuth permission/token failure: mark job terminal, page invalid_token.
 * DB trigger cascade_page_invalid_token_to_account marks the linked facebook_accounts
 * row and sibling pages (except completed / fb_verification_required).
 */
export async function failPublishForInvalidToken(supabase, jobId, pageId, reelInternalId, message) {
  const [{ error: jobError }, { error: pageError }, { error: reelError }] = await Promise.all([
    markPublishJobTerminal(supabase, jobId, 'facebook_oauth_190_invalid_token', message),
    pageId
      ? supabase.from('pages').update({ status: 'invalid_token' }).eq('id', pageId)
      : Promise.resolve({ error: null }),
    releaseReelAfterTerminalPublishFailure(supabase, reelInternalId),
  ]);
  return { error: jobError || pageError || reelError || null };
}

export async function markPublishFailedForFacebookRobots(supabase, jobId, reelInternalId, message) {
  const [{ error: jobError }, { error: reelError }] = await Promise.all([
    markPublishJobTerminal(supabase, jobId, 'facebook_file_url_robots', message),
    releaseReelAfterTerminalPublishFailure(supabase, reelInternalId),
  ]);
  return { error: jobError || reelError || null };
}
