import type { ClaimedQueueItem, DispatchOutcome } from '@fbuploadpro/contracts';
import type { DispatcherDbClient, Queryable } from './dispatcher.js';

export const UPDATE_QUEUE_ITEM_PUBLISHED_SQL = `
UPDATE queue_items
SET status = 'published',
    fb_post_id = $2,
    fb_comment_id = $3,
    published_at = now(),
    updated_at = now()
WHERE id = $1;
`.trim();

export const UPDATE_QUEUE_ITEM_RETRY_SQL = `
UPDATE queue_items
SET status = 'queued',
    retry_count = retry_count + 1,
    scheduled_time = now() + interval '5 minutes',
    updated_at = now()
WHERE id = $1;
`.trim();

export const UPDATE_QUEUE_ITEM_FAILED_SQL = `
UPDATE queue_items
SET status = 'failed',
    retry_count = retry_count + 1,
    updated_at = now()
WHERE id = $1;
`.trim();

export const INSERT_PUBLISH_LOG_SQL = `
INSERT INTO publish_logs (
    user_id,
    queue_item_id,
    fb_page_id,
    status,
    attempt_number,
    fb_response_code,
    error_message,
    error_details
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
`.trim();

export const UPDATE_PAGE_STATUS_SQL = `
UPDATE facebook_pages
SET status = $2,
    updated_at = now()
WHERE id = $1 AND user_id = $3;
`.trim();

/**
 * Atomically settles outcome of a queue item publication.
 * - On success ('published'): Updates queue_items to published and inserts
 *   a success audit log in publish_logs.
 * - On failure/retry: Updates queue_items status and inserts an error audit log in publish_logs.
 * - When targetPageStatus is present (e.g. 'fb_rate_limited' on 368/1390008 or 'page_checkpoint' on 368/4854002),
 *   updates facebook_pages.status accordingly.
 */
async function settleSupabaseOutcome(
  supabase: any,
  item: ClaimedQueueItem,
  outcome: DispatchOutcome
): Promise<void> {
  const attemptNumber = (item.retryCount || 0) + 1;
  const errorDetails =
    outcome.errorCode !== undefined
      ? {
          errorCode: outcome.errorCode,
          ...(outcome.errorSubcode !== undefined ? { errorSubcode: outcome.errorSubcode } : {}),
        }
      : null;

  if (outcome.status === 'published') {
    await supabase.from('queue_items').update({
      status: 'published',
      fb_post_id: outcome.fbPostId ?? null,
      fb_comment_id: outcome.fbCommentId ?? null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', item.id);

    await supabase.from('publish_logs').insert({
      user_id: item.userId,
      queue_item_id: item.id,
      fb_page_id: item.pageId,
      status: 'success',
      attempt_number: attemptNumber,
      fb_response_code: null,
      error_message: null,
      error_details: null,
    });
    return;
  }

  const isRetry = outcome.status === 'retry';
  const itemUpdate = isRetry
    ? {
        status: 'queued',
        retry_count: attemptNumber,
        scheduled_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }
    : {
        status: 'failed',
        retry_count: attemptNumber,
        updated_at: new Date().toISOString(),
      };

  await supabase.from('queue_items').update(itemUpdate).eq('id', item.id);

  await supabase.from('publish_logs').insert({
    user_id: item.userId,
    queue_item_id: item.id,
    fb_page_id: item.pageId,
    status: isRetry ? 'retry' : 'failure',
    attempt_number: attemptNumber,
    fb_response_code: outcome.errorCode ?? null,
    error_message: outcome.errorMessage ?? null,
    error_details: errorDetails,
  });

  if (outcome.targetPageStatus) {
    await supabase.from('facebook_pages').update({
      status: outcome.targetPageStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', item.pageId).eq('user_id', item.userId);
  }
}

async function settleLegacyOutcome(
  tx: Queryable,
  item: ClaimedQueueItem,
  outcome: DispatchOutcome
): Promise<void> {
  if (typeof tx.query !== 'function') return;
  const attemptNumber = (item.retryCount || 0) + 1;

  if (outcome.status === 'published') {
    await tx.query(UPDATE_QUEUE_ITEM_PUBLISHED_SQL, [
      item.id,
      outcome.fbPostId ?? null,
      outcome.fbCommentId ?? null,
    ]);
    await tx.query(INSERT_PUBLISH_LOG_SQL, [
      item.userId,
      item.id,
      item.pageId,
      'success',
      attemptNumber,
      null,
      null,
      null,
    ]);
    return;
  }

  const isRetry = outcome.status === 'retry';
  const updateSql = isRetry ? UPDATE_QUEUE_ITEM_RETRY_SQL : UPDATE_QUEUE_ITEM_FAILED_SQL;
  await tx.query(updateSql, [item.id]);

  const errorDetails =
    outcome.errorCode !== undefined
      ? JSON.stringify({
          errorCode: outcome.errorCode,
          ...(outcome.errorSubcode !== undefined ? { errorSubcode: outcome.errorSubcode } : {}),
        })
      : null;

  await tx.query(INSERT_PUBLISH_LOG_SQL, [
    item.userId,
    item.id,
    item.pageId,
    isRetry ? 'retry' : 'failure',
    attemptNumber,
    outcome.errorCode ?? null,
    outcome.errorMessage ?? null,
    errorDetails,
  ]);

  if (outcome.targetPageStatus) {
    await tx.query(UPDATE_PAGE_STATUS_SQL, [
      item.pageId,
      outcome.targetPageStatus,
      item.userId,
    ]);
  }
}

/**
 * Atomically settles outcome of a queue item publication.
 */
export async function settleOutcome(
  db: DispatcherDbClient | Queryable,
  item: ClaimedQueueItem,
  outcome: DispatchOutcome
): Promise<void> {
  if ('from' in db && typeof (db as any).from === 'function') {
    return settleSupabaseOutcome(db, item, outcome);
  }

  if ('withTransaction' in db && typeof (db as DispatcherDbClient).withTransaction === 'function') {
    return await (db as DispatcherDbClient).withTransaction!((tx) =>
      settleLegacyOutcome(tx, item, outcome)
    );
  }

  return await settleLegacyOutcome(db, item, outcome);
}
