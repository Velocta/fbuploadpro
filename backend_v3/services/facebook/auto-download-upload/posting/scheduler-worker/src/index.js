import { claimDueJobs, getSupabaseClient } from './db/client.js';

export default {
  async fetch() {
    return new Response('Posting V2 Scheduler Active', { status: 200 });
  },

  async scheduled(_event, env) {
    const supabase = getSupabaseClient(env);
    const mode = String(env.POSTING_V2_MODE || 'prod').toLowerCase() === 'test' ? 'test' : 'prod';

    function v2Log(event, fields = {}) {
      console.log(JSON.stringify({ service: 'v2-scheduler', event, ts: new Date().toISOString(), ...fields }));
    }

    v2Log('scheduled_tick_begin', { mode });

    // Single RPC per cron tick: create_due_adu_posting_jobs is idempotent per (page, schedule_slot_at).
    // Retrying after a successful commit caused duplicate jobs for the same schedule slot.
    const { data, error } = await claimDueJobs(supabase, mode);

    if (error) {
      v2Log('scheduled_tick_failed', { message: error.message });
      return;
    }

    const claimed = Array.isArray(data) ? data.length : 0;
    v2Log('scheduled_tick_end', { claimed_due_jobs: claimed, mode });
  },
};
