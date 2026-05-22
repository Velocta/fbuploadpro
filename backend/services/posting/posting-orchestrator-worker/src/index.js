import { getSupabaseClient } from './db/client.js';
import { logError } from './db/errors.js';
import { getNextPendingReel, markReelFailed, markReelPostedWithToken } from './db/reels.js';
import { publishToFacebook } from './integrations/facebook.js';
import { recordPipelineEvent } from './pipeline-events.js';
import { classifyErrorCode, isTerminalQueueError } from './queue-errors.js';

const RETRIES = {
    publish: 6,
};
const DO_LOCK_TTL_MS = 3 * 60 * 1000;

function isoSecondsFromNow(seconds) {
    return new Date(Date.now() + seconds * 1000).toISOString();
}

async function deleteMediaObjectIfPresent(env, key) {
    const mediaKey = String(key || '').trim();
    if (!mediaKey || !env.POSTING_MEDIA_BUCKET) return;
    try {
        await env.POSTING_MEDIA_BUCKET.delete(mediaKey);
    } catch (error) {
        console.error('[publisher] failed to delete media object:', mediaKey, String(error?.message || error));
    }
}

function eventServiceForErrorCode(code) {
    if (!code) return 'publisher';
    if (code.startsWith('download_')) return 'downloader';
    return 'publisher';
}

function isTestMode(job) {
    return String(job.mode || '').toLowerCase() === 'test';
}

function validateJobPayload(payload) {
    const required = [
        'job_id',
        'page_id',
        'fb_page_id',
        'fb_page_access_token',
        'source_username',
        'source_platform',
    ];
    const missing = required.filter((field) => !payload[field]);
    if (missing.length) {
        throw new Error(`invalid_job_payload missing=${missing.join(',')}`);
    }
}

async function updatePostingJob(supabase, jobId, mode, patch) {
    if (isTestMode({ mode })) return;
    await supabase.from('posting_jobs').update(patch).eq('job_id', jobId);
}

async function getPostingJobState(supabase, jobId, mode) {
    if (isTestMode({ mode })) return null;
    const { data, error } = await supabase
        .from('posting_jobs')
        .select('status, updated_at')
        .eq('job_id', jobId)
        .single();
    if (error) {
        throw new Error(`state_lookup_failed: ${error.message}`);
    }
    return data;
}

async function postJobStateDo(env, jobId, action, payload = {}) {
    if (!env.POSTING_PUBLISH_STATE_DO) {
        return { ok: true, decision: 'disabled' };
    }
    const id = env.POSTING_PUBLISH_STATE_DO.idFromName(String(jobId));
    const stub = env.POSTING_PUBLISH_STATE_DO.get(id);
    const res = await stub.fetch('https://job-state.internal/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, job_id: jobId, ...payload }),
    });
    if (!res.ok) {
        throw new Error(`state_do_failed status=${res.status}`);
    }
    return await res.json();
}

