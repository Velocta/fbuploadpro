import {
    getSupabaseClient,
    getPagesDuePosting,
    getNextPendingReelForPage,
    getActivePostingJobForPageReel,
    getStalePostingJobsByStatus,
    setPostingJobStatus,
} from './db/client.js';
import { recordPipelineEvent } from './pipeline-events.js';

const PIPELINE_VERSION = 'v1';
const STALE_LIMIT_PER_STATUS = 200;
const MAX_STALE_REDISPATCHES = 30;
const QUEUED_STALE_MINUTES = 10;
const COMPLETED_RETENTION_HOURS = 6;
const COMPLETED_PURGE_BATCH = 500;

function isoMinutesAgo(minutes) {
    return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function isoSecondsFromNow(seconds) {
    return new Date(Date.now() + seconds * 1000).toISOString();
}

function createJobPayload(page, reel, mode = 'prod') {
    return {
        pipeline_version: PIPELINE_VERSION,
        trace_id: crypto.randomUUID(),
        job_id: crypto.randomUUID(),
        mode,
        queued_at: new Date().toISOString(),
        agency_id: page.agency_id,
        page_id: page.id,
        fb_page_id: page.fb_page_id,
        fb_page_access_token: page.fb_page_access_token,
        source_username: page.source_username,
        source_platform: page.source_platform,
        reel_id: reel.reel_id,
        reel_internal_id: reel.id,
    };
}

async function enqueueJob(env, payload) {
    if (!env.POSTING_QUEUE) {
        throw new Error('POSTING_QUEUE binding is not configured');
    }
    await env.POSTING_QUEUE.send(payload);
}

async function requeueStaleJobs(supabase, env) {
    const staleSets = [
        { status: 'queued_for_download', staleBefore: isoMinutesAgo(QUEUED_STALE_MINUTES) },
        { status: 'downloading', staleBefore: isoMinutesAgo(3) },
        { status: 'download_ready', staleBefore: isoMinutesAgo(2) },
        { status: 'publishing', staleBefore: isoMinutesAgo(2) },
        { status: 'retry_scheduled', staleBefore: isoMinutesAgo(1) },
    ];

    for (const stale of staleSets) {
        const { data: jobs, error } = await getStalePostingJobsByStatus(
            supabase,
            stale.status,
            stale.staleBefore,
            STALE_LIMIT_PER_STATUS
        );
        if (error) {
            console.error(`[scheduler] stale lookup failed for ${stale.status}:`, error.message);
            await recordPipelineEvent(supabase, env, {
                mode: 'prod',
                service: 'scheduler',
                event_type: 'stale_lookup_failed',
                status: 'failed_terminal',
                error_code: 'stale_lookup_failed',
                error_message: error.message,
                attempt: 1,
            });
            continue;
        }

        for (const job of jobs || []) {
            const payload = job.payload || {};
            if (!payload?.job_id) {
                continue;
            }
            if (job.media_object_key && !payload.media_object_key) {
                payload.media_object_key = job.media_object_key;
            }
            if (job.media_sha256 && !payload.media_sha256) {
                payload.media_sha256 = job.media_sha256;
            }
            if (job.status === 'retry_scheduled' && job.next_retry_at && Date.parse(job.next_retry_at) > Date.now()) {
                continue;
            }

            const staleRedispatchCount = Number(job.stale_redispatch_count || 0);
            if (staleRedispatchCount >= MAX_STALE_REDISPATCHES) {
                await setPostingJobStatus(supabase, job.job_id, 'retry_scheduled', {
                    error_code: 'queue_retries_exhausted',
                    error_message: `stale_redispatch_cap_exceeded status=${job.status}`,
                    last_error_class: 'queue_stale_exhausted',
                    next_retry_at: isoSecondsFromNow(15),
                    lease_expires_at: null,
                });
                await recordPipelineEvent(supabase, env, {
                    mode: 'prod',
                    job_id: job.job_id,
                    trace_id: job.trace_id,
                    service: 'scheduler',
                    event_type: 'stale_job_soft_capped',
                    status: 'retry',
                    error_code: 'queue_retries_exhausted',
                    error_message: `stale_redispatch_cap_exceeded status=${job.status}`,
                    page_id: job.page_id,
                    reel_internal_id: job.reel_internal_id,
                    attempt: staleRedispatchCount,
                });
                continue;
            }

            const { error: updateError } = await setPostingJobStatus(supabase, job.job_id, 'queued_for_download', {
                error_code: 'lease_expired',
                error_message: `auto_requeue_from_${job.status}`,
                stale_redispatch_count: staleRedispatchCount + 1,
                dispatch_count: Number(job.dispatch_count || 0) + 1,
                last_error_class: 'queue_stale_recovered',
                lease_expires_at: null,
                next_retry_at: null,
            });

            if (updateError) {
                console.error(`[scheduler] stale requeue update failed job ${job.job_id}:`, updateError.message);
                continue;
            }

            try {
                await enqueueJob(env, payload);
                await recordPipelineEvent(supabase, env, {
                    mode: 'prod',
                    job_id: job.job_id,
                    trace_id: job.trace_id,
                    service: 'scheduler',
                    event_type: 'stale_job_redispatched',
                    status: 'retry',
                    error_code: 'lease_expired',
                    error_message: `requeued_from_${job.status}`,
                    page_id: job.page_id,
                    reel_internal_id: job.reel_internal_id,
                    attempt: staleRedispatchCount + 1,
                });
            } catch (enqueueError) {
                console.error(`[scheduler] stale requeue enqueue failed job ${job.job_id}:`, enqueueError.message);
                await setPostingJobStatus(supabase, job.job_id, 'retry_scheduled', {
                    error_code: 'queue_enqueue_failed',
                    error_message: enqueueError.message,
                    last_error_class: 'queue_enqueue_failed',
                    next_retry_at: isoSecondsFromNow(15),
                    lease_expires_at: null,
                });
                await recordPipelineEvent(supabase, env, {
                    mode: 'prod',
                    job_id: job.job_id,
                    trace_id: job.trace_id,
                    service: 'scheduler',
                    event_type: 'job_enqueue_failed',
                    status: 'failed_terminal',
                    error_code: 'queue_enqueue_failed',
                    error_message: enqueueError.message,
                    page_id: job.page_id,
                    reel_internal_id: job.reel_internal_id,
                    attempt: 1,
                });
            }
        }
    }
}

async function cleanupOldMediaObjects(supabase, env) {
    if (!env.POSTING_MEDIA_BUCKET) return;
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
        .from('posting_jobs')
        .select('job_id, media_object_key')
        .in('status', ['posted', 'failed_terminal'])
        .not('media_object_key', 'is', null)
        .lt('updated_at', cutoff)
        .limit(200);
    if (error) {
        console.error('[scheduler] media cleanup lookup failed:', error.message);
        return;
    }

    for (const row of rows || []) {
        const key = String(row.media_object_key || '').trim();
        if (!key) continue;
        try {
            await env.POSTING_MEDIA_BUCKET.delete(key);
            await supabase
                .from('posting_jobs')
                .update({ media_object_key: null, media_sha256: null })
                .eq('job_id', row.job_id);
        } catch (cleanupError) {
            console.error('[scheduler] media cleanup failed:', row.job_id, cleanupError?.message || cleanupError);
        }
    }
}

async function purgeOldCompletedJobs(supabase) {
    const cutoff = new Date(Date.now() - COMPLETED_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
        .from('posting_jobs')
        .select('job_id')
        .in('status', ['posted', 'failed_terminal'])
        .lt('updated_at', cutoff)
        .order('updated_at', { ascending: true })
        .limit(COMPLETED_PURGE_BATCH);
    if (error) {
        console.error('[scheduler] completed jobs purge lookup failed:', error.message);
        return;
    }
    if (!rows?.length) return;
    const jobIds = rows.map((row) => row.job_id).filter(Boolean);
    if (!jobIds.length) return;
    const { error: deleteError } = await supabase
        .from('posting_jobs')
        .delete()
        .in('job_id', jobIds);
    if (deleteError) {
        console.error('[scheduler] completed jobs purge failed:', deleteError.message);
    }
}

export default {
    async fetch(request, env, ctx) {
        if (request.method === 'GET') {
            return new Response('Scheduler Worker Active', { status: 200 });
        }

        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        const url = new URL(request.url);
        if (url.pathname !== '/enqueue-test-job') {
            return new Response('Not Found', { status: 404 });
        }

        const configuredKey = env.SCHEDULER_TEST_API_KEY;
        if (configuredKey) {
            const headerKey = request.headers.get('x-test-api-key');
            if (!headerKey || headerKey !== configuredKey) {
                return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        try {
            const payload = await request.json();
            payload.mode = 'test';
            payload.pipeline_version = PIPELINE_VERSION;
            payload.trace_id = payload.trace_id || crypto.randomUUID();
            payload.job_id = payload.job_id || crypto.randomUUID();
            payload.queued_at = new Date().toISOString();

            await enqueueJob(env, payload);

            return new Response(JSON.stringify({ ok: true, job_id: payload.job_id, mode: 'test' }), {
                status: 202,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },

    async scheduled(event, env, ctx) {
        const supabase = getSupabaseClient(env);

        console.log(`[scheduler] [${new Date().toISOString()}] checking due posts`);

        try {
            await requeueStaleJobs(supabase, env);
            await cleanupOldMediaObjects(supabase, env);
            await purgeOldCompletedJobs(supabase);

            const { data: pages, error } = await getPagesDuePosting(supabase);
            if (error) {
                console.error('[scheduler] get_pages_due_posting failed:', error.message);
                return;
            }

            if (!pages || pages.length === 0) {
                console.log('[scheduler] no pages due for posting');
                return;
            }

            console.log(`[scheduler] ${pages.length} pages due, enqueueing jobs`);

            const enqueues = pages.map(async (page) => {
                let payload = null;
                try {
                    const { data: reel, error: reelError } = await getNextPendingReelForPage(supabase, page.id);
                    if (reelError || !reel) {
                        console.log(`[scheduler] no pending reel for page ${page.id}`);
                        await recordPipelineEvent(supabase, env, {
                            mode: 'prod',
                            service: 'scheduler',
                            event_type: 'job_candidate_missing_reel',
                            status: 'failed_terminal',
                            error_code: 'no_pending_reel',
                            error_message: reelError?.message ?? 'no pending reel found',
                            page_id: page.id,
                            attempt: 1,
                        });
                        return;
                    }

                    payload = createJobPayload(page, reel, 'prod');

                    const { error: insertError } = await supabase.from('posting_jobs').insert({
                        job_id: payload.job_id,
                        trace_id: payload.trace_id,
                        mode: 'prod',
                        agency_id: page.agency_id,
                        page_id: page.id,
                        reel_internal_id: reel.id,
                        status: 'queued_for_download',
                        payload,
                        dispatch_count: 1,
                        lease_expires_at: null,
                        next_retry_at: null,
                    });

                    if (insertError?.code === '23505') {
                        const { data: activeJob, error: activeJobError } = await getActivePostingJobForPageReel(
                            supabase,
                            page.id,
                            reel.id
                        );
                        if (activeJobError || !activeJob?.payload?.job_id) {
                            console.log(`[scheduler] skip enqueue, active job for page ${page.id} reel ${reel.id}`);
                            return;
                        }
                        await enqueueJob(env, activeJob.payload);
                        await supabase
                            .from('posting_jobs')
                            .update({
                                dispatch_count: Number(activeJob.dispatch_count || 0) + 1,
                                error_code: null,
                                error_message: null,
                            })
                            .eq('job_id', activeJob.job_id);
                        await recordPipelineEvent(supabase, env, {
                            mode: 'prod',
                            job_id: activeJob.job_id,
                            trace_id: activeJob.trace_id,
                            service: 'scheduler',
                            event_type: 'active_job_redispatched',
                            status: 'retry',
                            page_id: page.id,
                            reel_internal_id: reel.id,
                            attempt: Number(activeJob.dispatch_count || 0) + 1,
                        });
                        return;
                    }

                    if (insertError) {
                        console.error('[scheduler] posting_jobs insert failed:', insertError.message);
                        await recordPipelineEvent(supabase, env, {
                            mode: 'prod',
                            job_id: payload.job_id,
                            trace_id: payload.trace_id,
                            service: 'scheduler',
                            event_type: 'job_enqueue_failed',
                            status: 'failed_terminal',
                            error_code: 'db_insert_failed',
                            error_message: insertError.message,
                            page_id: page.id,
                            reel_internal_id: reel.id,
                            attempt: 1,
                        });
                        return;
                    }

                    await enqueueJob(env, payload);

                    await recordPipelineEvent(supabase, env, {
                        mode: 'prod',
                        job_id: payload.job_id,
                        trace_id: payload.trace_id,
                        service: 'scheduler',
                        event_type: 'job_enqueued',
                        status: 'success',
                        page_id: page.id,
                        reel_internal_id: reel.id,
                        attempt: 1,
                    });

                    console.log(`[scheduler] enqueued job ${payload.job_id} for page ${page.id}`);
                } catch (enqueueError) {
                    console.error(`[scheduler] failed to enqueue page ${page.id}:`, enqueueError.message);
                    await recordPipelineEvent(supabase, env, {
                        mode: 'prod',
                        job_id: payload?.job_id ?? null,
                        trace_id: payload?.trace_id ?? null,
                        service: 'scheduler',
                        event_type: 'job_enqueue_failed',
                        status: 'failed_terminal',
                        error_code: 'queue_enqueue_failed',
                        error_message: enqueueError.message,
                        page_id: page.id,
                        reel_internal_id: payload?.reel_internal_id ?? null,
                        attempt: 1,
                    });
                }
            });

            ctx.waitUntil(Promise.all(enqueues));
        } catch (err) {
            console.error('[scheduler] unexpected error:', err.message);
            await recordPipelineEvent(supabase, env, {
                mode: 'prod',
                service: 'scheduler',
                event_type: 'scheduler_run_failed',
                status: 'failed_terminal',
                error_code: 'scheduler_unexpected_error',
                error_message: err.message,
                attempt: 1,
            });
        }
    },
};
