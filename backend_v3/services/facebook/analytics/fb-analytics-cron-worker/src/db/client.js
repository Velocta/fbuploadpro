import { createClient } from '@supabase/supabase-js';

let supabaseCached = null;

export function getSupabaseClient(env) {
  if (!supabaseCached) {
    supabaseCached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseCached;
}
