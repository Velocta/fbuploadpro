import {
  claimDownloadJobs,
  failExhaustedDownloads,
  getDownloadProcessingDepth,
  getSupabaseClient,
  resetStaleDownloads,
} from './db/client.js';

const REEL_GETER_INTERNAL_URL = 'https://v2-reel-geter.internal/internal/v2/process-job';

function v2Log(event, fields = {}) {
  console.log(JSON.stringify({ service: 'v2-download-processor', event, ts: new Date().toISOString(), ...fields }));
}

function envInt(env, key, fallback) {
  const raw = Number.parseInt(env[key] || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function dispatchReelGeterJob(ctx, env, job) {
  if (!env.REEL_GETER_WORKER) {
    v2Log('dispatch_skipped', { reason: 'missing_REEL_GETER_WORKER_binding' });
    return;
  }
  if (!env.INTERNAL_JOB_DISPATCH_TOKEN) {
    v2Log('dispatch_skipped', { reason: 'missing_INTERNAL_JOB_DISPATCH_TOKEN' });
    return;
  }
  const promise = env.REEL_GETER_WORKER.fetch(REEL_GETER_INTERNAL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-job-dispatch-token': env.INTERNAL_JOB_DISPATCH_TOKEN,
    },
    body: JSON.stringify(job),
  })
    .then((res) => {
      v2Log('reel_geter_dispatch_http', {
        job_id: job.job_id ?? null,
        http_status: res.status,
        ok: res.ok,
      });
    })
    .catch((err) => {
      v2Log('reel_geter_dispatch_network_error', {
        job_id: job.job_id ?? null,
        message: String(err?.message || err),
      });
    });
  ctx.waitUntil(promise);
}

export default {
  async fetch() {
    return new Response('Posting V2 Download Processor Active', { status: 200 });
  },

  async scheduled(_event, env, ctx) {
    if (!ctx?.waitUntil) {
      v2Log('scheduled_tick_error', { reason: 'missing_ExecutionContext_waitUntil' });
      return;
    }

    const supabase = getSupabaseClient(env);
    const maxBatch = envInt(env, 'MAX_BATCH_PER_CLAIM', 50);
    const maxRows = envInt(env, 'MAX_ROWS_PER_TICK', 50);
    const maxTickSeconds = envInt(env, 'MAX_TICK_SECONDS', 40);
    const backpressureMaxProcessing = envInt(env, 'BACKPRESSURE_MAX_PROCESSING', 8000);
    const tickDeadline = Date.now() + maxTickSeconds * 1000;

    v2Log('scheduled_tick_begin', {
      max_batch_per_claim: maxBatch,
      max_rows_per_tick: maxRows,
      max_tick_seconds: maxTickSeconds,
      backpressure_max_processing: backpressureMaxProcessing,
    });

    const stale = await resetStaleDownloads(supabase, 600, 1000);
    if (stale.error) {
      v2Log('stale_download_reset_error', { message: stale.error.message });
    } else {
      v2Log('stale_download_reset_ok', { rows_reset: stale.data ?? null });
    }

    const exhausted = await failExhaustedDownloads(supabase, 1000);
    if (exhausted.error) {
      v2Log('fail_exhausted_downloads_error', { message: exhausted.error.message });
    } else {
      v2Log('fail_exhausted_downloads_ok', { rows_marked: exhausted.count ?? null });
    }

    const processingDepth = await getDownloadProcessingDepth(supabase);
    if (processingDepth.error) {
      v2Log('download_processing_depth_error', { message: processingDepth.error.message });
    }

    let dispatched = 0;
    let claimIterations = 0;
    if ((processingDepth.count ?? 0) >= backpressureMaxProcessing) {
      v2Log('backpressure_gate_open', {
        processing_depth: processingDepth.count ?? 0,
        limit: backpressureMaxProcessing,
      });
      v2Log('scheduled_tick_end', {
        dispatched,
        claim_iterations: claimIterations,
        processing_depth: processingDepth.count ?? 0,
        stale_rows_reset: stale.error ? null : stale.data ?? null,
      });
      return;
    }

    while (Date.now() < tickDeadline && dispatched < maxRows) {
      const claimLimit = Math.min(maxBatch, maxRows - dispatched);
      const { data: jobs, error } = await claimDownloadJobs(supabase, claimLimit);
      claimIterations += 1;
      if (error) {
        v2Log('claim_download_jobs_error', { message: error.message, claim_iterations: claimIterations });
        break;
      }
      if (!jobs?.length) {
        v2Log('claim_download_jobs_empty', { claim_limit: claimLimit, claim_iterations: claimIterations });
        break;
      }
      v2Log('claim_download_jobs_ok', {
        returned: jobs.length,
        claim_limit: claimLimit,
        claim_iterations: claimIterations,
      });

      for (const job of jobs) {
        dispatchReelGeterJob(ctx, env, job);
        dispatched += 1;
      }
    }

    v2Log('scheduled_tick_end', {
      dispatched,
      claim_iterations: claimIterations,
      processing_depth: processingDepth.count ?? 0,
      stale_rows_reset: stale.error ? null : stale.data ?? null,
    });
  },
};
