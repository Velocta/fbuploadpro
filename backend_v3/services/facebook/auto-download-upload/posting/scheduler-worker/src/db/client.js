import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function claimDueJobs(supabase, mode = 'prod') {
  return supabase.rpc('create_due_adu_posting_jobs', { p_mode: mode });
}

export async function resumeRateLimitedPages(supabase) {
  return supabase.rpc('resume_rate_limited_pages');
}
