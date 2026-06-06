import { claimPublishJobs, getSupabaseClient, releasePublishJob, resetStalePublishing } from './db/client.js';

const PUBLISHER_INTERNAL_URL = 'https://v2-publisher.internal/internal/v2/process-job';

function envInt(env, key, fallback) {
  const raw = Number.parseInt(env[key] || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function v2Log(event, fields = {}) {
  console.log(JSON.stringify({ service: 'v2-publish-processor', event, ts: new Date().toISOString(), ...fields }));
}

function dispatchPublisherJob(ctx, env, job, supabase) {
  if (!env.PUBLISHER_WORKER) {
    v2Log('dispatch_skipped', { reason: 'missing_PUBLISHER_WORKER_binding', job_id: job.job_id ?? null });
    void releasePublishJob(supabase, job.job_id, 'dispatch_skipped', 'missing_PUBLISHER_WORKER_binding');
    return;
  }
  if (!env.INTERNAL_JOB_DISPATCH_TOKEN) {
    v2Log('dispatch_skipped', { reason: 'missing_INTERNAL_JOB_DISPATCH_TOKEN', job_id: job.job_id ?? null });
    void releasePublishJob(supabase, job.job_id, 'dispatch_skipped', 'missing_INTERNAL_JOB_DISPATCH_TOKEN');
    return;
  }
  const promise = env.PUBLISHER_WORKER.fetch(PUBLISHER_INTERNAL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-job-dispatch-token': env.INTERNAL_JOB_DISPATCH_TOKEN,
    },
    body: JSON.stringify(job),
  })
    .then(async (res) => {
      v2Log('publisher_dispatch_http', {
        job_id: job.job_id ?? null,
        reel_internal_id: job.reel_internal_id ?? null,
        http_status: res.status,
        ok: res.ok,
      });
      if (!res.ok && (res.status === 403 || res.status === 400)) {
        const { error } = await releasePublishJob(
          supabase,
          job.job_id,
          'publisher_dispatch_rejected',
          `publisher returned HTTP ${res.status}`
        );
        if (error) {
          v2Log('release_publish_job_error', {
            job_id: job.job_id ?? null,
            message: error.message,
          });
        }
      }
    })
    .catch(async (err) => {
      v2Log('publisher_dispatch_network_error', {
        job_id: job.job_id ?? null,
        message: String(err?.message || err),
      });
      const { error } = await releasePublishJob(
        supabase,
        job.job_id,
        'publisher_dispatch_network_error',
        String(err?.message || err).slice(0, 500)
      );
      if (error) {
        v2Log('release_publish_job_error', {
          job_id: job.job_id ?? null,
          message: error.message,
        });
      }
    });
  ctx.waitUntil(promise);
}

export default {
  async fetch() {
    return new Response('Posting V2 Publish Processor Active', { status: 200 });
  },

  async scheduled(_event, env, ctx) {
    if (!ctx?.waitUntil) {
      v2Log('scheduled_tick_error', { reason: 'missing_ExecutionContext_waitUntil' });
      return;
    }

    const supabase = getSupabaseClient(env);
    const maxBatch = envInt(env, 'MAX_BATCH_PER_CLAIM', 100);
    const maxRows = envInt(env, 'MAX_ROWS_PER_TICK', 2000);
    const maxTickSeconds = envInt(env, 'MAX_TICK_SECONDS', 40);
    const tickDeadline = Date.now() + maxTickSeconds * 1000;

    v2Log('scheduled_tick_begin', {
      max_batch_per_claim: maxBatch,
      max_rows_per_tick: maxRows,
      max_tick_seconds: maxTickSeconds,
    });

    const stale = await resetStalePublishing(supabase, 300, 1000);
    if (stale.error) {
      v2Log('stale_publish_reset_error', { message: stale.error.message });
    } else {
      v2Log('stale_publish_reset_ok', { rows_reset: stale.data ?? null });
    }

    let dispatched = 0;
    let claimIterations = 0;

    while (Date.now() < tickDeadline && dispatched < maxRows) {
      const claimLimit = Math.min(maxBatch, maxRows - dispatched);
      const { data: jobs, error } = await claimPublishJobs(supabase, claimLimit);
      claimIterations += 1;
      if (error) {
        v2Log('claim_publish_jobs_error', { message: error.message, claim_iterations: claimIterations });
        break;
      }
      if (!jobs?.length) {
        v2Log('claim_publish_jobs_empty', { claim_limit: claimLimit, claim_iterations: claimIterations });
        break;
      }
      v2Log('claim_publish_jobs_ok', {
        returned: jobs.length,
        claim_limit: claimLimit,
        claim_iterations: claimIterations,
      });

      for (const job of jobs) {
        dispatchPublisherJob(ctx, env, job, supabase);
        dispatched += 1;
      }
    }

    v2Log('scheduled_tick_end', {
      dispatched,
      claim_iterations: claimIterations,
      stale_rows_reset: stale.error ? null : stale.data ?? null,
    });
  },
};
