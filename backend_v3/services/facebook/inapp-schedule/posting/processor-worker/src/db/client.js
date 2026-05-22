import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function claimDuePosts(supabase, limit = 10) {
  return supabase.rpc('claim_due_facebook_inapp_schedule_posts', { p_limit: limit });
}
