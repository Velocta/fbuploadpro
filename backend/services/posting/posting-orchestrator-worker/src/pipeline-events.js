/**
 * Append-only pipeline logging. Skips all DB writes for mode=test.
 */
export function isDbPipelineMode(jobOrMode) {
    const mode = typeof jobOrMode === 'string' ? jobOrMode : jobOrMode?.mode;
    return String(mode || '').toLowerCase() === 'prod';
}

export async function recordPipelineEvent(supabase, env, row) {
    if (!row || !isDbPipelineMode(row.mode)) {
        return;
    }
    console.log(JSON.stringify({
        service: row.service,
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
