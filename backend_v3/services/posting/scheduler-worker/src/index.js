import { claimDueJobs, getSupabaseClient } from './db/client.js';

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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

    const backoffsMs = [1000, 2000, 4000];
    let data = null;
    let finalError = null;

    for (let attempt = 1; attempt <= backoffsMs.length; attempt++) {
      const result = await claimDueJobs(supabase, mode);
      data = result.data;
      finalError = result.error ?? null;
      if (!finalError) break;

      v2Log('claim_due_jobs_error', { attempt, max_attempts: backoffsMs.length, message: finalError.message });

      if (attempt < backoffsMs.length) {
        await sleep(backoffsMs[attempt - 1]);
      }
    }

    if (finalError) {
      v2Log('scheduled_tick_failed', { message: finalError.message });
      return;
    }

    const claimed = Array.isArray(data) ? data.length : 0;
    v2Log('scheduled_tick_end', { claimed_due_jobs: claimed, mode });
  },
};
