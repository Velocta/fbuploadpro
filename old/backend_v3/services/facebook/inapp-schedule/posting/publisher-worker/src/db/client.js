import { createClient } from '@supabase/supabase-js';

export const MAX_PUBLISH_RETRIES = 5;

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
 * Refund tokens to user's balance and record transaction.
 */
export async function refundPostTokens(supabase, job) {
  if (!job || !job.post_id) {
    return { error: null };
  }
  
  try {
    const { data: post, error: postError } = await supabase
      .from('facebook_inapp_schedule_posts')
      .select('agency_id, tokens_charged')
      .eq('id', job.post_id)
      .single();
      
    if (postError || !post || !post.tokens_charged || post.tokens_charged <= 0) {
      return { error: postError };
    }
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('tokens_balance')
      .eq('id', post.agency_id)
      .single();
      
    if (userError) return { error: userError };
    
    const next = (user?.tokens_balance ?? 0) + post.tokens_charged;
    const { error: updateError } = await supabase
      .from('users')
      .update({ tokens_balance: next })
      .eq('id', post.agency_id);
      
    if (updateError) return { error: updateError };
    
    const { error: txError } = await supabase
      .from('token_transactions')
      .insert({
        user_id: post.agency_id,
        amount: post.tokens_charged,
        type: 'refund',
        metadata: {
          feature: 'inapp_schedule',
          post_id: job.post_id,
          reason: 'publish_failed'
        }
      });
      
    if (txError) return { error: txError };

    // Clear tokens_charged on the post to prevent double refunds
    await supabase
      .from('facebook_inapp_schedule_posts')
      .update({ tokens_charged: 0 })
      .eq('id', job.post_id);
      
    return { error: null };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Handled classified failure: failed status, optional page status.
 */
export async function completeHandledPublishFailure(
  supabase,
  jobId,
  pageId,
  job,
  { pageStatus = null, rateLimitedUntil = null } = {},
) {
  const pageUpdate = {};
  if (pageStatus) pageUpdate.status = pageStatus;
  if (rateLimitedUntil) pageUpdate.rate_limited_until = rateLimitedUntil;

  const isPageLevelError = !!pageStatus;
  const tasks = [];

  if (isPageLevelError) {
    // 1. Mark job as failed (keep error details on job)
    tasks.push(
      supabase
        .from('facebook_inapp_schedule_posting_jobs')
        .update({
          status: 'failed',
          last_error_code: pageStatus,
          last_error_message: job.error_message || 'Page level error, post reset to pending',
          updated_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
    );

    // 2. Reset original post status back to 'pending' (preserves media in R2 for retry)
    tasks.push(
      supabase
        .from('facebook_inapp_schedule_posts')
        .update({
          status: 'pending',
          error_message: job.error_message || `Page error (${pageStatus}). Reset to pending.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.post_id)
    );
  } else {
    // Post/Media specific error (terminal)
    // 1. Mark job as failed
    tasks.push(
      supabase
        .from('facebook_inapp_schedule_posting_jobs')
        .update({
          status: 'failed',
          last_error_code: 'failed',
          last_error_message: job.error_message || 'Handled publish failure',
          updated_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
    );

    // 2. Mark post as failed
    tasks.push(
      supabase
        .from('facebook_inapp_schedule_posts')
        .update({
          status: 'failed',
          error_message: job.error_message || 'Handled publish failure',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.post_id)
    );

    // 3. Refund tokens
    tasks.push(refundPostTokens(supabase, job));
  }

  if (pageId && Object.keys(pageUpdate).length > 0) {
    tasks.push(
      supabase
        .from('facebook_inapp_schedule_pages')
        .update(pageUpdate)
        .eq('id', pageId)
    );
  }

  const results = await Promise.all(tasks);
  const error = results.find((r) => r.error)?.error ?? null;
  return { error };
}

/**
 * Unhandled failure: failed + errors table + error_message on post.
 */
export async function completeUnhandledPublishFailure(
  supabase,
  job,
  code,
  message,
  metadata = {},
) {
  const jobId = job?.job_id;
  const postId = job?.post_id;

  const [{ error: jobError }, { error: postError }, { error: refundError }, { error: logError }] = await Promise.all([
    supabase
      .from('facebook_inapp_schedule_posting_jobs')
      .update({
        status: 'failed',
        last_error_code: code,
        last_error_message: `${code || 'error'}: ${String(message || '').slice(0, 500)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId),
    supabase
      .from('facebook_inapp_schedule_posts')
      .update({
        status: 'failed',
        error_message: `${code || 'error'}: ${String(message || '').slice(0, 500)}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId),
    refundPostTokens(supabase, job),
    emitPublishError(supabase, message, {
      service: 'fb-inapp-publisher',
      job_id: jobId ?? null,
      post_id: postId ?? null,
      page_id: job?.page_id ?? null,
      fb_page_id: job?.fb_page_id ?? null,
      error_code: code,
      ...metadata,
    }),
  ]);

  return { error: jobError || postError || refundError || logError || null };
}

/** Mark duplicate job published. */
export async function supersedeDuplicatePublishJob(supabase, jobId, postId, graphPostId = null) {
  const tasks = [
    supabase
      .from('facebook_inapp_schedule_posting_jobs')
      .update({
        status: 'published',
        last_error_code: null,
        last_error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId),
    supabase
      .from('facebook_inapp_schedule_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        graph_post_id: graphPostId,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
  ];
  const results = await Promise.all(tasks);
  return { error: results.find((r) => r.error)?.error ?? null };
}

export async function incrementPublishRetry(supabase, jobId, job, code, message) {
  const { data: current, error: fetchError } = await supabase
    .from('facebook_inapp_schedule_posting_jobs')
    .select('retry_count')
    .eq('job_id', jobId)
    .single();

  if (fetchError) return { error: fetchError, data: null, exhausted: false };

  const nextRetries = Number(current?.retry_count || 0) + 1;
  const exhausted = nextRetries > MAX_PUBLISH_RETRIES;
  if (exhausted) {
    return { error: null, data: null, exhausted: true };
  }

  // 1. Reset post status back to pending
  const { error: postErr } = await supabase
    .from('facebook_inapp_schedule_posts')
    .update({
      status: 'pending',
      error_message: `${code || 'error'}: ${String(message || '').slice(0, 500)}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.post_id);

  if (postErr) return { error: postErr, data: null, exhausted: false };

  // 2. Reset job status back to pending_publish
  const { error: jobErr, data } = await supabase
    .from('facebook_inapp_schedule_posting_jobs')
    .update({
      status: 'pending_publish',
      retry_count: nextRetries,
      last_error_code: code,
      last_error_message: `${code || 'error'}: ${String(message || '').slice(0, 500)}`,
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId)
    .eq('status', 'publishing')
    .select('job_id')
    .maybeSingle();

  return { error: jobErr, data, exhausted: false };
}

export async function incrementTransientPublishRetry(supabase, jobId, job, code, message) {
  const { data: current, error: fetchError } = await supabase
    .from('facebook_inapp_schedule_posting_jobs')
    .select('retry_count')
    .eq('job_id', jobId)
    .single();

  if (fetchError) return { error: fetchError, data: null, exhausted: false };

  const nextRetries = Number(current?.retry_count || 0) + 1;
  const exhausted = nextRetries > MAX_PUBLISH_RETRIES;
  if (exhausted) {
    return { error: null, data: null, exhausted: true };
  }

  const backoffTime = transientBackoffIso(nextRetries);

  // 1. Reset post status back to pending
  const { error: postErr } = await supabase
    .from('facebook_inapp_schedule_posts')
    .update({
      status: 'pending',
      error_message: `${code || 'transient_error'}: ${String(message || '').slice(0, 500)}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.post_id);

  if (postErr) return { error: postErr, data: null, exhausted: false };

  // 2. Reset job status to pending_publish and set backoff time
  const { error: jobErr, data } = await supabase
    .from('facebook_inapp_schedule_posting_jobs')
    .update({
      status: 'pending_publish',
      retry_count: nextRetries,
      last_error_code: code,
      last_error_message: `${code || 'transient_error'}: ${String(message || '').slice(0, 500)}`,
      schedule_slot_at: backoffTime,
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId)
    .eq('status', 'publishing')
    .select('job_id')
    .maybeSingle();

  return { error: jobErr, data, exhausted: false };
}

export async function finalizePosted(supabase, jobId, postId, graphPostId = null) {
  const tasks = [
    supabase
      .from('facebook_inapp_schedule_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        graph_post_id: graphPostId,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId),
    supabase
      .from('facebook_inapp_schedule_posting_jobs')
      .update({
        status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId)
  ];
  const results = await Promise.all(tasks);
  return { error: results.find((r) => r.error)?.error ?? null };
}

export async function recordPublishGraphId(supabase, jobId, postId, graphPostId) {
  const tasks = [
    supabase
      .from('facebook_inapp_schedule_posts')
      .update({
        graph_post_id: graphPostId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId),
    supabase
      .from('facebook_inapp_schedule_posting_jobs')
      .update({
        graph_post_id: graphPostId,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId)
  ];
  const results = await Promise.all(tasks);
  return { error: results.find((r) => r.error)?.error ?? null };
}

export async function recordPublishGraphIdWithRetry(supabase, jobId, postId, graphPostId, attempts = 3) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    const { error } = await recordPublishGraphId(supabase, jobId, postId, graphPostId);
    if (!error) return { error: null };
    lastError = error;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  return { error: lastError };
}

export async function loadPublishJob(supabase, jobId) {
  return supabase
    .from('facebook_inapp_schedule_posting_jobs')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();
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
  return { error: results.find((r) => r.error)?.error ?? null };
}

export async function emitPublishError(supabase, message, metadata = {}) {
  return supabase.from('errors').insert({
    error_message: String(message).slice(0, 500),
    error_phase: 'inapp_posting_publish',
    metadata,
  });
}

export async function failPublishForVerificationRequired(supabase, jobId, pageId, post) {
  return completeHandledPublishFailure(supabase, jobId, pageId, post, {
    pageStatus: 'fb_verification_required',
  });
}

export async function failPublishForMissingMedia(supabase, jobId, post) {
  return completeHandledPublishFailure(supabase, jobId, null, post);
}

export async function failPublishForInactivePage(supabase, jobId, post) {
  return completeHandledPublishFailure(supabase, jobId, null, post);
}

export async function failPublishForInvalidToken(supabase, jobId, pageId, post) {
  return completeHandledPublishFailure(supabase, jobId, pageId, post, {
    pageStatus: 'invalid_token',
  });
}

export async function failPublishForPageNotAccessible(supabase, jobId, pageId, post) {
  return completeHandledPublishFailure(supabase, jobId, pageId, post, {
    pageStatus: 'page_not_accessible',
  });
}

export async function failPublishForRateLimited(supabase, jobId, pageId, post, rateLimitedUntil) {
  return completeHandledPublishFailure(supabase, jobId, pageId, post, {
    pageStatus: 'fb_rate_limited',
    rateLimitedUntil,
  });
}

export async function failPublishForSecurity368(supabase, jobId, pageId, post, pageStatus) {
  return completeHandledPublishFailure(supabase, jobId, pageId, post, { pageStatus });
}

export async function markPublishFailedForFacebookRobots(supabase, jobId, post, message) {
  return completeUnhandledPublishFailure(supabase, post, 'facebook_file_url_robots', message);
}
