import { claimPublishJobs, getSupabaseClient, releasePublishJob, resetStalePublishing } from './db/client.js';

const PUBLISHER_INTERNAL_URL = 'https://fb-inapp-publisher.internal/internal/v2/process-job';

function envInt(env, key, fallback) {
  const raw = Number.parseInt(env[key] || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function v2Log(event, fields = {}) {
  console.log(JSON.stringify({ service: 'fb-inapp-publish-processor', event, ts: new Date().toISOString(), ...fields }));
}

function dispatchPublisherJob(ctx, env, job, supabase) {
  if (!env.PUBLISHER_WORKER) {
    v2Log('dispatch_skipped', { reason: 'missing_PUBLISHER_WORKER_binding', job_id: job.job_id ?? null });
    void releasePublishJob(supabase, job.job_id, job.post_id, 'dispatch_skipped', 'missing_PUBLISHER_WORKER_binding');
    return;
  }
  if (!env.INTERNAL_JOB_DISPATCH_TOKEN) {
    v2Log('dispatch_skipped', { reason: 'missing_INTERNAL_JOB_DISPATCH_TOKEN', job_id: job.job_id ?? null });
    void releasePublishJob(supabase, job.job_id, job.post_id, 'dispatch_skipped', 'missing_INTERNAL_JOB_DISPATCH_TOKEN');
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
        http_status: res.status,
        ok: res.ok,
      });
      if (!res.ok && (res.status === 403 || res.status === 400)) {
        const { error } = await releasePublishJob(
          supabase,
          job.job_id,
          job.post_id,
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
        job.post_id,
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

async function retryFailedR2Deletions(env, supabase) {
  if (!env.USER_MEDIA) {
    v2Log('retry_deletions_skipped', { reason: 'missing_USER_MEDIA_binding' });
    return;
  }

  const { data: failedDeletes, error } = await supabase
    .from('failed_r2_deletions')
    .select('*')
    .eq('bucket_name', 'fbuploadpro-user-media')
    .lt('retry_count', 5)
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    v2Log('retry_deletions_fetch_error', { message: error.message });
    return;
  }

  if (!failedDeletes || failedDeletes.length === 0) {
    return;
  }

  v2Log('retry_deletions_begin', { count: failedDeletes.length });

  for (const record of failedDeletes) {
    try {
      await env.USER_MEDIA.delete(record.object_key);
      await supabase.from('failed_r2_deletions').delete().eq('id', record.id);
      v2Log('retry_deletion_success', { object_key: record.object_key });
    } catch (err) {
      v2Log('retry_deletion_failed', {
        object_key: record.object_key,
        message: String(err?.message || err),
        retry_count: record.retry_count + 1,
      });
      await supabase
        .from('failed_r2_deletions')
        .update({
          retry_count: record.retry_count + 1,
          last_error: String(err?.message || err).slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id);
    }
  }
}

export default {
  async fetch() {
    return new Response('In-App Schedule Publish Processor Active', { status: 200 });
  },

  async scheduled(_event, env, ctx) {
    if (!ctx?.waitUntil) {
      v2Log('scheduled_tick_error', { reason: 'missing_ExecutionContext_waitUntil' });
      return;
    }

    const supabase = getSupabaseClient(env);
    const maxBatch = envInt(env, 'MAX_BATCH_PER_CLAIM', 10);
    const maxRows = envInt(env, 'MAX_ROWS_PER_TICK', 100);
    const maxTickSeconds = envInt(env, 'MAX_TICK_SECONDS', 40);
    const tickDeadline = Date.now() + maxTickSeconds * 1000;

    v2Log('scheduled_tick_begin', {
      max_batch_per_claim: maxBatch,
      max_rows_per_tick: maxRows,
      max_tick_seconds: maxTickSeconds,
    });

    ctx.waitUntil(retryFailedR2Deletions(env, supabase));

    // Create any due in-app schedule jobs first
    const { data: createdJobs, error: createError } = await supabase.rpc('create_due_inapp_posting_jobs');
    if (createError) {
      v2Log('create_due_jobs_error', { message: createError.message });
    } else {
      v2Log('create_due_jobs_ok', { count: createdJobs?.length ?? 0 });
    }

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

