import { createClient } from '@supabase/supabase-js';

/** Must match claim_publish_jobs_adu filter (publish_retries <= 5). */
export const MAX_PUBLISH_RETRIES = 5;

/** Must match claim_publish_jobs_adu filter (publish_transient_retries <= 11). */
export const MAX_TRANSIENT_PUBLISH_RETRIES = 11;

const TRANSIENT_BACKOFF_BASE_MS = 30_000;
const TRANSIENT_BACKOFF_MAX_MS = 15 * 60_000;

let cachedSupabase = null;

export function getSupabaseClient(env) {
  if (!cachedSupabase) {
    cachedSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return cachedSupabase;
}

function transientBackoffIso(retryCount) {
  const exp = Math.min(TRANSIENT_BACKOFF_MAX_MS, TRANSIENT_BACKOFF_BASE_MS * 2 ** Math.max(0, retryCount - 1));
  const jitter = Math.floor(Math.random() * 5_000);
  return new Date(Date.now() + exp + jitter).toISOString();
}

/**
 * Release a reel stuck in publishing after a terminal publish failure.
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
      .eq('status', 'publishing');
  }

  return supabase
    .from('reels')
    .update({ status: 'downloaded' })
    .eq('id', reelInternalId)
    .eq('status', 'publishing');
}

/**
 * Handled classified failure: failed_to_publish, reel downloaded, optional page status.
 * Never writes to public.errors.
 */
export async function completeHandledPublishFailure(
  supabase,
  jobId,
  pageId,
  reelInternalId,
  { pageStatus = null, rateLimitedUntil = null, redownload = false } = {},
) {
  const pageUpdate = {};
  if (pageStatus) pageUpdate.status = pageStatus;
  if (rateLimitedUntil) pageUpdate.rate_limited_until = rateLimitedUntil;

  const tasks = [
    supabase
      .from('adu_posting_jobs')
      .update({
        status: 'failed_to_publish',
        publish_started_at: null,
        last_error_code: null,
        last_error_message: null,
        next_publish_attempt_at: null,
      })
      .eq('job_id', jobId)
      .in('status', ['publishing', 'pending_publish']),
    releaseReelAfterTerminalPublishFailure(supabase, reelInternalId, { redownload }),
  ];

  if (pageId && Object.keys(pageUpdate).length > 0) {
    tasks.push(supabase.from('pages').update(pageUpdate).eq('id', pageId));
  }

  const results = await Promise.all(tasks);
  const error = results.find((r) => r.error)?.error ?? null;
  return { error };
}

/**
 * Unhandled failure: publish_error + errors table + last_error_* on job.
 */
export async function completeUnhandledPublishFailure(
  supabase,
  job,
  code,
  message,
  metadata = {},
) {
  const jobId = job?.job_id;
  const reelInternalId = job?.reel_internal_id;

  const [{ error: jobError }, { error: reelError }, { error: logError }] = await Promise.all([
    supabase
      .from('adu_posting_jobs')
      .update({
        status: 'publish_error',
        publish_started_at: null,
        last_error_code: code,
        last_error_message: String(message || '').slice(0, 500),
      })
      .eq('job_id', jobId)
      .in('status', ['publishing', 'pending_publish']),
    releaseReelAfterTerminalPublishFailure(supabase, reelInternalId),
    emitPublishError(supabase, message, {
      service: 'publisher_worker',
      job_id: jobId ?? null,
      page_id: job?.page_id ?? null,
      reel_internal_id: reelInternalId ?? null,
      fb_page_id: job?.fb_page_id ?? null,
      source_platform: job?.platform ?? null,
      error_code: code,
      ...metadata,
    }),
  ]);

  return { error: jobError || reelError || logError || null };
}

/** Mark duplicate job published when reel is already posted (E1.16). */
export async function supersedeDuplicatePublishJob(supabase, jobId, graphPostId = null) {
  return supabase
    .from('adu_posting_jobs')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      publish_started_at: null,
      graph_post_id: graphPostId,
      last_error_code: null,
      last_error_message: null,
    })
    .eq('job_id', jobId);
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
  if (exhausted) {
    return { error: null, data: null, exhausted: true };
  }

  const { error, data } = await supabase
    .from('adu_posting_jobs')
    .update({
      status: 'pending_publish',
      publish_started_at: null,
      publish_retries: nextRetries,
      last_error_code: null,
      last_error_message: null,
      next_publish_attempt_at: null,
    })
    .eq('job_id', jobId)
    .eq('status', 'publishing')
    .select('job_id')
    .maybeSingle();

  if (error) return { error, data, exhausted: false };

  return { error: null, data, exhausted: false };
}

