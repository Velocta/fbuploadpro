import {
  completeHandledPublishFailure,
  completeUnhandledPublishFailure,
  countRecentIntegrityIncidents,
  emitIntegrityAlert,
  failPublishForInactivePage,
  failPublishForInvalidToken,
  failPublishForMissingMedia,
  failPublishForPageNotAccessible,
  failPublishForRateLimited,
  failPublishForSecurity368,
  failPublishForVerificationRequired,
  finalizePosted,
  getSupabaseClient,
  incrementPublishRetry,
  incrementTransientPublishRetry,
  loadPublishJob,
  markPublishFailedForFacebookRobots,
  pauseIntake,
  recordPublishGraphIdWithRetry,
  releasePublishJob,
  supersedeDuplicatePublishJob,
  verifyFinalization,
} from './db/client.js';
import {
  isFacebookInvalidTokenError,
  isFacebookPageNotAccessible,
  isFacebookRobotsTxtBlocked,
  isFacebookSecurity368,
  isFacebookSpamRateLimit368,
  isFacebookTemporarilyBlocked,
  isFacebookVerificationRequired,
  isTransientNetworkError,
  rateLimitUntilIso,
  resolveSecurity368PageStatus,
  parseFacebookError,
} from './error-classification.js';
import { publishToFacebook, fetchWithTimeout, checkVideoPublishStatus } from './integrations/facebook.js';
import { getR2PresignedUrl } from './integrations/r2-presign.js';

const INTERNAL_JOB_PATH = '/internal/v2/process-job';

const DEFAULT_POSTING_MEDIA_PUBLIC_BASE_URL = 'https://vinsmokemedia.online';

function v2Log(event, fields = {}) {
  console.log(JSON.stringify({ service: 'v2-publisher', event, ts: new Date().toISOString(), ...fields }));
}

async function markIntegrityError(supabase, jobId, reason) {
  await supabase
    .from('adu_posting_jobs')
    .update({
      status: 'integrity_error',
      last_error_code: 'integrity_mismatch',
      last_error_message: String(reason || '').slice(0, 500),
      publish_started_at: null,
    })
    .eq('job_id', jobId);
}

async function maybePauseIntake(supabase, threshold, windowSeconds) {
  const { count, error } = await countRecentIntegrityIncidents(supabase, windowSeconds);
  if (error) {
    v2Log('count_recent_integrity_incidents_error', { message: error.message });
    return;
  }
  if (count < threshold) return;
  await pauseIntake(supabase);
}

async function deleteR2Object(env, jobId, mediaObjectKey) {
  if (!mediaObjectKey) return;
  try {
    await env.POSTING_MEDIA_BUCKET.delete(mediaObjectKey);
    v2Log('publish_job_r2_deleted', { job_id: jobId, media_object_key: mediaObjectKey });
  } catch (deleteErr) {
    v2Log('publish_job_r2_delete_error', {
      job_id: jobId,
      media_object_key: mediaObjectKey,
      message: String(deleteErr?.message || deleteErr),
    });
    const supabase = getSupabaseClient(env);
    try {
      await supabase.from('failed_r2_deletions').insert({
        bucket_name: 'fbuploadpro-adu-buffer',
        object_key: mediaObjectKey,
        last_error: String(deleteErr?.message || deleteErr).slice(0, 1000),
      });
    } catch (dbErr) {
      v2Log('failed_r2_deletion_db_record_error', {
        job_id: jobId,
        message: String(dbErr?.message || dbErr),
      });
    }
  }
}

async function tryRepairIntegrityAfterFinalize(supabase, job, graphVideoId) {
  const { data: reel } = await supabase
    .from('reels')
    .select('status')
    .eq('id', job.reel_internal_id)
    .maybeSingle();

  if (reel?.status === 'posted') {
    await supersedeDuplicatePublishJob(supabase, job.job_id, graphVideoId || job.graph_post_id);
    return true;
  }

  if (job.graph_post_id || graphVideoId) {
    const { error: retryFinalizeError } = await finalizePosted(
      supabase,
      job.job_id,
      graphVideoId || job.graph_post_id
    );
    if (!retryFinalizeError) {
      const verification = await verifyFinalization(supabase, job.job_id);
      return verification.ok;
    }
  }

  return false;
}

