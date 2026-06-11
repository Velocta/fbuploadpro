import { createClient } from '@supabase/supabase-js';

let cachedSupabase = null;

export function getSupabaseClient(env) {
  if (!cachedSupabase) {
    cachedSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return cachedSupabase;
}

export async function claimDueJobs(supabase, mode = 'prod') {
  return supabase.rpc('create_due_adu_posting_jobs', { p_mode: mode });
}

export async function resumeRateLimitedPages(supabase) {
  return supabase.rpc('resume_rate_limited_pages');
}
