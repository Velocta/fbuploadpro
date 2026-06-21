import { getSupabaseClient } from './db/client.js';
import {
  getFacebookAccountsForRefresh,
  updateFacebookAccountsBulk,
} from './db/accounts.js';
import {
  getPagesForFollowerRefresh,
  resetFollowersRefreshCycle,
  updatePagesFollowersGainedBulk,
  getInappPagesForFollowerRefresh,
  resetInappFollowersRefreshCycle,
  updateInappPagesFollowersGainedBulk,
} from './db/pages.js';
import { getPageMetrics, getAccountMetrics } from './integrations/facebook.js';

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

async function processAccount(account) {
  if (!account.fb_user_access_token) {
    return {
      ok: false,
      failure: {
        id: account.id,
        fb_user_id: account.fb_user_id || null,
        reason: 'missing fb_user_access_token',
      },
    };
  }

  try {
    const { userName, userImage } = await getAccountMetrics(account.fb_user_access_token);
    return {
      ok: true,
      payload: {
        id: account.id,
        fb_user_name: userName,
        fb_user_image: userImage,
      },
    };
  } catch (error) {
    return {
      ok: false,
      failure: {
        id: account.id,
        fb_user_id: account.fb_user_id,
        reason: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
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
    const { pageName, fanCount, pageImage } = await getPageMetrics(page.fb_page_id, page.fb_page_access_token);
    return {
      ok: true,
      payload: {
        id: page.id,
        page_name: pageName,
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

async function processInappPage(page) {
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
    const { pageName, fanCount, pageImage } = await getPageMetrics(page.fb_page_id, page.fb_page_access_token);
    return {
      ok: true,
      payload: {
        id: page.id,
        fb_page_name: pageName,
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
    return new Response('Facebook analytics cron worker is running.', { status: 200 });
  },

  async scheduled(_event, env, ctx) {
    const supabase = getSupabaseClient(env);

    const task = (async () => {
      // 1. Refresh Facebook Accounts
      try {
        const { data: accounts, error: accountsError } = await getFacebookAccountsForRefresh(supabase);
        if (accountsError) {
          console.error(`[fb-analytics] Failed to fetch accounts for refresh: ${accountsError.message}`);
        } else if (accounts && accounts.length > 0) {
          console.log(`[fb-analytics] Processing ${accounts.length} Facebook accounts`);
          const { updates: accountUpdates, failures: accountFailures } = await runInChunks(
            accounts,
            REQUEST_CONCURRENCY,
            processAccount
          );
          const accountStatusUpdates = accountFailures
            .map((failure) => {
              const status = mapFailureToStatus(failure.reason);
              if (!status || !failure.id) return null;
              return { id: failure.id, status };
            })
            .filter(Boolean);
          const finalAccountUpdates = mergeUpdatesById([...accountUpdates, ...accountStatusUpdates]);
          console.log(`[fb-analytics] Sending ${accountUpdates.length} account updates and ${accountStatusUpdates.length} status updates to DB`);
          const { error: bulkAccountError } = await updateFacebookAccountsBulk(supabase, finalAccountUpdates);
          if (bulkAccountError) {
            console.error(`[fb-analytics] Bulk account DB update failed: ${bulkAccountError.message}`);
          }
        }
      } catch (err) {
        console.error(`[fb-analytics] Unhandled error in account processing: ${err instanceof Error ? err.message : err}`);
      }

      // 2. Refresh Pages (followers, image, page_name)
      // 2. Refresh ADU Pages (followers, image, page_name)
      try {
        const { data: pages, error: pagesError } = await getPagesForFollowerRefresh(supabase);

        if (pagesError) {
          console.error(`[fb-analytics] Failed to fetch pages for refresh: ${pagesError.message}`);
        } else if (!pages || pages.length === 0) {
          const { error: resetError } = await resetFollowersRefreshCycle(supabase);
          if (resetError) {
            console.error(`[fb-analytics] Failed to reset is_followers_updated cycle: ${resetError.message}`);
          } else {
            console.log('[fb-analytics] Cycle complete. Reset active pages to is_followers_updated=false');
          }
        } else {
          console.log(`[fb-analytics] Processing ${pages.length} pages in this run`);
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
            `[fb-analytics] Sending ${updates.length} metric updates and ${statusUpdates.length} status updates to DB`
          );
          const { data: updatedCount, error: bulkUpdateError } = await updatePagesFollowersGainedBulk(
            supabase,
            payloadUpdates
          );

          if (bulkUpdateError) {
            console.error(`[fb-analytics] Bulk DB update failed: ${bulkUpdateError.message}`);
          } else {
            console.log(`[fb-analytics] Bulk DB update completed. Rows updated: ${updatedCount ?? updates.length}`);
          }

          if (failures.length > 0) {
            const unhandledFailures = failures.filter((failure) => !mapFailureToStatus(failure.reason));
            const handledFailuresCount = failures.length - unhandledFailures.length;

            if (handledFailuresCount > 0) {
              console.log(`[fb-analytics] Auto-handled ${handledFailuresCount} page errors via status mapping`);
            }
            if (unhandledFailures.length > 0) {
              console.log(`[fb-analytics] Unhandled errors: ${unhandledFailures.length}`);
              console.log(`[fb-analytics] Unhandled failure details: ${JSON.stringify(unhandledFailures)}`);
            }
          }
        }
      } catch (err) {
        console.error(`[fb-analytics] Unhandled error in ADU page processing: ${err instanceof Error ? err.message : err}`);
      }

      // 3. Refresh In-App Pages (followers, image, fb_page_name)
      try {
        const { data: inappPages, error: inappPagesError } = await getInappPagesForFollowerRefresh(supabase);

        if (inappPagesError) {
          console.error(`[fb-analytics] Failed to fetch in-app pages for refresh: ${inappPagesError.message}`);
        } else if (!inappPages || inappPages.length === 0) {
          const { error: resetInappError } = await resetInappFollowersRefreshCycle(supabase);
          if (resetInappError) {
            console.error(`[fb-analytics] Failed to reset in-app is_followers_updated cycle: ${resetInappError.message}`);
          } else {
            console.log('[fb-analytics] In-app cycle complete. Reset active in-app pages to is_followers_updated=false');
          }
        } else {
          console.log(`[fb-analytics] Processing ${inappPages.length} in-app pages in this run`);
          const { updates: inappUpdates, failures: inappFailures } = await runInChunks(inappPages, REQUEST_CONCURRENCY, processInappPage);
          const inappStatusUpdates = inappFailures
            .map((failure) => {
              const status = mapFailureToStatus(failure.reason);
              if (!status || !failure.id) return null;
              return { id: failure.id, status };
            })
            .filter(Boolean);
          const inappCycleUpdates = inappPages.map((page) => ({ id: page.id, is_followers_updated: true }));
          const inappPayloadUpdates = mergeUpdatesById([...inappUpdates, ...inappStatusUpdates, ...inappCycleUpdates]);

          console.log(
            `[fb-analytics] Sending ${inappUpdates.length} in-app metric updates and ${inappStatusUpdates.length} status updates to DB`
          );
          const { data: updatedInappCount, error: bulkInappUpdateError } = await updateInappPagesFollowersGainedBulk(
            supabase,
            inappPayloadUpdates
          );

          if (bulkInappUpdateError) {
            console.error(`[fb-analytics] Bulk in-app DB update failed: ${bulkInappUpdateError.message}`);
          } else {
            console.log(`[fb-analytics] Bulk in-app DB update completed. Rows updated: ${updatedInappCount ?? inappUpdates.length}`);
          }

          if (inappFailures.length > 0) {
            const unhandledInappFailures = inappFailures.filter((failure) => !mapFailureToStatus(failure.reason));
            const handledInappFailuresCount = inappFailures.length - unhandledInappFailures.length;

            if (handledInappFailuresCount > 0) {
              console.log(`[fb-analytics] Auto-handled ${handledInappFailuresCount} in-app page errors via status mapping`);
            }
            if (unhandledInappFailures.length > 0) {
              console.log(`[fb-analytics] Unhandled in-app errors: ${unhandledInappFailures.length}`);
            }
          }
        }
      } catch (inappErr) {
        console.error(`[fb-analytics] Unhandled error in in-app page processing: ${inappErr instanceof Error ? inappErr.message : inappErr}`);
      }
    })();

    ctx.waitUntil(task);
  },
};
