import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function claimDueJobs(supabase, mode = 'prod') {
  return supabase.rpc('claim_due_reels_and_create_jobs_v2', { p_mode: mode });
}
