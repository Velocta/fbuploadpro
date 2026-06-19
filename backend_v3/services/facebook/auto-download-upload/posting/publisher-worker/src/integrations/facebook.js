/**
 * Meta Reels Publishing — same flow as official docs:
 * https://developers.facebook.com/docs/video-api/guides/reels-publishing/
 *
 * Upload step supports either:
 * - hosted: `file_url` on rupload (Meta fetches your URL; needs robots/WAF friendly origin)
 * - stream: binary body streamed from R2 → `upload_url` (no public URL; no full-file buffer in Worker)
 */
import { recordPublishGraphId } from '../db/client.js';

const META_GRAPH_VERSION = 'v19.0';

function fbLog(logCtx, event, fields = {}) {
  console.log(
    JSON.stringify({
      service: 'v2-publisher-facebook',
      event,
      job_id: logCtx.job_id ?? null,
      fb_page_id: logCtx.fb_page_id ?? null,
      ts: new Date().toISOString(),
      ...fields,
    })
  );
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`fetch_timeout Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

function isTransientNetworkError(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('network connection lost') ||
    m.includes('connection reset') ||
    m.includes('econnreset') ||
    m.includes('etimedout') ||
    m.includes('fetch failed') ||
    m.includes('socket hang up') ||
    m.includes('network request failed') ||
    m.includes('failed to fetch') ||
    m.includes('connection closed') ||
    m.includes('timed out')
  );
}

/** OAuth 368 / Meta spam throttle — do not retry inside this worker. */
function isFacebookRateLimitMessage(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('we limit how often you can post') ||
    m.includes('"code":368') ||
    m.includes('"code": 368')
  );
}

/** Meta cannot fetch file_url (robots.txt / 403) — retries do not help until origin is fixed. */
function isFacebookRobotsOrFileUrlFetchBlocked(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('robots.txt') ||
    m.includes('restricted by robots') ||
    m.includes('fileurlprocessingerror')
  );
}

/** Retrieve the status of a video reel from the Meta API. */
export async function checkVideoPublishStatus(videoId, token) {
  try {
    const res = await fetchWithTimeout(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${videoId}?fields=status&access_token=${token}`,
      { method: 'GET' },
      15000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.status ?? null;
  } catch (err) {
    console.error('Error checking video status:', err);
    return null;
  }
}

/**
 * @param {string} fbPageId
 * @param {string} token
 * @param {string} hostedFileUrl
 * @param {number} [maxRetries]
 * @param {string} [caption]
 * @param {object} [logCtx]
 * @param {object} [supabase]
 * @param {string} [jobId]
 * @param {string} [existingVideoId]
 */
