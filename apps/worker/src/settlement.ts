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
    updated_at = now(),
    rate_limited_at = CASE WHEN $2 = 'fb_rate_limited' THEN now() ELSE rate_limited_at END
WHERE id = $1 AND user_id = $3;
`.trim();

/**
 * Atomically settles outcome of a queue item publication in Supabase environment.
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

  if (typeof supabase.rpc === 'function' && item.userId && item.pageId) {
    const isRetry = outcome.status === 'retry' || outcome.status === 'queued';
    const outcomeStatus = outcome.status === 'published' ? 'published' : isRetry ? 'queued' : 'failed';
    const { error: rpcError } = await supabase.rpc('settle_queue_item_outcome', {
      p_queue_item_id: item.id,
      p_user_id: item.userId,
      p_fb_page_id: item.pageId,
      p_outcome_status: outcomeStatus,
      p_fb_post_id: outcome.fbPostId ?? null,
      p_fb_comment_id: outcome.fbCommentId ?? null,
      p_retry_count: attemptNumber,
      p_retry_delay_seconds: outcome.retryDelaySeconds ?? 300,
      p_error_code: outcome.errorCode ?? null,
      p_error_subcode: outcome.errorSubcode ?? null,
      p_error_message: outcome.errorMessage ?? null,
      p_comment_warning: outcome.status === 'published' ? (outcome.errorMessage ?? null) : null,
      p_target_page_status: outcome.targetPageStatus ?? null,
      p_target_account_status: outcome.targetAccountStatus ?? null,
      p_page_cooldown_seconds: outcome.pageCooldownSeconds ?? null,
      p_buc_usage_pct: outcome.bucUsagePct ?? null,
    });
    if (!rpcError) {
      return;
    }
  }

  if (outcome.status === 'published') {
    const { error: updateError } = await supabase.from('queue_items').update({
      status: 'published',
      fb_post_id: outcome.fbPostId ?? null,
      fb_comment_id: outcome.fbCommentId ?? null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    if (updateError) {
      throw new Error(`Failed to update queue_item status to published: ${updateError.message || JSON.stringify(updateError)}`);
    }

    const publishLogsTable = supabase.from('publish_logs');
    if (typeof publishLogsTable?.insert === 'function') {
      const { error: logError } = await publishLogsTable.insert({
        user_id: item.userId,
        queue_item_id: item.id,
        fb_page_id: item.pageId,
        status: 'success',
        attempt_number: attemptNumber,
        fb_response_code: null,
        error_message: outcome.errorMessage ?? null,
        error_details: outcome.errorMessage ? { warning: outcome.errorMessage } : null,
      });
      if (logError) {
        throw new Error(`Failed to insert success publish_log: ${logError.message || JSON.stringify(logError)}`);
      }
    }
  } else {
    const isRetry = outcome.status === 'retry' || outcome.status === 'queued';
    const retryDelay = outcome.retryDelaySeconds ?? 300;
    const itemUpdate = isRetry
      ? {
          status: 'queued',
          retry_count: attemptNumber,
          scheduled_time: new Date(Date.now() + retryDelay * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }
      : {
          status: 'failed',
          retry_count: attemptNumber,
          updated_at: new Date().toISOString(),
        };

    const { error: itemUpdateError } = await supabase.from('queue_items').update(itemUpdate).eq('id', item.id);
    if (itemUpdateError) {
      throw new Error(`Failed to update queue_item status to ${itemUpdate.status}: ${itemUpdateError.message || JSON.stringify(itemUpdateError)}`);
    }

    const publishLogsTable = supabase.from('publish_logs');
    if (typeof publishLogsTable?.insert === 'function') {
      const { error: logInsertError } = await publishLogsTable.insert({
        user_id: item.userId,
        queue_item_id: item.id,
        fb_page_id: item.pageId,
        status: isRetry ? 'retry' : 'failure',
        attempt_number: attemptNumber,
        fb_response_code: outcome.errorCode ?? null,
        error_message: outcome.errorMessage ?? null,
        error_details: errorDetails,
      });
      if (logInsertError) {
        throw new Error(`Failed to insert ${isRetry ? 'retry' : 'failure'} publish_log: ${logInsertError.message || JSON.stringify(logInsertError)}`);
      }
    }
  }

  // Update page status, rate-limit cooldown, and BUC telemetry if present
  const pageUpdate: Record<string, any> = {};
  if (outcome.targetPageStatus) {
    pageUpdate.status = outcome.targetPageStatus;
    pageUpdate.updated_at = new Date().toISOString();
    if (outcome.targetPageStatus === 'fb_rate_limited') {
      pageUpdate.rate_limited_at = new Date().toISOString();
    }
  }
  if (outcome.pageCooldownSeconds && outcome.pageCooldownSeconds > 0) {
    pageUpdate.next_allowed_publish_at = new Date(
      Date.now() + outcome.pageCooldownSeconds * 1000
    ).toISOString();
    pageUpdate.updated_at = new Date().toISOString();
  }
  if (outcome.bucUsagePct !== undefined) {
    pageUpdate.buc_usage_pct = outcome.bucUsagePct;
    pageUpdate.updated_at = new Date().toISOString();
  }

  if (Object.keys(pageUpdate).length > 0) {
    let pageQuery: any = supabase
      .from('facebook_pages')
      .update(pageUpdate)
      .eq('id', item.pageId);
    if (typeof pageQuery?.eq === 'function') {
      pageQuery = pageQuery.eq('user_id', item.userId);
    }
    const { error: pageUpdateError } = await pageQuery;
    if (pageUpdateError) {
      throw new Error(`Failed to update facebook_pages status: ${pageUpdateError.message || JSON.stringify(pageUpdateError)}`);
    }
  }

  // Cascade parent Facebook account status to 'expired' when required (e.g. 190 non-492, 102, 10, 200-299)
  if (outcome.targetAccountStatus === 'expired') {
    let accountId = item.facebookAccountId;
    if (!accountId) {
      let pageSelectQuery: any = supabase
        .from('facebook_pages')
        .select('facebook_account_id')
        .eq('id', item.pageId);
      if (typeof pageSelectQuery?.eq === 'function') {
        pageSelectQuery = pageSelectQuery.eq('user_id', item.userId);
      }
      const pageResult = typeof pageSelectQuery?.maybeSingle === 'function' ? await pageSelectQuery.maybeSingle() : await pageSelectQuery;
      accountId = pageResult?.data?.facebook_account_id;
    }

    if (accountId) {
      let accountUpdateQuery: any = supabase
        .from('facebook_accounts')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', accountId);
      if (typeof accountUpdateQuery?.eq === 'function') {
        accountUpdateQuery = accountUpdateQuery.eq('user_id', item.userId);
      }
      await accountUpdateQuery;
    }
  }
}

type ActiveQueryable = Queryable & {
  query: NonNullable<Queryable['query']>;
};

async function settleLegacyPublishStatus(
  tx: ActiveQueryable,
  item: ClaimedQueueItem,
  outcome: DispatchOutcome,
  attemptNumber: number
): Promise<void> {
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
      outcome.errorMessage ?? null,
      outcome.errorMessage ? JSON.stringify({ warning: outcome.errorMessage }) : null,
    ]);
    return;
  }

  const isRetry = outcome.status === 'retry' || outcome.status === 'queued';
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
}

async function settleLegacyPageSideEffects(
  tx: ActiveQueryable,
  item: ClaimedQueueItem,
  outcome: DispatchOutcome
): Promise<void> {
  if (outcome.targetPageStatus) {
    await tx.query(UPDATE_PAGE_STATUS_SQL, [
      item.pageId,
      outcome.targetPageStatus,
      item.userId,
    ]);
  }

  if (outcome.pageCooldownSeconds && outcome.pageCooldownSeconds > 0) {
    await tx.query(
      `UPDATE facebook_pages
       SET next_allowed_publish_at = now() + make_interval(secs => $1),
           updated_at = now()
       WHERE id = $2 AND user_id = $3`,
      [outcome.pageCooldownSeconds, item.pageId, item.userId]
    );
  }

  if (outcome.targetAccountStatus === 'expired') {
    await tx.query(
      `UPDATE facebook_accounts
       SET status = 'expired', updated_at = now()
       WHERE user_id = $2
         AND id = (SELECT facebook_account_id FROM facebook_pages WHERE id = $1 AND user_id = $2)`,
      [item.pageId, item.userId]
    );
  }
}

async function settleLegacyOutcome(
  tx: Queryable,
  item: ClaimedQueueItem,
  outcome: DispatchOutcome
): Promise<void> {
  if (typeof tx.query !== 'function') return;
  const activeTx = tx as ActiveQueryable;
  const attemptNumber = (item.retryCount || 0) + 1;
  await settleLegacyPublishStatus(activeTx, item, outcome, attemptNumber);
  await settleLegacyPageSideEffects(activeTx, item, outcome);
}

/**
 * Atomically settles outcome of a queue item publication.
 */
export async function settleOutcome(
  db: DispatcherDbClient | Queryable,
  itemOrOutcome: ClaimedQueueItem | DispatchOutcome,
  maybeOutcome?: DispatchOutcome
): Promise<void> {
  const item: ClaimedQueueItem = maybeOutcome
    ? (itemOrOutcome as ClaimedQueueItem)
    : ({
        id: (itemOrOutcome as DispatchOutcome).queueItemId,
        userId: '',
        pageId: '',
        mediaId: '',
        caption: '',
        firstComment: null,
        retryCount: 0,
        maxRetries: 3,
        mediaType: 'video',
        mediaUrl: '',
        storageKey: '',
        fbPageId: '',
        encryptedPageToken: '',
        pageName: '',
        postFormat: 'reel',
      } as ClaimedQueueItem);

  const outcome: DispatchOutcome = maybeOutcome ?? (itemOrOutcome as DispatchOutcome);

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
