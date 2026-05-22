/**
 * Meta Reels Publishing — same flow as official docs:
 * https://developers.facebook.com/docs/video-api/guides/reels-publishing/
 *
 * Upload step supports either:
 * - hosted: `file_url` on rupload (Meta fetches your URL; needs robots/WAF friendly origin)
 * - stream: binary body streamed from R2 → `upload_url` (no public URL; no full-file buffer in Worker)
 */
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

/**
 * @param {string} fbPageId
 * @param {string} token
 * @param {{ mode: 'hosted', hostedFileUrl: string } | { mode: 'stream', getObject: () => Promise<import('@cloudflare/workers-types').R2ObjectBody & { size?: number; httpMetadata?: { contentType?: string } } | null> }} mediaSpec
 * @param {number} [maxRetries]
 * @param {string} [caption]
 * @param {object} [logCtx]
 */
export async function publishToFacebook(fbPageId, token, mediaSpec, maxRetries = 6, caption = '...', logCtx = {}) {
  const ctx = { ...logCtx, fb_page_id: fbPageId };
  const mode = mediaSpec && typeof mediaSpec === 'object' ? mediaSpec.mode : null;
  if (mode !== 'hosted' && mode !== 'stream') {
    throw new Error('facebook_publish_invalid_media_spec');
  }

  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    try {
      fbLog(ctx, 'fb_reels_attempt_begin', {
        attempt: attempts,
        max_retries: maxRetries,
        upload_mode: mode,
      });

      const startRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${fbPageId}/video_reels`, {
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

      const uploadUrl =
        startData.upload_url ||
        `https://rupload.facebook.com/video-upload/${META_GRAPH_VERSION}/${startData.video_id}`;

      if (mode === 'hosted') {
        const fileUrl = String(mediaSpec.hostedFileUrl || '').trim();
        if (!fileUrl) {
          throw new Error('facebook_publish_missing_hosted_file_url');
        }
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `OAuth ${token}`,
            file_url: fileUrl,
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
          upload_kind: 'hosted_file_url',
        });
        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(`facebook_hosted_upload_failed status=${uploadRes.status} ${JSON.stringify(uploadData)}`);
        }
      } else {
        const obj = await mediaSpec.getObject();
        if (!obj || !obj.body) {
          throw new Error('facebook_stream_upload_missing_r2_body');
        }
        const fileSize = typeof obj.size === 'number' && obj.size > 0 ? obj.size : null;
        if (!fileSize) {
          throw new Error('facebook_stream_upload_missing_file_size');
        }
        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `OAuth ${token}`,
            offset: '0',
            file_size: String(fileSize),
            'Content-Type': 'application/octet-stream',
          },
          body: obj.body,
        });
        const uploadText = await uploadRes.text();
        let uploadData = {};
        if (uploadText.trim()) {
          try {
            uploadData = JSON.parse(uploadText);
          } catch {
            uploadData = { _raw: uploadText.slice(0, 200) };
          }
        }
        fbLog(ctx, 'fb_reels_rupload_http', {
          attempt: attempts,
          http_status: uploadRes.status,
          ok: uploadRes.ok,
          rupload_success: uploadData.success !== false && uploadRes.ok,
          upload_kind: 'stream_octet_stream',
          file_size: fileSize,
        });
        if (!uploadRes.ok) {
          throw new Error(`facebook_binary_upload_failed status=${uploadRes.status} ${uploadText.slice(0, 300)}`);
        }
        if (uploadData && Object.prototype.hasOwnProperty.call(uploadData, 'success') && uploadData.success !== true) {
          throw new Error(`facebook_binary_upload_failed ${JSON.stringify(uploadData)}`);
        }
      }

      const finishParams = new URLSearchParams({
        access_token: token,
        video_id: startData.video_id,
        upload_phase: 'finish',
        video_state: 'PUBLISHED',
        description: caption || '...',
      });
      const finishUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${fbPageId}/video_reels?${finishParams.toString()}`;
      const finishRes = await fetch(finishUrl, { method: 'POST' });
      const finishData = await finishRes.json();
      fbLog(ctx, 'fb_reels_finish_http', {
        attempt: attempts,
        http_status: finishRes.status,
        ok: finishRes.ok,
        finish_success: Boolean(finishData.success),
        graph_error: finishData.error ? String(finishData.error.message || '').slice(0, 200) : null,
      });
      if (!finishRes.ok || !finishData.success) {
        throw new Error(`facebook_finish_failed ${JSON.stringify(finishData)}`);
      }
      fbLog(ctx, 'fb_reels_publish_ok', { attempt: attempts, upload_mode: mode });
      return;
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
      if (mode === 'hosted' && isFacebookRobotsOrFileUrlFetchBlocked(message)) throw error;
      if (authTerminal || verificationTerminal) throw error;
      if (attempts >= maxRetries) {
        throw new Error(`facebook_publish_retries_exhausted ${message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, attempts * 3000));
    }
  }
}