async function finalizeAndVerify(env, supabase, job, graphVideoId, anomalyPauseThreshold, anomalyWindowSeconds) {
  const jobId = job.job_id ?? null;
  const mediaObjectKey = String(job.media_object_key || '');

  const { data: finalizeResult, error: finalizeError } = await finalizePosted(
    supabase,
    job.job_id,
    graphVideoId
  );
  if (finalizeError) {
    v2Log('publish_job_error', {
      job_id: jobId,
      phase: 'finalize_rpc',
      code: 'finalize_rpc_failed',
      message: finalizeError.message,
    });

    const repaired = await tryRepairIntegrityAfterFinalize(supabase, job, graphVideoId);
    if (repaired) {
      v2Log('publish_job_finalize_repaired', { job_id: jobId });
      await deleteR2Object(env, jobId, mediaObjectKey);
      return;
    }

    await releasePublishJob(supabase, job.job_id, 'finalize_rpc_failed', finalizeError.message);
    throw new Error(`finalize_rpc_failed ${finalizeError.message}`);
  }
  v2Log('publish_job_finalize_rpc_ok', { job_id: jobId, finalize_result: finalizeResult ?? null });

  const verification = await verifyFinalization(supabase, job.job_id);
  if (!verification.ok) {
    const repaired = await tryRepairIntegrityAfterFinalize(supabase, job, graphVideoId);
    if (repaired) {
      v2Log('publish_job_integrity_auto_repaired', { job_id: jobId, reason: verification.reason });
      await deleteR2Object(env, jobId, mediaObjectKey);
      return;
    }

    v2Log('publish_job_integrity_mismatch', { job_id: jobId, reason: verification.reason });
    await markIntegrityError(supabase, job.job_id, verification.reason);
    await emitIntegrityAlert(supabase, 'integrity_mismatch_after_finalize_success', {
      job_id: job.job_id,
      reel_internal_id: job.reel_internal_id ?? null,
      reason: verification.reason,
    });
    await maybePauseIntake(supabase, anomalyPauseThreshold, anomalyWindowSeconds);
    console.error('[v2-publisher] integrity incident:', job.job_id, verification.reason, finalizeResult);

    const { data: reel } = await supabase
      .from('reels')
      .select('status')
      .eq('id', job.reel_internal_id)
      .maybeSingle();
    if (reel?.status === 'posted') {
      await deleteR2Object(env, jobId, mediaObjectKey);
    }
    return;
  }

  v2Log('publish_job_ok', { job_id: jobId });
  await deleteR2Object(env, jobId, mediaObjectKey);
}

function internalTokenOk(env, request) {
  const expected = env.INTERNAL_JOB_DISPATCH_TOKEN || '';
  const got = request.headers.get('x-internal-job-dispatch-token') || '';
  if (!expected || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  }
  return diff === 0;
}