export async function incrementTransientPublishRetry(supabase, jobId, reelInternalId, code, message) {
  const { data: current, error: fetchError } = await supabase
    .from('adu_posting_jobs')
    .select('publish_transient_retries')
    .eq('job_id', jobId)
    .single();

  if (fetchError) return { error: fetchError, data: null, exhausted: false };

  const nextRetries = Number(current?.publish_transient_retries || 0) + 1;
  const exhausted = nextRetries > MAX_TRANSIENT_PUBLISH_RETRIES;
  if (exhausted) {
    return { error: null, data: null, exhausted: true };
  }

  const { error, data } = await supabase
    .from('adu_posting_jobs')
    .update({
      status: 'pending_publish',
      publish_started_at: null,
      publish_transient_retries: nextRetries,
      last_error_code: null,
      last_error_message: null,
      next_publish_attempt_at: transientBackoffIso(nextRetries),
    })
    .eq('job_id', jobId)
    .eq('status', 'publishing')
    .select('job_id')
    .maybeSingle();

  if (error) return { error, data, exhausted: false };

  if (reelInternalId) {
    const { error: reelError } = await releaseReelAfterTerminalPublishFailure(supabase, reelInternalId);
    if (reelError) return { error: reelError, data, exhausted: false };
  }

  return { error: null, data, exhausted: false };
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

export async function recordPublishGraphIdWithRetry(supabase, jobId, graphPostId, attempts = 3) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    const { error } = await recordPublishGraphId(supabase, jobId, graphPostId);
    if (!error) return { error: null };
    lastError = error;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  return { error: lastError };
}

export async function loadPublishJob(supabase, jobId) {
  return supabase.from('adu_posting_jobs').select('*').eq('job_id', jobId).maybeSingle();
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

export async function failPublishForVerificationRequired(supabase, jobId, pageId, reelInternalId) {
  return completeHandledPublishFailure(supabase, jobId, pageId, reelInternalId, {
    pageStatus: 'fb_verification_required',
  });
}

export async function failPublishForMissingMedia(supabase, jobId, reelInternalId) {
  return completeHandledPublishFailure(supabase, jobId, null, reelInternalId, { redownload: true });
}

export async function failPublishForInactivePage(supabase, jobId, reelInternalId) {
  return completeHandledPublishFailure(supabase, jobId, null, reelInternalId);
}

export async function failPublishForInvalidToken(supabase, jobId, pageId, reelInternalId) {
  return completeHandledPublishFailure(supabase, jobId, pageId, reelInternalId, {
    pageStatus: 'invalid_token',
  });
}

export async function failPublishForPageNotAccessible(supabase, jobId, pageId, reelInternalId) {
  return completeHandledPublishFailure(supabase, jobId, pageId, reelInternalId, {
    pageStatus: 'page_not_accessible',
  });
}

export async function failPublishForRateLimited(supabase, jobId, pageId, reelInternalId, rateLimitedUntil) {
  return completeHandledPublishFailure(supabase, jobId, pageId, reelInternalId, {
    pageStatus: 'fb_rate_limited',
    rateLimitedUntil,
  });
}

export async function failPublishForSecurity368(supabase, jobId, pageId, reelInternalId, pageStatus) {
  return completeHandledPublishFailure(supabase, jobId, pageId, reelInternalId, { pageStatus });
}

export async function markPublishFailedForFacebookRobots(supabase, jobId, reelInternalId, message) {
  return completeUnhandledPublishFailure(supabase, { job_id: jobId, reel_internal_id: reelInternalId }, 'facebook_file_url_robots', message);
}
