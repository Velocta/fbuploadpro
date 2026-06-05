import {
  countRecentIntegrityIncidents,
  emitIntegrityAlert,
  emitPublishError,
  failPublishForInvalidToken,
  failPublishForMissingMedia,
  failPublishForVerificationRequired,
  finalizePosted,
  getSupabaseClient,
  incrementPublishRetry,
  markPublishFailedForFacebookRateLimit,
  markPublishFailedForFacebookRobots,
  pauseIntake,
  verifyFinalization,
} from './db/client.js';
import { publishToFacebook } from './integrations/facebook.js';

const INTERNAL_JOB_PATH = '/internal/v2/process-job';

/** Default public media origin: apex R2 custom domain (https://vinsmokemedia.online). Override with POSTING_MEDIA_PUBLIC_BASE_URL. */
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

function isFacebookPublishRateLimited(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('we limit how often you can post') ||
    m.includes('"code":368') ||
    m.includes('"code": 368')
  );
}

function isFacebookRobotsTxtBlocked(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('robots.txt') ||
    m.includes('restricted by robots') ||
    m.includes('fileurlprocessingerror')
  );
}

/** OAuth 190 / missing page permissions — terminal invalid_token (cascades via DB trigger). */
function isFacebookInvalidTokenError(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('your identity before you can publish')) return false;
  const missingPagePermissions =
    m.includes('pages_read_engagement') ||
    m.includes('pages_manage_metadata') ||
    m.includes('pages_read_user_content') ||
    m.includes('pages_manage_ads') ||
    m.includes('pages_show_list') ||
    m.includes('pages_messaging') ||
    m.includes('must be granted before impersonating');
  if (missingPagePermissions) return true;
  return (
    (m.includes('"code":190') || m.includes('"code": 190')) &&
    (m.includes('oauthexception') || m.includes('error validating access token') || m.includes('session has expired'))
  );
}

/**
 * One job: R2 object → Meta Reels rupload (stream binary or hosted file_url) → finalize RPC + integrity checks.
 * Invoked once per service-binding fetch from publish-processor.
 */