export async function publishToFacebook(
  fbPageId,
  token,
  hostedFileUrl,
  maxRetries = 6,
  caption = '...',
  logCtx = {},
  supabase = null,
  jobId = null,
  existingVideoId = null
) {
  const ctx = { ...logCtx, fb_page_id: fbPageId };
  if (!hostedFileUrl) {
    throw new Error('facebook_publish_missing_hosted_file_url');
  }

  let videoId = existingVideoId || null;
  let uploadSuccess = false;

  // If we have an existing video ID, verify if its upload is already complete
  if (videoId) {
    fbLog(ctx, 'fb_reels_checking_existing_video', { video_id: videoId });
    const fbStatus = await checkVideoPublishStatus(videoId, token);
    if (fbStatus) {
      const videoStatus = String(fbStatus.video_status || '').toLowerCase();
      const uploadPhaseStatus = String(fbStatus.uploading_phase?.status || '').toLowerCase();
      fbLog(ctx, 'fb_reels_existing_video_status', {
        video_id: videoId,
        video_status: videoStatus,
        upload_phase_status: uploadPhaseStatus,
      });

      if (videoStatus === 'ready' || videoStatus === 'processing' || uploadPhaseStatus === 'complete') {
        uploadSuccess = true;
        fbLog(ctx, 'fb_reels_existing_upload_already_complete', { video_id: videoId });
      }
    } else {
      fbLog(ctx, 'fb_reels_existing_video_invalid_or_missing', { video_id: videoId });
      videoId = null;
    }
  }

  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    try {
      fbLog(ctx, 'fb_reels_attempt_begin', {
        attempt: attempts,
        max_retries: maxRetries,
        upload_mode: 'hosted_presigned',
        has_video_id: Boolean(videoId),
        upload_success: uploadSuccess,
      });

      if (!videoId) {
        const startRes = await fetchWithTimeout(`https://graph.facebook.com/${META_GRAPH_VERSION}/${fbPageId}/video_reels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_phase: 'start',
            access_token: token,
          }),
        });
        const startData = await startRes.json();
        fbLog(ctx, 'fb_reels_start_http', {
          attempt: attempts,
          http_status: startRes.status,
          ok: startRes.ok,
          has_video_id: Boolean(startData.video_id),
          graph_error: startData.error ? String(startData.error.message || '').slice(0, 200) : null,
        });
        if (!startRes.ok || !startData.video_id) {
          throw new Error(`facebook_start_failed ${JSON.stringify(startData)}`);
        }
        videoId = String(startData.video_id);

        if (supabase && jobId) {
          try {
            await recordPublishGraphId(supabase, jobId, videoId);
            fbLog(ctx, 'fb_reels_recorded_graph_id_early', { video_id: videoId });
          } catch (dbErr) {
            fbLog(ctx, 'fb_reels_record_graph_id_early_error', { message: dbErr.message });
          }
        }
      }

      if (!uploadSuccess) {
        const uploadUrl = `https://rupload.facebook.com/video-upload/${META_GRAPH_VERSION}/${videoId}`;
        const uploadRes = await fetchWithTimeout(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `OAuth ${token}`,
            file_url: hostedFileUrl,
          },
        });
        const uploadText = await uploadRes.text();
        let uploadData;
        try {
          uploadData = uploadText ? JSON.parse(uploadText) : {};
        } catch {
          throw new Error(`facebook_hosted_upload_bad_json status=${uploadRes.status} body=${uploadText.slice(0, 200)}`);
        }
        fbLog(ctx, 'fb_reels_rupload_http', {
          attempt: attempts,
          http_status: uploadRes.status,
          ok: uploadRes.ok,
          rupload_success: Boolean(uploadData.success),
          upload_kind: 'hosted_presigned',
        });
        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(`facebook_hosted_upload_failed status=${uploadRes.status} ${JSON.stringify(uploadData)}`);
        }
        uploadSuccess = true;
      }

      const finishParams = new URLSearchParams({
        access_token: token,
        video_id: videoId,
        upload_phase: 'finish',
        video_state: 'PUBLISHED',
        description: caption || '...',
      });
      const finishUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${fbPageId}/video_reels?${finishParams.toString()}`;
      const finishRes = await fetchWithTimeout(finishUrl, { method: 'POST' });
      const finishData = await finishRes.json();
      fbLog(ctx, 'fb_reels_finish_http', {
        attempt: attempts,
        http_status: finishRes.status,
        ok: finishRes.ok,
        finish_success: Boolean(finishData.success),
        graph_error: finishData.error ? String(finishData.error.message || '').slice(0, 200) : null,
      });

      if (!finishRes.ok || !finishData.success) {
        const finishMsg = finishData?.error?.message || '';
        if (
          finishMsg.toLowerCase().includes('already published') ||
          finishMsg.toLowerCase().includes('already posted') ||
          finishMsg.toLowerCase().includes('is duplicate') ||
          (finishData?.error?.code === 1500 && finishMsg.toLowerCase().includes('published'))
        ) {
          fbLog(ctx, 'fb_reels_finish_already_published_warning', {
            attempt: attempts,
            message: finishMsg,
          });
        } else {
          throw new Error(`facebook_finish_failed ${JSON.stringify(finishData)}`);
        }
      }

      fbLog(ctx, 'fb_reels_publish_ok', {
        attempt: attempts,
        upload_mode: 'hosted_presigned',
        video_id: videoId,
      });
      return videoId;
    } catch (error) {
      const message = String(error?.message || '');
      fbLog(ctx, 'fb_reels_attempt_error', {
        attempt: attempts,
        error_code: message.split(' ')[0] || 'unknown',
        message: message.slice(0, 400),
      });

      const authTerminal =
        message.includes('OAuthException') &&
        (message.includes('"code":190') || message.includes('"code": 190'));
      const verificationTerminal = message.toLowerCase().includes('confirm your identity');
      if (isFacebookRateLimitMessage(message)) throw error;
      if (isFacebookRobotsOrFileUrlFetchBlocked(message)) throw error;
      if (authTerminal || verificationTerminal) throw error;

      // Before retrying or failing, check if the video has actually been successfully published on Facebook
      if (videoId && uploadSuccess) {
        fbLog(ctx, 'fb_reels_verifying_status_after_error', {
          video_id: videoId,
          error: message.slice(0, 200),
        });
        const fbStatus = await checkVideoPublishStatus(videoId, token);
        if (fbStatus) {
          const videoStatus = String(fbStatus.video_status || '').toLowerCase();
          const pubPhaseStatus = String(fbStatus.publishing_phase?.status || '').toLowerCase();
          fbLog(ctx, 'fb_reels_verify_status_result', {
            video_id: videoId,
            video_status: videoStatus,
            publishing_phase_status: pubPhaseStatus,
          });
          if (videoStatus === 'ready' || pubPhaseStatus === 'complete') {
            fbLog(ctx, 'fb_reels_publish_recovered', {
              video_id: videoId,
              message: 'Video is already published/ready on Facebook',
            });
            return videoId;
          }
        }
      }

      if (isTransientNetworkError(message)) throw error;

      // If the error was in starting or uploading, we reset the IDs to try fresh
      if (message.startsWith('facebook_start_failed') || message.startsWith('facebook_hosted_upload_failed')) {
        videoId = null;
        uploadSuccess = false;
      }

      if (attempts >= maxRetries) {
        throw new Error(`facebook_publish_retries_exhausted ${message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, attempts * 3000));
    }
  }
}
