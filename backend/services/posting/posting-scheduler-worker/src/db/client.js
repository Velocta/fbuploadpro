import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function getPagesDuePosting(supabase) {
  return supabase.rpc('get_pages_due_posting');
}

export async function getNextPendingReelForPage(supabase, pageId) {
  return supabase
    .from('reels')
    .select('id, reel_id')
    .eq('page_id', pageId)
    .eq('status', 'pending')
    .order('id', { ascending: true })
    .limit(1)
    .single();
}

export async function getStalePostingJobsByStatus(supabase, status, staleBeforeIso, limit = 100) {
  return supabase
    .from('posting_jobs')
    .select('job_id, trace_id, page_id, reel_internal_id, payload, status, updated_at, lease_expires_at, next_retry_at, dispatch_count, stale_redispatch_count, media_object_key, media_sha256')
    .eq('status', status)
    .or(`lease_expires_at.lt.${staleBeforeIso},and(lease_expires_at.is.null,updated_at.lt.${staleBeforeIso})`)
    .order('updated_at', { ascending: true })
    .limit(limit);
}

export async function setPostingJobStatus(supabase, jobId, status, patch = {}) {
  return supabase
    .from('posting_jobs')
    .update({ status, ...patch })
    .eq('job_id', jobId);
}

export async function getActivePostingJobForPageReel(supabase, pageId, reelInternalId) {
  return supabase
    .from('posting_jobs')
    .select('job_id, trace_id, status, updated_at, payload, stale_redispatch_count')
    .eq('page_id', pageId)
    .eq('reel_internal_id', reelInternalId)
    .not('status', 'in', '("posted","failed_terminal")')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}
