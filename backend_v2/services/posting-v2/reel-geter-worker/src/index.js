import { getSupabaseClient, markDownloadRetry, markDownloadSuccess } from './db/client.js';

const CONTRACT_VERSION = 'v1';
const TRANSIENT_MAX_ATTEMPTS = 5;
const INTERNAL_JOB_PATH = '/internal/v2/process-job';

function v2Log(event, fields = {}) {
  console.log(JSON.stringify({ service: 'v2-reel-geter', event, ts: new Date().toISOString(), ...fields }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDownloadError(message) {
  const msg = String(message || '');
  return (
    msg.startsWith('TRANSIENT_NETWORK') ||
    msg.startsWith('DOWNLOADER_HTTP_') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  );
}

function validateContract(payload, maxBytes) {
  if (!payload || payload.contract_version !== CONTRACT_VERSION) {
    throw new Error('CONTRACT_INVALID version_mismatch');
  }
  if (!payload.media_object_key || !payload.content_type || !payload.sha256) {
    throw new Error('CONTRACT_INVALID missing_required_fields');
  }
  if (!payload.content_type.startsWith('video/')) {
    throw new Error('CONTRACT_INVALID invalid_content_type');
  }
  if (!Number.isFinite(Number(payload.size_bytes)) || Number(payload.size_bytes) <= 0) {
    throw new Error('CONTRACT_INVALID invalid_size_bytes');
  }
  if (Number(payload.size_bytes) > maxBytes) {
    throw new Error('CONTRACT_INVALID media_too_large');
  }
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

/**
 * One job: download via downloader-service, validate, mark DB (success or retry).
 * Invoked once per service-binding fetch from download-processor (separate Worker instance each time).
 */
async function processDownloadJob(env, job) {
  const jobId = job.job_id ?? null;
  v2Log('download_job_begin', {
    job_id: jobId,
    platform: job.platform ?? null,
    reel_id: job.reel_id ?? null,
  });

  if (!env.DOWNLOADER_SERVICE) {
    v2Log('download_job_error', { job_id: jobId, phase: 'env', code: 'DOWNLOADER_SERVICE_binding_missing' });
    throw new Error('DOWNLOADER_SERVICE binding missing');
  }

  const supabase = getSupabaseClient(env);
  const maxBytes = Number.parseInt(env.DOWNLOAD_MAX_BYTES || '209715200', 10);

  let payload = null;
  let lastTransientError = null;
  for (let attempt = 1; attempt <= TRANSIENT_MAX_ATTEMPTS; attempt++) {
    try {
      v2Log('downloader_service_fetch_begin', { job_id: jobId, attempt });
      const response = await env.DOWNLOADER_SERVICE.fetch('http://internal/download-object', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          platform: job.platform,
          username: job.source_username,
          reel_id: job.reel_id,
          job_id: job.job_id,
        }),
      });

      payload = await response.json();
      v2Log('downloader_service_fetch_http', {
        job_id: jobId,
        attempt,
        http_status: response.status,
        ok: response.ok,
        error_code: payload?.error_code ?? null,
      });
      if (!response.ok) {
        throw new Error(payload?.error_code || payload?.error || `DOWNLOADER_HTTP_${response.status}`);
      }

      validateContract(payload, maxBytes);

      const object = await env.POSTING_MEDIA_BUCKET.head(payload.media_object_key);
      if (!object) {
        v2Log('download_job_error', { job_id: jobId, phase: 'r2_head', code: 'CONTRACT_INVALID_missing_media_object' });
        throw new Error('CONTRACT_INVALID missing_media_object');
      }

      v2Log('downloader_contract_ok', {
        job_id: jobId,
        media_object_key: payload.media_object_key,
        size_bytes: payload.size_bytes,
      });

      lastTransientError = null;
      break;
    } catch (attemptError) {
      const msg = String(attemptError?.message || 'download_failed');
      v2Log('download_attempt_error', { job_id: jobId, attempt, message: msg.slice(0, 400) });
      if (!isTransientDownloadError(msg)) {
        throw attemptError;
      }
      lastTransientError = attemptError;
      if (attempt < TRANSIENT_MAX_ATTEMPTS) {
        await sleep(1000 * 2 ** (attempt - 1));
      }
    }
  }
  if (lastTransientError) {
    throw lastTransientError;
  }

  const { error } = await markDownloadSuccess(supabase, job.job_id, {
    media_object_key: payload.media_object_key,
    media_url: payload.signed_url ?? null,
    media_sha256: payload.sha256,
    media_content_type: payload.content_type,
    media_size_bytes: Number(payload.size_bytes),
    media_duration_ms: payload.duration_ms ?? null,
    reel_caption: payload.reel_caption ? String(payload.reel_caption).slice(0, 5000) : null,
    source_fingerprint: payload.source_fingerprint ?? null,
    contract_version: payload.contract_version,
    last_error_code: null,
    last_error_message: null,
    download_started_at: null,
  });
  if (error) {
    v2Log('mark_download_success_error', { job_id: jobId, message: error.message });
    throw new Error(`DB_UPDATE_FAILED ${error.message}`);
  }
  v2Log('download_job_ok', { job_id: jobId });
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
      v2Log('internal_job_received', { job_id: job.job_id ?? null });
      try {
        await processDownloadJob(env, job);
        v2Log('internal_job_response', { job_id: job.job_id ?? null, http_status: 200, ok: true });
        return Response.json({ ok: true, job_id: job.job_id ?? null });
      } catch (error) {
        const errMsg = String(error?.message || 'download_failed');
        const code = errMsg.split(' ')[0];
        v2Log('internal_job_error', {
          job_id: job.job_id ?? null,
          error_code: code,
          message: errMsg.slice(0, 500),
        });
        const supabase = getSupabaseClient(env);
        const { error: retryError } = await markDownloadRetry(supabase, job.job_id, code, errMsg.slice(0, 500));
        if (retryError) {
          v2Log('mark_download_retry_error', { job_id: job.job_id ?? null, message: retryError.message });
        }
        v2Log('internal_job_response', { job_id: job.job_id ?? null, http_status: 500, ok: false });
        return Response.json({ ok: false, job_id: job.job_id ?? null, error: errMsg.slice(0, 500) }, { status: 500 });
      }
    }

    return new Response('Posting V2 Reel-Geter Active', { status: 200 });
  },
};
