import { downloadOnce } from './downloader.js';
import { Container, getContainer } from '@cloudflare/containers';
import { env as workerEnv } from 'cloudflare:workers';
import { createClient } from '@supabase/supabase-js';

const MAX_DOWNLOAD_QUEUE_ATTEMPTS = 6;
const MAX_SOURCE_DOWNLOAD_ATTEMPTS = 5;
const TERMINAL_CALLBACK_CODES = new Set([401, 410, 422]);

function validateJob(job) {
  const required = ['job_id', 'page_id', 'fb_page_id', 'fb_page_access_token'];
  const needsDownload = !job.media_object_key;
  if (needsDownload) {
    required.push('source_username', 'source_platform', 'reel_id');
  }
  const missing = required.filter((key) => !job[key]);
  if (missing.length) {
    throw new Error(`invalid_job_payload missing=${missing.join(',')}`);
  }
}

function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

function getDownloadErrorClass(message) {
  const msg = String(message || '').toLowerCase();
  if (msg.startsWith('invalid_job_payload') || msg.startsWith('unsupported_platform')) {
    return 'invalid_payload_terminal';
  }
  if (
    msg.includes('no container instance available') ||
    msg.includes('failed to start container') ||
    msg.includes('maximum number of running container instances exceeded') ||
    msg.includes('network connection lost') ||
    msg.includes('blockconcurrencywhile') ||
    msg.includes('durable object') ||
    msg.includes('memory limit exceeded')
  ) {
    return 'container_startup_transient';
  }
  if (msg.includes('yt-dlp') || msg.includes('all yt-dlp profile attempts failed')) {
    return 'downloader_runtime_transient';
  }
  if (msg.includes('container_startup_not_ready')) {
    return 'container_startup_transient';
  }
  return 'download_unknown_transient';
}

function isSourceDownloadFailure(message) {
  const msg = String(message || '').toLowerCase();
  return (
    msg.includes('yt-dlp') ||
    msg.includes('proxy') ||
    msg.includes('login') ||
    msg.includes('not available') ||
    msg.includes('all yt-dlp profile attempts failed')
  );
}