async function processPublishFromCallback(job, env, videoBlob, description = '', queueAttempt = 1, mediaObjectKey = '') {
    validateJobPayload(job);

    const supabase = getSupabaseClient(env);
    const mode = isTestMode(job) ? 'test' : 'prod';
    const { job_id, trace_id, page_id, fb_page_id, fb_page_access_token } = job;
    const reel = job.reel_internal_id && job.reel_id
        ? { id: job.reel_internal_id, reel_id: job.reel_id }
        : (await getNextPendingReel(supabase, page_id)).data;

    if (!reel) {
        throw new Error('no_pending_reel_for_page');
    }

    const existingState = await getPostingJobState(supabase, job_id, mode);
    if (existingState?.status === 'posted') {
        return { ok: true, idempotent: true, mode };
    }
    if (existingState?.status === 'failed_terminal') {
        throw new Error('state_conflict failed_terminal');
    }
    if (existingState?.status === 'publishing') {
        throw new Error('state_conflict publishing_in_progress');
    }

    const claim = await postJobStateDo(env, job_id, 'claim', {
        status: 'publishing',
        lock_ttl_ms: DO_LOCK_TTL_MS,
    });
    if (claim.decision === 'already_posted') {
        return { ok: true, idempotent: true, mode };
    }
    if (claim.decision === 'busy') {
        throw new Error('state_conflict publishing_in_progress');
    }

    if (mode === 'test' && env.TEST_ENABLE_EXTERNAL_PUBLISH !== 'true') {
        await recordPipelineEvent(supabase, env, {
            mode,
            job_id,
            trace_id,
            service: 'publisher',
            event_type: 'publish_skipped_test_mode',
            status: 'success',
            page_id,
            reel_internal_id: reel.id,
            attempt: queueAttempt,
        });
        await postJobStateDo(env, job_id, 'release');
        return { ok: true, skipped_publish: true, mode };
    }

    await updatePostingJob(supabase, job_id, mode, {
        status: 'publishing',
        attempt_publish: queueAttempt,
        publish_attempt_count: queueAttempt,
        lease_expires_at: isoSecondsFromNow(180),
        next_retry_at: null,
    });
    await recordPipelineEvent(supabase, env, {
        mode,
        job_id,
        trace_id,
        service: 'publisher',
        event_type: 'publish_started',
        status: 'success',
        page_id,
        reel_internal_id: reel.id,
        attempt: queueAttempt,
    });

    const pubStart = Date.now();
    let publishBlob = videoBlob;
    if (!(publishBlob instanceof File) && mediaObjectKey) {
        const object = await env.POSTING_MEDIA_BUCKET.get(mediaObjectKey);
        if (!object) {
            throw new Error(`media_object_not_found key=${mediaObjectKey}`);
        }
        publishBlob = new File([await object.arrayBuffer()], `${job.reel_id || 'reel'}.mp4`, {
            type: object.httpMetadata?.contentType || 'video/mp4',
        });
    }
    if (!(publishBlob instanceof File)) {
        throw new Error('invalid_callback_payload missing=video_or_media_object_key');
    }

    const success = await publishToFacebook(
        fb_page_id,
        fb_page_access_token,
        publishBlob,
        RETRIES.publish,
        description
    );
    const pubMs = Date.now() - pubStart;

    if (!success) {
        throw new Error('facebook_publish_unsuccessful');
    }

    if (mode === 'prod') {
        const { error: rpcError } = await markReelPostedWithToken(supabase, reel.id);
        if (rpcError) throw rpcError;
        await updatePostingJob(supabase, job_id, mode, {
            status: 'posted',
            error_code: null,
            error_message: null,
            terminal_reason: null,
            lease_expires_at: null,
            next_retry_at: null,
        });
    }
    await postJobStateDo(env, job_id, 'complete', { status: 'posted' });
    await deleteMediaObjectIfPresent(env, mediaObjectKey || job.media_object_key);

    await recordPipelineEvent(supabase, env, {
        mode,
        job_id,
        trace_id,
        service: 'publisher',
        event_type: 'publish_succeeded',
        status: 'success',
        duration_ms: pubMs,
        page_id,
        reel_internal_id: reel.id,
        attempt: queueAttempt,
    });

    return { ok: true, reel_id: reel.id, mode };
}

async function handleJobFailure(error, job, env, queueAttempt = 1) {
    const supabase = getSupabaseClient(env);
    const mode = isTestMode(job) ? 'test' : 'prod';
    const code = classifyErrorCode(error);
    const msg = String(error?.message || '');
    const terminal = isTerminalQueueError(error);

    if (mode === 'test') {
        console.error(`[orchestrator] job=${job.job_id} test mode failure:`, msg);
        return;
    }

    if (!terminal) {
        await postJobStateDo(env, job.job_id, 'release');
        await updatePostingJob(supabase, job.job_id, mode, {
            status: 'retry_scheduled',
            error_code: code,
            error_message: msg.slice(0, 2000),
            attempt_publish: queueAttempt,
            publish_attempt_count: queueAttempt,
            next_retry_at: isoSecondsFromNow(60),
            lease_expires_at: null,
        });
        await recordPipelineEvent(supabase, env, {
            mode: 'prod',
            job_id: job.job_id,
            trace_id: job.trace_id,
            service: eventServiceForErrorCode(code),
            event_type: 'job_retry_scheduled',
            status: 'retry',
            error_code: code,
            error_message: msg.slice(0, 2000),
            page_id: job.page_id,
            reel_internal_id: job.reel_internal_id ?? null,
            attempt: queueAttempt,
        });
        return;
    }

    await postJobStateDo(env, job.job_id, 'complete', { status: 'failed_terminal' });
    await updatePostingJob(supabase, job.job_id, mode, {
        status: 'failed_terminal',
        error_code: code,
        error_message: msg.slice(0, 2000),
        attempt_publish: queueAttempt,
        publish_attempt_count: queueAttempt,
        terminal_reason: code,
        next_retry_at: null,
        lease_expires_at: null,
    });
    await deleteMediaObjectIfPresent(env, job.media_object_key);

    await recordPipelineEvent(supabase, env, {
        mode: 'prod',
        job_id: job.job_id,
        trace_id: job.trace_id,
        service: eventServiceForErrorCode(code),
        event_type: 'job_failed_terminal',
        status: 'failed_terminal',
        error_code: code,
        error_message: msg.slice(0, 2000),
        page_id: job.page_id,
        reel_internal_id: job.reel_internal_id ?? null,
        attempt: queueAttempt,
    });
    await recordPipelineEvent(supabase, env, {
        mode: 'prod',
        job_id: job.job_id,
        trace_id: job.trace_id,
        service: eventServiceForErrorCode(code),
        event_type: 'dead_lettered',
        status: 'failed_terminal',
        error_code: code,
        error_message: msg.slice(0, 2000),
        page_id: job.page_id,
        reel_internal_id: job.reel_internal_id ?? null,
        attempt: queueAttempt,
    });

    const isAuthError = code === 'facebook_auth_invalid';
    if (isAuthError) {
        await supabase.from('pages').update({ status: 'invalid_token' }).eq('id', job.page_id);
        return;
    }

    const isFbVerificationRequired = msg.toLowerCase().includes('confirm your identity before you can publish');
    if (isFbVerificationRequired) {
        await supabase.from('pages').update({ status: 'fb_verification_required' }).eq('id', job.page_id);
        return;
    }

    if (msg.includes('Download failed after') && job.reel_internal_id) {
        await markReelFailed(supabase, job.reel_internal_id);
    }

    await logError(
        supabase,
        job.agency_id,
        job.page_id,
        job.reel_internal_id || null,
        `orchestrator_failed: ${msg}`,
        'pipeline',
        0
    );
}