async function processPublishJob(env, job) {
  const supabase = getSupabaseClient(env);
  const anomalyPauseThreshold = Number.parseInt(env.INTEGRITY_PAUSE_THRESHOLD || '3', 10);
  const anomalyWindowSeconds = Number.parseInt(env.INTEGRITY_WINDOW_SECONDS || '300', 10);
  const jobId = job.job_id ?? null;

  const { data: dbJob, error: jobLoadError } = await loadPublishJob(supabase, jobId);
  if (jobLoadError || !dbJob) {
    v2Log('publish_job_error', {
      job_id: jobId,
      phase: 'load_job',
      code: 'job_not_found',
      message: jobLoadError?.message ?? 'missing_row',
    });
    throw new Error('job_not_found');
  }
  job = { ...job, ...dbJob };

  if (dbJob.status === 'published') {
    v2Log('publish_job_already_published', { job_id: jobId });
    return;
  }

  const existingGraphId = String(job.graph_post_id || '').trim();

  if (existingGraphId) {
    v2Log('publish_job_check_existing_status', { job_id: jobId, graph_post_id: existingGraphId });
    const fbStatus = await checkVideoPublishStatus(existingGraphId, job.fb_page_access_token);
    const videoStatus = String(fbStatus?.video_status || '').toLowerCase();
    const pubPhaseStatus = String(fbStatus?.publishing_phase?.status || '').toLowerCase();

    if (fbStatus && (videoStatus === 'ready' || pubPhaseStatus === 'complete')) {
      v2Log('publish_job_finalize_retry', {
        job_id: jobId,
        graph_post_id: existingGraphId,
        video_status: videoStatus,
        publishing_phase_status: pubPhaseStatus,
      });
      await finalizeAndVerify(
        env,
        supabase,
        job,
        existingGraphId,
        anomalyPauseThreshold,
        anomalyWindowSeconds
      );
      return;
    }

    v2Log('publish_job_resume_unfinished', {
      job_id: jobId,
      graph_post_id: existingGraphId,
      video_status: videoStatus || null,
      pub_phase_status: pubPhaseStatus || null,
    });
  }

  const mediaObjectKey = String(job.media_object_key || '');
  const caption = String(job.reel_caption || '').trim() || '...';
  if (!mediaObjectKey && !existingGraphId) {
    v2Log('publish_job_error', { job_id: jobId, phase: 'validate', code: 'missing_media_object_key' });
    throw new Error('missing_media_object_key');
  }

  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('status')
    .eq('id', job.page_id)
    .maybeSingle();
  if (pageError || page?.status !== 'active') {
    v2Log('publish_job_error', {
      job_id: jobId,
      phase: 'validate',
      code: 'page_not_active',
      page_status: page?.status ?? null,
    });
    throw new Error('page_not_active');
  }


  const r2AccountId = String(env.R2_ACCOUNT_ID || '').trim();
  const r2AccessKeyId = String(env.R2_ACCESS_KEY_ID || '').trim();
  const r2SecretAccessKey = String(env.R2_SECRET_ACCESS_KEY || '').trim();

  v2Log('publish_job_begin', {
    job_id: jobId,
    reel_internal_id: job.reel_internal_id ?? null,
    page_id: job.page_id ?? null,
    fb_page_id: job.fb_page_id ?? null,
    platform: job.platform ?? null,
    upload_mode: 'hosted_presigned',
  });

  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
    v2Log('publish_job_error', {
      job_id: jobId,
      phase: 'hosted_presign',
      code: 'missing_r2_credentials',
      message: 'R2 S3 credentials are not configured in environment variables or secrets.'
    });
    throw new Error('missing_r2_credentials');
  }

  let hostedFileUrl = null;
  try {
    hostedFileUrl = await getR2PresignedUrl({
      accountId: r2AccountId,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      bucketName: 'fbuploadpro-adu-buffer',
      objectKey: mediaObjectKey,
      expiresInSeconds: 3600
    });
  } catch (presignError) {
    v2Log('publish_job_error', {
      job_id: jobId,
      phase: 'hosted_presign',
      code: 'presign_failed',
      message: String(presignError?.message || presignError)
    });
    throw new Error(`presign_failed ${presignError?.message || presignError}`);
  }

  const head = await env.POSTING_MEDIA_BUCKET.head(mediaObjectKey);
  if (!head) {
    v2Log('publish_job_error', { job_id: jobId, phase: 'r2_head', code: 'media_object_missing' });
    throw new Error('media_object_missing');
  }

  const graphVideoId = await publishToFacebook(
    job.fb_page_id,
    job.fb_page_access_token,
    hostedFileUrl,
    6,
    caption,
    { job_id: jobId },
    supabase,
    jobId,
    existingGraphId || null
  );
  v2Log('publish_job_facebook_ok', { job_id: jobId, graph_video_id: graphVideoId ?? null });

  const { error: recordError } = await recordPublishGraphIdWithRetry(supabase, job.job_id, graphVideoId);
  if (recordError) {
    v2Log('publish_job_record_graph_id_failed', {
      job_id: jobId,
      message: recordError.message,
    });
    const { data: reloaded } = await loadPublishJob(supabase, job.job_id);
    if (reloaded?.graph_post_id) {
      job = { ...job, ...reloaded };
    } else {
      throw new Error(`record_graph_id_failed ${recordError.message}`);
    }
  }

  await finalizeAndVerify(
    env,
    supabase,
    job,
    graphVideoId,
    anomalyPauseThreshold,
    anomalyWindowSeconds
  );
}

