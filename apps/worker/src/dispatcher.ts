import {
  type ClaimedQueueItem,
  ClaimedQueueItemSchema,
  type DispatchOutcome,
  type IFacebookPublishClient,
  type IPublishDispatcher,
  decryptToken,
} from '@fbuploadpro/contracts';
import { FacebookGraphError, FacebookPublishClient } from './fb-client.js';
import { settleOutcome } from './settlement.js';

export interface Queryable {
  query<T = unknown>(text: string, params?: unknown[]): Promise<T[] | { rows?: T[] }>;
}

export interface DispatcherDbClient extends Queryable {
  withTransaction?<T>(callback: (client: Queryable) => Promise<T>): Promise<T>;
}

export const CLAIM_DUE_ITEMS_SQL = `
SELECT qi.id, qi.user_id, qi.fb_page_id, qi.media_id, qi.caption, qi.first_comment, qi.retry_count, qi.max_retries,
       m.media_type, m.url as media_url, m.storage_key,
       fp.fb_page_id as external_page_id, fp.encrypted_access_token, fp.page_name
FROM queue_items qi
JOIN media_items m ON m.id = qi.media_id AND m.user_id = qi.user_id
JOIN facebook_pages fp ON fp.id = qi.fb_page_id AND fp.user_id = qi.user_id
WHERE qi.status = 'queued' AND qi.scheduled_time <= now()
ORDER BY qi.scheduled_time ASC
LIMIT $1
FOR UPDATE SKIP LOCKED;
`.trim();

export const UPDATE_CLAIMED_STATUS_SQL = `
UPDATE queue_items
SET status = 'publishing', updated_at = now()
WHERE id = ANY($1);
`.trim();

function extractRows<T = unknown>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function mapRowToClaimedQueueItem(row: Record<string, unknown>): ClaimedQueueItem {
  return ClaimedQueueItemSchema.parse({
    id: row.id,
    userId: row.user_id,
    pageId: row.fb_page_id,
    mediaId: row.media_id,
    caption: String(row.caption ?? ''),
    firstComment: row.first_comment ? String(row.first_comment) : null,
    retryCount: Number(row.retry_count ?? 0),
    maxRetries: Number(row.max_retries ?? 3),
    mediaType: row.media_type,
    mediaUrl: String(row.media_url),
    storageKey: String(row.storage_key),
    fbPageId: String(row.external_page_id ?? row.fb_page_id),
    encryptedPageToken: String(row.encrypted_access_token),
    pageName: String(row.page_name ?? ''),
  });
}

/**
 * Claims due queue items atomically using PostgreSQL FOR UPDATE SKIP LOCKED.
 * Transitions claimed items to status 'publishing'.
 */
export async function claimDueItems(
  db: DispatcherDbClient,
  limit: number = 10
): Promise<ClaimedQueueItem[]> {
  const executeClaim = async (client: Queryable): Promise<ClaimedQueueItem[]> => {
    const rawResult = await client.query(CLAIM_DUE_ITEMS_SQL, [limit]);
    const rows = extractRows<Record<string, unknown>>(rawResult);
    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((r) => r.id as string);
    await client.query(UPDATE_CLAIMED_STATUS_SQL, [ids]);

    return rows.map(mapRowToClaimedQueueItem);
  };

  if (typeof db.withTransaction === 'function') {
    return await db.withTransaction((tx) => executeClaim(tx));
  } else {
    return await executeClaim(db);
  }
}

/**
 * Dispatches a claimed queue item to Facebook Graph API v26.0.
 * Decrypts access token, streams video reel or photo, and posts first comment if configured.
 */
