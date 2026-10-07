import type { ClaimedQueueItem, DispatchOutcome } from '@fbuploadpro/contracts';
import type { DispatcherDbClient, Queryable } from './dispatcher.js';

export const DECREMENT_USER_TOKENS_SQL = `
UPDATE users
SET tokens_balance = tokens_balance - 1, updated_at = now()
WHERE id = $1 AND tokens_balance >= 1;
`.trim();

export const INSERT_TOKEN_TRANSACTION_SQL = `
INSERT INTO token_transactions (user_id, amount, transaction_type, reference_id, description)
VALUES ($1, $2, $3, $4, $5);
`.trim();

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
    error_details,
    tokens_deducted
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
`.trim();

/**
 * Atomically settles outcome of a queue item publication.
 * - On success ('published'): Decrements 1 token from users.tokens_balance (>= 1),
 *   records a debit in token_transactions, updates queue_items to published,
 *   and inserts a success audit log in publish_logs.
 * - On failure/retry: Deducts 0 tokens, updates queue_items status, and inserts
 *   an error audit log in publish_logs.
 */
export async function settleOutcome(
  db: DispatcherDbClient | Queryable,
  item: ClaimedQueueItem,
  outcome: DispatchOutcome
): Promise<void> {
  const executeSettlement = async (tx: Queryable): Promise<void> => {
    const attemptNumber = (item.retryCount || 0) + 1;

    if (outcome.status === 'published') {
      // 1. Atomically decrement user token balance (enforcing balance >= 1)
      await tx.query(DECREMENT_USER_TOKENS_SQL, [item.userId]);

      // 2. Insert audit ledger record
      const description = `Published post to Facebook Page ${item.pageName || item.fbPageId}`;
      await tx.query(INSERT_TOKEN_TRANSACTION_SQL, [
        item.userId,
        1,
        'debit',
        item.id,
        description,
      ]);

      // 3. Mark queue item published with external post ID and comment ID
      await tx.query(UPDATE_QUEUE_ITEM_PUBLISHED_SQL, [
        item.id,
        outcome.fbPostId ?? null,
        outcome.fbCommentId ?? null,
      ]);

      // 4. Record success publish log (1 token deducted)
      await tx.query(INSERT_PUBLISH_LOG_SQL, [
        item.userId,
        item.id,
        item.pageId,
        'success',
        attemptNumber,
        null,
        null,
        null,
        1,
      ]);
    } else if (outcome.status === 'retry') {
      // 1. Reschedule queue item for retry
      await tx.query(UPDATE_QUEUE_ITEM_RETRY_SQL, [item.id]);

      // 2. Record retry publish log (0 tokens deducted)
      const errorDetails =
        outcome.errorCode !== undefined
          ? JSON.stringify({ errorCode: outcome.errorCode })
          : null;

      await tx.query(INSERT_PUBLISH_LOG_SQL, [
        item.userId,
        item.id,
        item.pageId,
        'retry',
        attemptNumber,
        outcome.errorCode ?? null,
        outcome.errorMessage ?? null,
        errorDetails,
        0,
      ]);
    } else {
      // 1. Mark queue item as failed
      await tx.query(UPDATE_QUEUE_ITEM_FAILED_SQL, [item.id]);

      // 2. Record failure publish log (0 tokens deducted)
      const errorDetails =
        outcome.errorCode !== undefined
          ? JSON.stringify({ errorCode: outcome.errorCode })
          : null;

      await tx.query(INSERT_PUBLISH_LOG_SQL, [
        item.userId,
        item.id,
        item.pageId,
        'failure',
        attemptNumber,
        outcome.errorCode ?? null,
        outcome.errorMessage ?? null,
        errorDetails,
        0,
      ]);
    }
  };

  if ('withTransaction' in db && typeof (db as DispatcherDbClient).withTransaction === 'function') {
    return await (db as DispatcherDbClient).withTransaction!(executeSettlement);
  } else {
    return await executeSettlement(db);
  }
}
