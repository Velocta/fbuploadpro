import { getSupabaseClient } from './db/client.js';
import {
  getPagesForFollowerRefresh,
  resetFollowersRefreshCycle,
  updatePagesFollowersGainedBulk,
} from './db/pages.js';
import { getPageMetrics } from './integrations/facebook.js';

const REQUEST_CONCURRENCY = 10;

function mapFailureToStatus(reason) {
  const text = String(reason || '').toLowerCase();
  if (text.includes('administrator, editor, or moderator') || text.includes('two factor')) return '2fa_required_on_BM';
  if (text.includes('api access blocked')) return 'check_developer_app';
  if (text.includes('permission') || text.includes('pages_read_engagement') || text.includes('pages_show_list')) return 'invalid_token';
  if (text.includes('log in to www.facebook.com') || text.includes('follow the instructions')) return 'fb_verification_required';
  if (text.includes('sessions for the user are not allowed because the user is not a confirmed user')) return 'account_suspended';
  if (text.includes('page that is not accessible')) return 'fb_verification_required';
  return null;
}

async function processPage(page) {
  if (!page.fb_page_id || !page.fb_page_access_token) {
    return {
      ok: false,
      failure: {
        id: page.id,
        fb_page_id: page.fb_page_id || null,
        reason: 'missing fb_page_id or fb_page_access_token',
      },
    };
  }

  try {
    const { fanCount, pageImage } = await getPageMetrics(page.fb_page_id, page.fb_page_access_token);
    return {
      ok: true,
      payload: {
        id: page.id,
        followers_gained: fanCount,
        fb_page_image: pageImage,
      },
    };
  } catch (error) {
    return {
      ok: false,
      failure: {
        id: page.id,
        fb_page_id: page.fb_page_id,
        reason: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

async function runInChunks(items, concurrency, worker) {
  const updates = [];
  const failures = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map(worker));

    for (const item of settled) {
      if (item.status === 'fulfilled' && item.value?.ok) {
        updates.push(item.value.payload);
      } else if (item.status === 'fulfilled' && item.value?.failure) {
        failures.push(item.value.failure);
      } else if (item.status === 'rejected') {
        failures.push({
          id: null,
          fb_page_id: null,
          reason: item.reason instanceof Error ? item.reason.message : 'Unhandled promise rejection',
        });
      }
    }
  }

  return { updates, failures };
}

function mergeUpdatesById(rows) {
  const byId = new Map();

  for (const row of rows) {
    if (!row?.id) continue;
    byId.set(row.id, { ...(byId.get(row.id) || {}), ...row, id: row.id });
  }

  return [...byId.values()];
}

export default {
  async fetch() {
    return new Response('Followers gained cron worker is running.', { status: 200 });
  },

  async scheduled(_event, env, ctx) {
    const supabase = getSupabaseClient(env);

    const task = (async () => {
      const { data: pages, error } = await getPagesForFollowerRefresh(supabase);

      if (error) {
        return;
      }

      if (!pages || pages.length === 0) {
        const { error: resetError } = await resetFollowersRefreshCycle(supabase);
        if (resetError) {
          console.error(`[followers-gained] Failed to reset is_followers_updated cycle: ${resetError.message}`);
          return;
        }
        console.log('[followers-gained] Cycle complete. Reset active pages to is_followers_updated=false');
        return;
      }

      console.log(`[followers-gained] Processing ${pages.length} pages in this run`);
      const { updates, failures } = await runInChunks(pages, REQUEST_CONCURRENCY, processPage);
      const statusUpdates = failures
        .map((failure) => {
          const status = mapFailureToStatus(failure.reason);
          if (!status || !failure.id) return null;
          return { id: failure.id, status };
        })
        .filter(Boolean);
      const cycleUpdates = pages.map((page) => ({ id: page.id, is_followers_updated: true }));
      const payloadUpdates = mergeUpdatesById([...updates, ...statusUpdates, ...cycleUpdates]);

      console.log(
        `[followers-gained] Sending ${updates.length} metric updates and ${statusUpdates.length} status updates to DB`
      );
      const { data: updatedCount, error: bulkUpdateError } = await updatePagesFollowersGainedBulk(
        supabase,
        payloadUpdates
      );

      if (bulkUpdateError) {
        console.error(`[followers-gained] Bulk DB update failed: ${bulkUpdateError.message}`);
        return;
      }

      console.log(`[followers-gained] Bulk DB update completed. Rows updated: ${updatedCount ?? updates.length}`);
      if (failures.length > 0) {
        const unhandledFailures = failures.filter((failure) => !mapFailureToStatus(failure.reason));
        const handledFailuresCount = failures.length - unhandledFailures.length;

        if (handledFailuresCount > 0) {
          console.log(`[followers-gained] Auto-handled ${handledFailuresCount} page errors via status mapping`);
        }
        if (unhandledFailures.length > 0) {
          console.log(`[followers-gained] Unhandled errors: ${unhandledFailures.length}`);
          console.log(`[followers-gained] Unhandled failure details: ${JSON.stringify(unhandledFailures)}`);
        }
      }
    })();

    ctx.waitUntil(task);
  },
};