export async function dispatchItem(
  item: ClaimedQueueItem,
  fbClient: IFacebookPublishClient,
  masterKey: string
): Promise<DispatchOutcome> {
  // 1. Decrypt page access token
  let accessToken: string;
  try {
    accessToken = await decryptToken(item.encryptedPageToken, masterKey);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const outcome: DispatchOutcome = {
      queueItemId: item.id,
      status: 'failed',
      errorMessage: `Token decryption failed: ${errorMessage}`,
    };
    return outcome;
  }

  // 2. Publish media to Facebook Graph API
  let publishResult: { postId: string };
  try {
    if (item.mediaType === 'video') {
      publishResult = await fbClient.publishReel({
        pageId: item.fbPageId,
        accessToken,
        videoUrl: item.mediaUrl,
        caption: item.caption,
      });
    } else {
      publishResult = await fbClient.publishPhoto({
        pageId: item.fbPageId,
        accessToken,
        imageUrl: item.mediaUrl,
        caption: item.caption,
      });
    }
  } catch (err: unknown) {
    const isAuthError = err instanceof FacebookGraphError ? err.isAuthError : false;
    const isRateLimit = err instanceof FacebookGraphError ? err.isRateLimit : false;
    const errorCode =
      err instanceof FacebookGraphError
        ? err.code
        : typeof (err as { code?: number })?.code === 'number'
        ? (err as { code: number }).code
        : undefined;
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Rate limits or transient errors can be retried if retryCount < maxRetries
    const canRetry = (isRateLimit || !isAuthError) && item.retryCount < item.maxRetries;

    const outcome: DispatchOutcome = {
      queueItemId: item.id,
      status: canRetry ? 'retry' : 'failed',
      errorMessage,
      ...(errorCode !== undefined ? { errorCode } : {}),
    };
    return outcome;
  }

  // 3. Automated first comment (if configured)
  let fbCommentId: string | undefined;
  if (item.firstComment && item.firstComment.trim().length > 0) {
    try {
      const commentRes = await fbClient.postComment({
        postId: publishResult.postId,
        accessToken,
        message: item.firstComment.trim(),
      });
      fbCommentId = commentRes.commentId;
    } catch (commentErr: unknown) {
      // If post succeeds but comment fails, post remains published.
      console.warn(
        `[Dispatcher] First comment failed for queue item ${item.id} (post ${publishResult.postId}):`,
        commentErr
      );
    }
  }

  const outcome: DispatchOutcome = {
    queueItemId: item.id,
    status: 'published',
    fbPostId: publishResult.postId,
    ...(fbCommentId !== undefined ? { fbCommentId } : {}),
  };
  return outcome;
}

/**
 * Records dispatch outcome into queue_items table.
 */
export async function recordDispatchOutcome(
  db: Queryable,
  outcome: DispatchOutcome
): Promise<void> {
  if (outcome.status === 'published') {
    await db.query(
      `UPDATE queue_items
       SET status = 'published',
           fb_post_id = $2,
           fb_comment_id = $3,
           published_at = now(),
           updated_at = now()
       WHERE id = $1`,
      [outcome.queueItemId, outcome.fbPostId ?? null, outcome.fbCommentId ?? null]
    );
  } else if (outcome.status === 'retry') {
    await db.query(
      `UPDATE queue_items
       SET status = 'queued',
           retry_count = retry_count + 1,
           scheduled_time = now() + interval '5 minutes',
           updated_at = now()
       WHERE id = $1`,
      [outcome.queueItemId]
    );
  } else {
    await db.query(
      `UPDATE queue_items
       SET status = 'failed',
           retry_count = retry_count + 1,
           updated_at = now()
       WHERE id = $1`,
      [outcome.queueItemId]
    );
  }
}

export interface RunDispatchCycleParams {
  db: DispatcherDbClient;
  fbClient?: IFacebookPublishClient;
  masterKey: string;
  limit?: number;
  onSettleOutcome?: (outcome: DispatchOutcome, item?: ClaimedQueueItem) => Promise<void>;
}

/**
 * Runs a full dispatch cycle: claims due items, streams to Facebook, settles outcome.
 */
export async function runDispatchCycle(
  params: RunDispatchCycleParams
): Promise<{ processed: number; succeeded: number; failed: number; retried: number }> {
  const { db, masterKey, limit = 10, onSettleOutcome } = params;
  const fbClient = params.fbClient ?? new FacebookPublishClient();

  const claimedItems = await claimDueItems(db, limit);
  let succeeded = 0;
  let failed = 0;
  let retried = 0;

  for (const item of claimedItems) {
    const outcome = await dispatchItem(item, fbClient, masterKey);

    if (onSettleOutcome) {
      await onSettleOutcome(outcome, item);
    } else {
      await settleOutcome(db, item, outcome);
    }

    if (outcome.status === 'published') {
      succeeded++;
    } else if (outcome.status === 'retry') {
      retried++;
    } else {
      failed++;
    }
  }

  return {
    processed: claimedItems.length,
    succeeded,
    failed,
    retried,
  };
}

/**
 * Class implementation of IPublishDispatcher interface.
 */
export class PublishDispatcher implements IPublishDispatcher {
  constructor(
    private readonly db: DispatcherDbClient,
    private readonly fbClient: IFacebookPublishClient,
    private readonly masterKey: string
  ) {}

  async claimDueItems(limit: number = 10): Promise<ClaimedQueueItem[]> {
    return await claimDueItems(this.db, limit);
  }

  async dispatchItem(item: ClaimedQueueItem): Promise<DispatchOutcome> {
    return await dispatchItem(item, this.fbClient, this.masterKey);
  }

  async settleOutcome(outcome: DispatchOutcome, item?: ClaimedQueueItem): Promise<void> {
    if (item) {
      return await settleOutcome(this.db, item, outcome);
    }
    return await recordDispatchOutcome(this.db, outcome);
  }

  async runDispatchCycle(
    limit: number = 10
  ): Promise<{ processed: number; succeeded: number; failed: number; retried: number }> {
    return await runDispatchCycle({
      db: this.db,
      fbClient: this.fbClient,
      masterKey: this.masterKey,
      limit,
    });
  }
}
