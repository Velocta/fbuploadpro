import {
  completeUnhandledPublishFailure,
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
  recordPublishGraphIdWithRetry,
  releasePublishJob,
  supersedeDuplicatePublishJob,
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
import {
  publishToFacebook,
  publishTextPost,
  publishImagePost,
  postFirstComment,
  checkVideoPublishStatus,
} from './integrations/facebook.js';
import { getR2PresignedUrl } from './integrations/r2-presign.js';

const INTERNAL_JOB_PATH = '/internal/v2/process-job';

function v2Log(event, fields = {}) {
  console.log(JSON.stringify({ service: 'fb-inapp-publisher', event, ts: new Date().toISOString(), ...fields }));
}

async function deleteR2Object(env, jobId, mediaObjectKey) {
  if (!mediaObjectKey) return;
  try {
    await env.USER_MEDIA.delete(mediaObjectKey);
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
        bucket_name: 'fbuploadpro-user-media',
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

async function finalizeAndVerify(env, supabase, job, graphPostId) {
  const postId = job.post_id ?? null;
  const jobId = job.job_id ?? null;
  const mediaObjectKey = String(job.media_object_key || '');

  const { error: finalizeError } = await finalizePosted(supabase, jobId, postId, graphPostId);
  if (finalizeError) {
    v2Log('publish_job_error', {
      job_id: jobId,
      phase: 'finalize',
      code: 'finalize_failed',
      message: finalizeError.message,
    });
    await releasePublishJob(supabase, jobId, postId, 'finalize_failed', finalizeError.message);
    throw new Error(`finalize_failed ${finalizeError.message}`);
  }

  if (job.first_comment) {
    try {
      await postFirstComment({
        graphPostId,
        token: job.fb_page_access_token,
        message: job.first_comment,
        logCtx: { job_id: jobId }
      });
      v2Log('publish_job_comment_ok', { job_id: jobId });
    } catch (commentErr) {
      v2Log('publish_job_comment_error', {
        job_id: jobId,
        message: String(commentErr?.message || commentErr),
      });
    }
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

async function getPresignedUrlOrThrow(env, mediaObjectKey, jobId) {
  const r2AccountId = String(env.R2_ACCOUNT_ID || '').trim();
  const r2AccessKeyId = String(env.R2_ACCESS_KEY_ID || '').trim();
  const r2SecretAccessKey = String(env.R2_SECRET_ACCESS_KEY || '').trim();

  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
    v2Log('publish_job_error', {
      job_id: jobId,
      phase: 'hosted_presign',
      code: 'missing_r2_credentials',
      message: 'R2 S3 credentials are not configured in environment variables or secrets.'
    });
    throw new Error('missing_r2_credentials');
  }

  if (!mediaObjectKey) {
    throw new Error('missing_media_object_key');
  }

  const head = await env.USER_MEDIA.head(mediaObjectKey);
  if (!head) {
    v2Log('publish_job_error', { job_id: jobId, phase: 'r2_head', code: 'media_object_missing' });
    throw new Error('media_object_missing');
  }

  try {
    return await getR2PresignedUrl({
      accountId: r2AccountId,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      bucketName: 'fbuploadpro-user-media',
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
}

async function processPublishJob(env, job) {
  const supabase = getSupabaseClient(env);
  const jobId = job.job_id ?? null;
  const postId = job.post_id ?? null;

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

  if (existingGraphId && job.media_type === 'video') {
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
      await finalizeAndVerify(env, supabase, job, existingGraphId);
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
  const caption = String(job.caption || '').trim();

  const { data: page, error: pageError } = await supabase
    .from('facebook_inapp_schedule_pages')
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

  v2Log('publish_job_begin', {
    job_id: jobId,
    page_id: job.page_id ?? null,
    fb_page_id: job.fb_page_id ?? null,
    media_type: job.media_type,
  });

  let graphPostId = null;

  if (job.media_type === 'text') {
    graphPostId = await publishTextPost(job.fb_page_id, job.fb_page_access_token, caption, { job_id: jobId });
  } else if (job.media_type === 'image') {
    const hostedFileUrl = await getPresignedUrlOrThrow(env, mediaObjectKey, jobId);
    graphPostId = await publishImagePost(job.fb_page_id, job.fb_page_access_token, hostedFileUrl, caption, { job_id: jobId });
  } else if (job.media_type === 'video') {
    const hostedFileUrl = await getPresignedUrlOrThrow(env, mediaObjectKey, jobId);
    graphPostId = await publishToFacebook(
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
  } else {
    throw new Error(`unsupported_media_type ${job.media_type}`);
  }

  v2Log('publish_job_facebook_ok', { job_id: jobId, graph_post_id: graphPostId ?? null });

  const { error: recordError } = await recordPublishGraphIdWithRetry(supabase, jobId, postId, graphPostId);
  if (recordError) {
    v2Log('publish_job_record_graph_id_failed', {
      job_id: jobId,
      message: recordError.message,
    });
    const { data: reloaded } = await loadPublishJob(supabase, jobId);
    if (reloaded?.graph_post_id) {
      job = { ...job, ...reloaded };
    } else {
      throw new Error(`record_graph_id_failed ${recordError.message}`);
    }
  }

  await finalizeAndVerify(env, supabase, job, graphPostId);
}

async function handlePublishError(env, supabase, job, errMsg) {
  const code = errMsg.split(' ')[0];
  const cleanErrMsg = parseFacebookError(errMsg);
  const jobId = job.job_id ?? null;
  const postId = job.post_id ?? null;

  if (isFacebookVerificationRequired(errMsg)) {
    await failPublishForVerificationRequired(supabase, jobId, job.page_id, job);
    return { terminal: true };
  }

  if (isFacebookInvalidTokenError(errMsg)) {
    await failPublishForInvalidToken(supabase, jobId, job.page_id, job);
    return { terminal: true };
  }

  if (isFacebookPageNotAccessible(errMsg)) {
    await failPublishForPageNotAccessible(supabase, jobId, job.page_id, job);
    return { terminal: true };
  }

  if (isFacebookSpamRateLimit368(errMsg) || isFacebookTemporarilyBlocked(errMsg)) {
    await failPublishForRateLimited(
      supabase,
      jobId,
      job.page_id,
      job,
      rateLimitUntilIso()
    );
    return { terminal: true };
  }

  if (isFacebookSecurity368(errMsg)) {
    const pageStatus = resolveSecurity368PageStatus(errMsg);
    await failPublishForSecurity368(supabase, jobId, job.page_id, job, pageStatus);
    return { terminal: true };
  }

  if (code === 'media_object_missing' || code === 'missing_media_object_key') {
    await failPublishForMissingMedia(supabase, jobId, job);
    await deleteR2Object(env, jobId, job.media_object_key);
    return { terminal: true };
  }

  if (code === 'page_not_active') {
    await failPublishForInactivePage(supabase, jobId, job);
    return { terminal: true };
  }

  if (isFacebookRobotsTxtBlocked(errMsg)) {
    await markPublishFailedForFacebookRobots(supabase, jobId, job, cleanErrMsg);
    await deleteR2Object(env, jobId, job.media_object_key);
    return { terminal: true };
  }

  if (code === 'finalize_failed') {
    return { retry: true };
  }

  if (code === 'record_graph_id_failed' && job.graph_post_id) {
    return { retry: true };
  }

  if (isTransientNetworkError(errMsg)) {
    const { error: retryError, exhausted } = await incrementTransientPublishRetry(
      supabase,
      jobId,
      job,
      code,
      cleanErrMsg.slice(0, 500)
    );
    if (retryError) {
      v2Log('transient_retry_error', { job_id: jobId, message: retryError.message });
    }
    if (exhausted) {
      await completeUnhandledPublishFailure(
        supabase,
        job,
        'publish_transient_retries_exhausted',
        cleanErrMsg
      );
      await deleteR2Object(env, jobId, job.media_object_key);
      return { terminal: true };
    }
    return { retry: true };
  }

  const { error: retryError, exhausted } = await incrementPublishRetry(
    supabase,
    jobId,
    job,
    code,
    cleanErrMsg.slice(0, 500)
  );
  if (retryError) {
    v2Log('increment_publish_retry_error', { job_id: jobId, message: retryError.message });
  }
  if (exhausted) {
    await completeUnhandledPublishFailure(supabase, job, 'publish_retries_exhausted', cleanErrMsg);
    await deleteR2Object(env, jobId, job.media_object_key);
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

      const jobId = job.job_id ?? null;

      v2Log('internal_job_received', {
        job_id: jobId,
        fb_page_id: job.fb_page_id ?? null,
      });

      const supabase = getSupabaseClient(env);

      try {
        await processPublishJob(env, job);
        v2Log('internal_job_response', { job_id: jobId, http_status: 200, ok: true });
        return Response.json({ ok: true, job_id: jobId });
      } catch (error) {
        const errMsg = String(error?.message || 'publish_failed');
        const cleanErrMsg = parseFacebookError(errMsg);

        v2Log('internal_job_error', {
          job_id: jobId,
          error_code: errMsg.split(' ')[0],
          message: cleanErrMsg.slice(0, 500),
        });

        const outcome = await handlePublishError(env, supabase, job, errMsg);

        if (outcome.terminal) {
          return Response.json({ ok: false, terminal: true, job_id: jobId }, { status: 200 });
        }
        if (outcome.retry) {
          return Response.json(
            { ok: false, retry: true, job_id: jobId, error: cleanErrMsg.slice(0, 500) },
            { status: 200 }
          );
        }

        await completeUnhandledPublishFailure(supabase, job, errMsg.split(' ')[0], cleanErrMsg);
        return Response.json({ ok: false, terminal: true, job_id: jobId }, { status: 200 });
      }
    }

    return new Response('Posting In-App Publisher Active', { status: 200 });
  },
};