async function handlePublishError(env, supabase, job, errMsg) {
  const code = errMsg.split(' ')[0];
  const cleanErrMsg = parseFacebookError(errMsg);

  if (isFacebookVerificationRequired(errMsg)) {
    await failPublishForVerificationRequired(supabase, job.job_id, job.page_id, job.reel_internal_id);
    return { terminal: true };
  }

  if (isFacebookInvalidTokenError(errMsg)) {
    await failPublishForInvalidToken(supabase, job.job_id, job.page_id, job.reel_internal_id);
    return { terminal: true };
  }

  if (isFacebookPageNotAccessible(errMsg)) {
    await failPublishForPageNotAccessible(supabase, job.job_id, job.page_id, job.reel_internal_id);
    return { terminal: true };
  }

  if (isFacebookSpamRateLimit368(errMsg) || isFacebookTemporarilyBlocked(errMsg)) {
    await failPublishForRateLimited(
      supabase,
      job.job_id,
      job.page_id,
      job.reel_internal_id,
      rateLimitUntilIso()
    );
    return { terminal: true };
  }

  if (isFacebookSecurity368(errMsg)) {
    const pageStatus = resolveSecurity368PageStatus(errMsg);
    await failPublishForSecurity368(supabase, job.job_id, job.page_id, job.reel_internal_id, pageStatus);
    return { terminal: true };
  }

  if (code === 'media_object_missing' || code === 'missing_media_object_key') {
    await failPublishForMissingMedia(supabase, job.job_id, job.reel_internal_id);
    return { terminal: true };
  }

  if (code === 'page_not_active') {
    await failPublishForInactivePage(supabase, job.job_id, job.reel_internal_id);
    return { terminal: true };
  }

  if (isFacebookRobotsTxtBlocked(errMsg)) {
    await markPublishFailedForFacebookRobots(supabase, job.job_id, job.reel_internal_id, cleanErrMsg);
    return { terminal: true };
  }

  if (code === 'finalize_rpc_failed') {
    return { retry: true };
  }

  if (code === 'record_graph_id_failed' && job.graph_post_id) {
    return { retry: true };
  }

  if (isTransientNetworkError(errMsg)) {
    const { error: retryError, exhausted } = await incrementTransientPublishRetry(
      supabase,
      job.job_id,
      job.reel_internal_id,
      code,
      cleanErrMsg.slice(0, 500)
    );
    if (retryError) {
      v2Log('transient_retry_error', { job_id: job.job_id, message: retryError.message });
    }
    if (exhausted) {
      await completeUnhandledPublishFailure(
        supabase,
        job,
        'publish_transient_retries_exhausted',
        cleanErrMsg
      );
      return { terminal: true };
    }
    return { retry: true };
  }

  const { error: retryError, exhausted } = await incrementPublishRetry(
    supabase,
    job.job_id,
    job.reel_internal_id,
    code,
    cleanErrMsg.slice(0, 500)
  );
  if (retryError) {
    v2Log('increment_publish_retry_error', { job_id: job.job_id, message: retryError.message });
  }
  if (exhausted) {
    await completeUnhandledPublishFailure(supabase, job, 'publish_retries_exhausted', cleanErrMsg);
    return { terminal: true };
  }
  return { retry: true };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === INTERNAL_JOB_PATH) {
      if (!internalTokenOk(env, request)) {
        v2Log('internal_job_forbidden', { reason: 'dispatch_token_mismatch_or_missing' });
        return new Response('forbidden', { status: 403 });
      }
      let job = {};
      try {
        job = await request.json();
      } catch {
        v2Log('internal_job_bad_json', {});
        return new Response('invalid json', { status: 400 });
      }

      v2Log('internal_job_received', {
        job_id: job.job_id ?? null,
        reel_internal_id: job.reel_internal_id ?? null,
        fb_page_id: job.fb_page_id ?? null,
      });

      const supabase = getSupabaseClient(env);

      try {
        await processPublishJob(env, job);
        v2Log('internal_job_response', { job_id: job.job_id ?? null, http_status: 200, ok: true });
        return Response.json({ ok: true, job_id: job.job_id ?? null });
      } catch (error) {
        const errMsg = String(error?.message || 'publish_failed');
        const cleanErrMsg = parseFacebookError(errMsg);

        v2Log('internal_job_error', {
          job_id: job.job_id ?? null,
          error_code: errMsg.split(' ')[0],
          message: cleanErrMsg.slice(0, 500),
        });

        const outcome = await handlePublishError(env, supabase, job, errMsg);

        if (outcome.terminal) {
          return Response.json({ ok: false, terminal: true, job_id: job.job_id ?? null }, { status: 200 });
        }
        if (outcome.retry) {
          return Response.json(
            { ok: false, retry: true, job_id: job.job_id ?? null, error: cleanErrMsg.slice(0, 500) },
            { status: 200 }
          );
        }

        await completeUnhandledPublishFailure(supabase, job, errMsg.split(' ')[0], cleanErrMsg);
        return Response.json({ ok: false, terminal: true, job_id: job.job_id ?? null }, { status: 200 });
      }
    }

    return new Response('Posting V2 Publisher Active', { status: 200 });
  },
};