function isoSecondsFromNow(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sha256Hex(blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function patchPostingJob(supabase, jobId, patch) {
  if (!jobId) return;
  await supabase.from('posting_jobs').update(patch).eq('job_id', jobId);
}

async function recordPipelineEvent(supabase, env, row) {
  if (String(row?.mode || '').toLowerCase() !== 'prod') return;
  console.log(JSON.stringify({
    service: 'downloader',
    event_type: row.event_type,
    status: row.status ?? null,
    error_code: row.error_code ?? null,
    error_message: row.error_message ?? null,
    attempt: row.attempt ?? null,
    duration_ms: row.duration_ms ?? null,
    env_name: env?.ENVIRONMENT ?? 'unknown',
    mode: row.mode,
    job_id: row.job_id ?? null,
    trace_id: row.trace_id ?? null,
    page_id: row.page_id ?? null,
    reel_internal_id: row.reel_internal_id ?? null,
    payload: row.payload ?? {},
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health/env') {
      if (!env.POSTING_DOWNLOAD_CONTAINER) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'downloader_container_not_configured',
        }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      try {
        const session = url.searchParams.get('session') || 'health-check';
        const container = getContainer(env.POSTING_DOWNLOAD_CONTAINER, session);
        const resp = await container.fetch('https://downloader.internal/health/env');
        const bodyText = await resp.text();
        return new Response(bodyText, {
          status: resp.status,
          headers: { 'content-type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          ok: false,
          error: String(error?.message || 'health_env_fetch_failed'),
        }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    return new Response('Downloader Queue Worker Active', { status: 200 });
  },

  async queue(batch, env) {
    const supabase = getSupabaseClient(env);
    for (const message of batch.messages) {
      const job = message.body || {};
      const attempt = Number(message.attempts || 1);
      const startedAt = Date.now();
      try {
        validateJob(job);
        await patchPostingJob(supabase, job.job_id, {
          status: 'downloading',
          attempt_download: attempt,
          download_attempt_count: attempt,
          dispatch_count: attempt,
          error_code: null,
          error_message: null,
          last_error_class: null,
          lease_expires_at: isoSecondsFromNow(300),
          next_retry_at: null,
          terminal_reason: null,
        });
        let mediaObjectKey = String(job.media_object_key || '');
        let description = String(job.media_description || '');
        if (!mediaObjectKey) {
          const containerSessionId = `${job.job_id}-a${attempt}`;
          const { blob, description: downloadedDescription } = await downloadOnce(
            env,
            job.source_platform,
            job.source_username,
            job.reel_id,
            containerSessionId
          );
          description = downloadedDescription || '';
          const sha = await sha256Hex(blob);
          mediaObjectKey = `posting-media/${job.job_id}/${sha}.mp4`;
          await env.POSTING_MEDIA_BUCKET.put(mediaObjectKey, blob, {
            httpMetadata: { contentType: blob.type || 'video/mp4' },
            customMetadata: {
              job_id: String(job.job_id),
              trace_id: String(job.trace_id || ''),
              reel_id: String(job.reel_id || ''),
            },
          });
          job.media_sha256 = sha;
        }

        job.media_object_key = mediaObjectKey;
        job.media_description = description;

        await patchPostingJob(supabase, job.job_id, {
          status: 'download_ready',
          media_object_key: mediaObjectKey,
          media_sha256: job.media_sha256 ?? null,
          download_attempt_count: attempt,
          lease_expires_at: isoSecondsFromNow(180),
        });

        const callbackResponse = await env.PUBLISHER.fetch('http://internal/publish-callback', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-publish-callback-token': env.PUBLISH_CALLBACK_TOKEN || '',
          },
          body: JSON.stringify({
            job,
            description,
            media_object_key: mediaObjectKey,
          }),
        });

        if (!callbackResponse.ok) {
          if (TERMINAL_CALLBACK_CODES.has(callbackResponse.status)) {
            const callbackBody = await callbackResponse.text();
            await patchPostingJob(supabase, job.job_id, {
              status: 'failed_terminal',
              error_code: `publish_callback_terminal_${callbackResponse.status}`,
              error_message: callbackBody.slice(0, 2000) || `publish_callback_terminal_${callbackResponse.status}`,
              terminal_reason: `publisher_callback_${callbackResponse.status}`,
              lease_expires_at: null,
            });
            message.ack();
            continue;
          }
          throw new Error(`publish_callback_failed status=${callbackResponse.status}`);
        }

        await recordPipelineEvent(supabase, env, {
          mode: job.mode || 'prod',
          job_id: job.job_id,
          trace_id: job.trace_id,
          page_id: job.page_id,
          reel_internal_id: job.reel_internal_id,
          event_type: 'download_succeeded',
          status: 'success',
          attempt,
          duration_ms: Date.now() - startedAt,
        });
        message.ack();
      } catch (error) {
        const msg = String(error?.message || '');
        const errorClass = getDownloadErrorClass(msg);
        const terminalPayload = msg.startsWith('invalid_job_payload') || msg.startsWith('unsupported_platform');
        const terminalExhausted = isSourceDownloadFailure(msg) && attempt >= MAX_SOURCE_DOWNLOAD_ATTEMPTS;
        const terminal = terminalPayload || terminalExhausted || msg.includes('downloader_container_not_configured');

        await patchPostingJob(supabase, job.job_id, {
          status: terminal ? 'failed_terminal' : 'retry_scheduled',
          attempt_download: attempt,
          download_attempt_count: attempt,
          dispatch_count: attempt,
          error_code: terminal ? 'download_transient_exhausted' : 'download_retry_scheduled',
          error_message: msg.slice(0, 2000),
          last_error_class: errorClass,
          next_retry_at: terminal ? null : isoSecondsFromNow(randomIntInclusive(10, 20)),
          lease_expires_at: null,
          terminal_reason: terminal ? (terminalPayload ? 'invalid_payload' : 'download_source_exhausted') : null,
        });
        await recordPipelineEvent(supabase, env, {
          mode: job.mode || 'prod',
          job_id: job.job_id,
          trace_id: job.trace_id,
          page_id: job.page_id,
          reel_internal_id: job.reel_internal_id,
          event_type: terminal ? 'job_failed_terminal' : 'download_retry_scheduled',
          status: terminal ? 'failed_terminal' : 'retry',
          error_code: terminal ? 'download_transient_exhausted' : 'download_retry_scheduled',
          error_message: msg.slice(0, 2000),
          attempt,
          duration_ms: Date.now() - startedAt,
        });

        if (terminal) {
          await env.PUBLISHER.fetch('http://internal/publish-callback', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-publish-callback-token': env.PUBLISH_CALLBACK_TOKEN || '',
            },
            body: JSON.stringify({
              job,
              download_error_code: terminalPayload
                ? 'invalid_job_payload'
                : 'download_transient_exhausted',
              download_error_message: msg,
            }),
          });
        }

        if (terminal) {
          message.ack();
        } else {
          message.retry();
        }
      }
    }
  },
};

export class PostingDownloadContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '3s';
  envVars = {
    DATACENTER_PROXY: workerEnv.DATACENTER_PROXY,
    RESIDENTIAL_PROXY: workerEnv.RESIDENTIAL_PROXY,
  };
}