export default {
    async fetch(request, env) {
        if (request.method === 'GET') {
            return new Response('Posting Orchestrator Active', { status: 200 });
        }

        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        const url = new URL(request.url);
        if (url.pathname === '/publish-callback') {
            const expectedToken = env.PUBLISH_CALLBACK_TOKEN;
            if (expectedToken && request.headers.get('x-publish-callback-token') !== expectedToken) {
                return new Response(JSON.stringify({ ok: false, error: 'unauthorized_callback' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            const contentType = request.headers.get('content-type') || '';
            let job;
            let description = '';
            let video;
            let mediaObjectKey = '';
            let downloaderErrorCode = '';
            let downloaderErrorMessage = '';

            if (contentType.includes('application/json')) {
                const body = await request.json();
                job = body.job;
                description = String(body.description || '');
                mediaObjectKey = String(body.media_object_key || body.job?.media_object_key || '');
                downloaderErrorCode = String(body.download_error_code || '');
                downloaderErrorMessage = String(body.download_error_message || '');
            } else {
                const form = await request.formData();
                const jobRaw = form.get('job');
                description = String(form.get('description') || '');
                video = form.get('video');
                if (typeof jobRaw === 'string') {
                    job = JSON.parse(jobRaw);
                }
            }

            if (!job || typeof job !== 'object') {
                return new Response(JSON.stringify({ ok: false, error: 'invalid_callback_payload' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            try {
                if (downloaderErrorCode) {
                    throw new Error(`${downloaderErrorCode}${downloaderErrorMessage ? `: ${downloaderErrorMessage}` : ''}`);
                }
                const result = await processPublishFromCallback(job, env, video, description, 1, mediaObjectKey);
                return new Response(JSON.stringify(result), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (error) {
                const msg = String(error?.message || '');
                if (msg.startsWith('state_conflict')) {
                    return new Response(
                        JSON.stringify({ ok: false, error: msg, job_id: job.job_id, error_code: 'state_conflict' }),
                        {
                            status: 409,
                            headers: { 'Content-Type': 'application/json' },
                        }
                    );
                }
                await handleJobFailure(error, job, env, 1);
                const terminal = isTerminalQueueError(error);
                const code = classifyErrorCode(error);
                const status = terminal ? 422 : 500;
                return new Response(JSON.stringify({ ok: false, error: error.message, job_id: job.job_id, error_code: code }), {
                    status,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        return new Response('Not Found', { status: 404 });
    },
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

export class PostingPublishStateDO {
    constructor(state, env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request) {
        if (request.method !== 'POST') {
            return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
        }
        const body = await request.json();
        const action = String(body?.action || '');
        const now = Date.now();
        const status = (await this.state.storage.get('status')) || null;
        const lockUntil = Number((await this.state.storage.get('lock_until')) || 0);

        if (action === 'claim') {
            if (status === 'posted') {
                return jsonResponse({ ok: true, decision: 'already_posted' });
            }
            if (lockUntil > now) {
                return jsonResponse({ ok: true, decision: 'busy', lock_until: lockUntil });
            }
            const ttlMs = Number(body.lock_ttl_ms || DO_LOCK_TTL_MS);
            const nextStatus = String(body.status || status || 'publishing');
            await this.state.storage.put('status', nextStatus);
            await this.state.storage.put('lock_until', now + ttlMs);
            await this.state.storage.put('updated_at', now);
            return jsonResponse({ ok: true, decision: 'claimed', status: nextStatus });
        }

        if (action === 'release') {
            await this.state.storage.put('lock_until', 0);
            await this.state.storage.put('updated_at', now);
            return jsonResponse({ ok: true, decision: 'released' });
        }

        if (action === 'complete') {
            const finalStatus = String(body.status || 'posted');
            await this.state.storage.put('status', finalStatus);
            await this.state.storage.put('lock_until', 0);
            await this.state.storage.put('updated_at', now);
            return jsonResponse({ ok: true, decision: 'completed', status: finalStatus });
        }

        return jsonResponse({ ok: false, error: 'invalid_action' }, 400);
    }
}
