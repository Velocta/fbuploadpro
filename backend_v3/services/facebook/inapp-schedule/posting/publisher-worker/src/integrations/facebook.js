/**
 * Meta Publishing integrations: Feed (text), Photos (image), and Video Reels (video).
 */
import { recordPublishGraphId } from '../db/client.js';

const META_GRAPH_VERSION = 'v19.0';

function fbLog(logCtx, event, fields = {}) {
  console.log(
    JSON.stringify({
      service: 'fb-inapp-publisher-facebook',
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

export async function publishTextPost(fbPageId, token, caption, logCtx = {}) {
  const ctx = { ...logCtx, fb_page_id: fbPageId };
  fbLog(ctx, 'fb_text_publish_begin');
  const params = new URLSearchParams({
    access_token: token,
    message: caption || '',
  });
  const res = await fetchWithTimeout(`https://graph.facebook.com/${META_GRAPH_VERSION}/${fbPageId}/feed?${params}`, {
    method: 'POST',
  }, 30000);
  const data = await res.json();
  fbLog(ctx, 'fb_text_publish_http', {
    http_status: res.status,
    ok: res.ok,
    graph_error: data.error ? String(data.error.message || '').slice(0, 200) : null,
  });
  if (!res.ok || !data.id) {
    throw new Error(JSON.stringify(data));
  }
  return String(data.id);
}

export async function publishImagePost(fbPageId, token, hostedFileUrl, caption, logCtx = {}) {
  const ctx = { ...logCtx, fb_page_id: fbPageId };
  fbLog(ctx, 'fb_image_publish_begin');
  const params = new URLSearchParams({
    access_token: token,
    url: hostedFileUrl,
    caption: caption || '',
  });
  const res = await fetchWithTimeout(`https://graph.facebook.com/${META_GRAPH_VERSION}/${fbPageId}/photos?${params}`, {
    method: 'POST',
  }, 45000);
  const data = await res.json();
  fbLog(ctx, 'fb_image_publish_http', {
    http_status: res.status,
    ok: res.ok,
    graph_error: data.error ? String(data.error.message || '').slice(0, 200) : null,
  });
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
  return String(data.post_id || data.id || '');
}

export async function postFirstComment({ graphPostId, token, message, logCtx = {} }) {
  const ctx = { ...logCtx, graph_post_id: graphPostId };
  fbLog(ctx, 'fb_comment_begin');
  const params = new URLSearchParams({ access_token: token, message });
  const res = await fetchWithTimeout(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${graphPostId}/comments?${params}`,
    { method: 'POST' },
    15000
  );
  const data = await res.json();
  fbLog(ctx, 'fb_comment_http', {
    http_status: res.status,
    ok: res.ok,
    graph_error: data.error ? String(data.error.message || '').slice(0, 200) : null,
  });
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }
}

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
      const rateLimitTerminal =
        message.includes('we limit how often you can post') ||
        message.includes('"code":368') ||
        message.includes('"code": 368');
      const robotsTerminal =
        message.includes('robots.txt') ||
        message.includes('restricted by robots') ||
        message.includes('fileurlprocessingerror');

      if (rateLimitTerminal || robotsTerminal || authTerminal || verificationTerminal) throw error;

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

      const isNetErr =
        message.includes('network connection lost') ||
        message.includes('connection reset') ||
        message.includes('econnreset') ||
        message.includes('etimedout') ||
        message.includes('fetch failed') ||
        message.includes('socket hang up') ||
        message.includes('network request failed') ||
        message.includes('failed to fetch') ||
        message.includes('connection closed') ||
        message.includes('timed out');
      if (isNetErr) throw error;

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