async function processPublishJob(env, job) {
  const supabase = getSupabaseClient(env);
  const anomalyPauseThreshold = Number.parseInt(env.INTEGRITY_PAUSE_THRESHOLD || '3', 10);
  const anomalyWindowSeconds = Number.parseInt(env.INTEGRITY_WINDOW_SECONDS || '300', 10);
  const jobId = job.job_id ?? null;

  const mediaObjectKey = String(job.media_object_key || '');
  const caption = String(job.reel_caption || '').trim() || '...';
  if (!mediaObjectKey) {
    v2Log('publish_job_error', { job_id: jobId, phase: 'validate', code: 'missing_media_object_key' });
    throw new Error('missing_media_object_key');
  }

  const uploadModeRaw = String(env.POSTING_MEDIA_UPLOAD_MODE || 'stream').trim().toLowerCase();
  const uploadMode = uploadModeRaw === 'hosted' ? 'hosted' : 'stream';

  v2Log('publish_job_begin', {
    job_id: jobId,
    reel_internal_id: job.reel_internal_id ?? null,
    page_id: job.page_id ?? null,
    fb_page_id: job.fb_page_id ?? null,
    platform: job.platform ?? null,
    upload_mode: uploadMode,
  });

  let hostedFileUrl = null;
  if (uploadMode === 'hosted') {
    const publicBase =
      String(env.POSTING_MEDIA_PUBLIC_BASE_URL || '').trim() || DEFAULT_POSTING_MEDIA_PUBLIC_BASE_URL;
    const baseWithSlash = publicBase.replace(/\/*$/, '/');
    hostedFileUrl = new URL(encodeURI(mediaObjectKey), baseWithSlash).href;
    v2Log('publish_job_public_url', {
      job_id: jobId,
      upload_mode: uploadMode,
      public_base: publicBase,
      media_object_key: mediaObjectKey,
      hosted_file_url_host: (() => {
        try {
          return new URL(hostedFileUrl).host;
        } catch {
          return 'invalid_url';
        }
      })(),
    });
  } else {
    v2Log('publish_job_upload_mode', { job_id: jobId, upload_mode: uploadMode, media_object_key: mediaObjectKey });
  }

  const head = await env.POSTING_MEDIA_BUCKET.head(mediaObjectKey);
  if (!head) {
    v2Log('publish_job_error', { job_id: jobId, phase: 'r2_head', code: 'media_object_missing' });
    throw new Error('media_object_missing');
  }
  v2Log('publish_job_r2_head_ok', {
    job_id: jobId,
    content_type: head.httpMetadata?.contentType ?? null,
    content_length: head.size ?? null,
  });

  const mediaSpec =
    uploadMode === 'hosted'
      ? { mode: 'hosted', hostedFileUrl }
      : {
          mode: 'stream',
          getObject: () => env.POSTING_MEDIA_BUCKET.get(mediaObjectKey),
        };

  const graphVideoId = await publishToFacebook(job.fb_page_id, job.fb_page_access_token, mediaSpec, 6, caption, {
    job_id: jobId,
  });
  v2Log('publish_job_facebook_ok', { job_id: jobId, graph_video_id: graphVideoId ?? null });

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
    throw new Error(`finalize_rpc_failed ${finalizeError.message}`);
  }
  v2Log('publish_job_finalize_rpc_ok', { job_id: jobId, finalize_result: finalizeResult ?? null });

  const verification = await verifyFinalization(supabase, job.job_id);
  if (!verification.ok) {
    v2Log('publish_job_integrity_mismatch', { job_id: jobId, reason: verification.reason });
    await markIntegrityError(supabase, job.job_id, verification.reason);
    await emitIntegrityAlert(supabase, 'integrity_mismatch_after_finalize_success', {
      job_id: job.job_id,
      reel_internal_id: job.reel_internal_id ?? null,
      reason: verification.reason,
    });
    await maybePauseIntake(supabase, anomalyPauseThreshold, anomalyWindowSeconds);
    console.error('[v2-publisher] integrity incident:', job.job_id, verification.reason, finalizeResult);
  } else {
    v2Log('publish_job_ok', { job_id: jobId });
    try {
      await env.POSTING_MEDIA_BUCKET.delete(mediaObjectKey);
      v2Log('publish_job_r2_deleted', { job_id: jobId, media_object_key: mediaObjectKey });
    } catch (deleteErr) {
      v2Log('publish_job_r2_delete_error', {
        job_id: jobId,
        media_object_key: mediaObjectKey,
        message: String(deleteErr?.message || deleteErr),
      });
    }
  }
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
        const code = errMsg.split(' ')[0];
        const verificationRequired = errMsg.toLowerCase().includes('your identity before you can publish as this page');

        v2Log('internal_job_error', {
          job_id: job.job_id ?? null,
          error_code: code,
          message: errMsg.slice(0, 500),
          verification_required: verificationRequired,
        });

        const isFacebookError =
          errMsg.startsWith('facebook_') ||
          errMsg.includes('OAuthException') ||
          errMsg.includes('fbtrace_id');
        if (isFacebookError && !verificationRequired) {
          const { error: logError } = await emitPublishError(supabase, errMsg, {
            service: 'publisher_worker',
            job_id: job.job_id ?? null,
            page_id: job.page_id ?? null,
            reel_internal_id: job.reel_internal_id ?? null,
            fb_page_id: job.fb_page_id ?? null,
            source_platform: job.platform ?? null,
          });
          if (logError) {
            v2Log('emit_publish_error_failed', { job_id: job.job_id ?? null, message: logError.message });
          }
        }

        if (verificationRequired) {
          const { error: terminalError } = await failPublishForVerificationRequired(
            supabase,
            job.job_id,
            job.page_id,
            job.reel_internal_id,
            errMsg
          );
          if (terminalError) {
            v2Log('fail_verification_required_error', {
              job_id: job.job_id ?? null,
              message: terminalError.message,
            });
          }
          return Response.json({ ok: false, terminal: true, job_id: job.job_id ?? null }, { status: 200 });
        }

        if (isFacebookInvalidTokenError(errMsg)) {
          const { error: tokenError } = await failPublishForInvalidToken(
            supabase,
            job.job_id,
            job.page_id,
            job.reel_internal_id,
            errMsg
          );
          if (tokenError) {
            v2Log('fail_invalid_token_error', {
              job_id: job.job_id ?? null,
              page_id: job.page_id ?? null,
              message: tokenError.message,
            });
          } else {
            v2Log('invalid_token_cascade_ok', {
              job_id: job.job_id ?? null,
              page_id: job.page_id ?? null,
            });
          }
          return Response.json({ ok: false, terminal: true, job_id: job.job_id ?? null }, { status: 200 });
        }

        if (code === 'media_object_missing') {
          const { error: missingError } = await failPublishForMissingMedia(
            supabase,
            job.job_id,
            job.reel_internal_id,
            errMsg
          );
          if (missingError) {
            v2Log('fail_missing_media_error', {
              job_id: job.job_id ?? null,
              reel_internal_id: job.reel_internal_id ?? null,
              message: missingError.message,
            });
          } else {
            v2Log('missing_media_redownload_ok', {
              job_id: job.job_id ?? null,
              reel_internal_id: job.reel_internal_id ?? null,
            });
          }
          return Response.json({ ok: false, terminal: true, job_id: job.job_id ?? null }, { status: 200 });
        }

        if (isFacebookRobotsTxtBlocked(errMsg)) {
          const { error: robotsError } = await markPublishFailedForFacebookRobots(
            supabase,
            job.job_id,
            job.reel_internal_id,
            errMsg
          );
          if (robotsError) {
            v2Log('mark_publish_failed_robots_error', {
              job_id: job.job_id ?? null,
              message: robotsError.message,
            });
          }
          return Response.json({ ok: false, terminal: true, job_id: job.job_id ?? null }, { status: 200 });
        }

        if (isFacebookPublishRateLimited(errMsg)) {
          const { error: limitError } = await markPublishFailedForFacebookRateLimit(
            supabase,
            job.job_id,
            job.reel_internal_id,
            errMsg
          );
          if (limitError) {
            v2Log('mark_publish_failed_rate_limit_error', {
              job_id: job.job_id ?? null,
              message: limitError.message,
            });
          }
          return Response.json({ ok: false, terminal: true, job_id: job.job_id ?? null }, { status: 200 });
        }

        const { error: retryError, exhausted: retriesExhausted } = await incrementPublishRetry(
          supabase,
          job.job_id,
          job.reel_internal_id,
          code,
          errMsg.slice(0, 500)
        );
        if (retryError) {
          v2Log('increment_publish_retry_error', { job_id: job.job_id ?? null, message: retryError.message });
        }
        if (retriesExhausted) {
          v2Log('publish_retries_exhausted', { job_id: job.job_id ?? null });
          return Response.json({ ok: false, terminal: true, job_id: job.job_id ?? null }, { status: 200 });
        }
        v2Log('internal_job_response', { job_id: job.job_id ?? null, http_status: 500, ok: false });
        return Response.json({ ok: false, job_id: job.job_id ?? null, error: errMsg.slice(0, 500) }, { status: 500 });
      }
    }

    return new Response('Posting V2 Publisher Active', { status: 200 });
  },
};
