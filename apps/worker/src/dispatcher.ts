import {
  type ClaimedQueueItem,
  ClaimedQueueItemSchema,
  type DispatchOutcome,
  type FacebookPageStatus,
  type IFacebookPublishClient,
  type PostFormat,
  decryptToken,
  evaluateGraphApiError,
  UnauthorizedError,
  ValidationError,
} from '@fbuploadpro/contracts';
import { FacebookGraphError, FacebookPublishClient } from './fb-client.js';
import { settleOutcome } from './settlement.js';

export interface Queryable {
  query?<T = unknown>(text: string, params?: unknown[]): Promise<T[] | { rows?: T[] }>;
  rpc?(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
  from?(table: string): any;
}

export interface DispatcherDbClient extends Queryable {
  withTransaction?<T>(callback: (client: Queryable) => Promise<T>): Promise<T>;
}

export const RECOVER_STUCK_ITEMS_SQL = `
UPDATE queue_items
SET status = 'queued', updated_at = now()
WHERE status = 'publishing' AND updated_at <= now() - INTERVAL '10 minutes';
`.trim();

export const CLAIM_DUE_ITEMS_SQL = `
SELECT qi.id, qi.user_id, qi.fb_page_id, qi.media_id, qi.caption, qi.first_comment, qi.retry_count, qi.max_retries,
       m.media_type, m.url as media_url, m.storage_key,
       fp.fb_page_id as external_page_id, fp.encrypted_access_token, fp.page_name
FROM queue_items qi
JOIN media_items m ON m.id = qi.media_id AND m.user_id = qi.user_id
JOIN facebook_pages fp ON fp.id = qi.fb_page_id AND fp.user_id = qi.user_id
WHERE qi.status = 'queued'
  AND qi.scheduled_time <= now()
  AND (
    fp.status = 'active'
    OR (fp.status = 'fb_rate_limited' AND fp.updated_at <= now() - INTERVAL '3 days')
  )
ORDER BY qi.scheduled_time ASC
LIMIT $1
FOR UPDATE SKIP LOCKED;
`.trim();

export const UPDATE_CLAIMED_STATUS_SQL = `
UPDATE queue_items
SET status = 'publishing', updated_at = now()
WHERE id = ANY($1);
`.trim();

// --- Dispatch retry/backoff tuning ---
const DISPATCH_RETRY_BASE_DELAY_SECONDS = 300;
const DISPATCH_RETRY_MAX_DELAY_SECONDS = 3600;
const FIRST_COMMENT_RETRY_DELAY_MS = 500;

function extractRows<T = unknown>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === 'object' && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function toSafeString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') {
    return val.toString();
  }
  if (typeof val === 'object' && val !== null) {
    try {
      return JSON.stringify(val);
    } catch {
      return '';
    }
  }
  return '';
}

function resolveClaimedMediaUrl(mediaUrl: unknown, postFormat: string): string | null {
  if (mediaUrl != null) return toSafeString(mediaUrl);
  return postFormat === 'text' ? null : '';
}

function resolveClaimedStorageKey(storageKey: unknown, postFormat: string): string | null {
  if (storageKey != null) return toSafeString(storageKey);
  return postFormat === 'text' ? null : '';
}

function mapRowToClaimedQueueItem(row: Record<string, unknown>): ClaimedQueueItem {
  const postFormat =
    (row.post_format as PostFormat | undefined) ??
    (row.media_type === 'image' ? 'image' : 'reel');

  return ClaimedQueueItemSchema.parse({
    id: row.id,
    userId: row.user_id,
    pageId: row.fb_page_id,
    facebookAccountId:
      row.facebook_account_id != null ? toSafeString(row.facebook_account_id) : undefined,
    mediaId: row.media_id != null ? toSafeString(row.media_id) : null,
    postFormat,
    linkUrl: row.link_url != null ? toSafeString(row.link_url) : null,
    caption: toSafeString(row.caption),
    firstComment: row.first_comment != null ? toSafeString(row.first_comment) : null,
    retryCount: Number(row.retry_count ?? 0),
    maxRetries: Number(row.max_retries ?? 3),
    mediaType: row.media_type ?? (postFormat === 'text' ? null : 'video'),
    mediaUrl: resolveClaimedMediaUrl(row.media_url, postFormat),
    storageKey: resolveClaimedStorageKey(row.storage_key, postFormat),
    fbPageId: toSafeString(row.page_external_id ?? row.external_page_id ?? row.fb_page_id),
    encryptedPageToken: toSafeString(
      row.encrypted_page_token ?? row.encrypted_access_token
    ),
    pageName: toSafeString(row.page_name ?? ''),
  });
}

/**
 * Claims due queue items atomically using PostgreSQL stored procedure or FOR UPDATE SKIP LOCKED.
 * Transitions claimed items to status 'publishing'.
 */
export async function claimDueItems(
  db: DispatcherDbClient,
  limit: number = 10,
  maxPerPage: number = 3
): Promise<ClaimedQueueItem[]> {
  // 1. Supabase RPC claim_due_queue_items stored procedure
  if (typeof db.rpc === 'function') {
    const rpcArgs: Record<string, unknown> = { p_limit: limit };
    if (maxPerPage !== 3) {
      rpcArgs.p_max_per_page = maxPerPage;
    }
    const { data, error } = await db.rpc('claim_due_queue_items', rpcArgs);
    if (error) {
      console.error('[claimDueItems] Supabase RPC error:', error);
      throw error;
    }
    const rows = (data || []) as Record<string, unknown>[];
    return rows.map(mapRowToClaimedQueueItem);
  }

  // 2. Queryable fallback for testing/mock clients
  const executeClaim = async (client: Queryable): Promise<ClaimedQueueItem[]> => {
    if (typeof client.query !== 'function') return [];
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

function isRateLimitErrorCode(code?: number, subcode?: number): boolean {
  if (code === undefined) return false;
  if (code === 4 || code === 17 || code === 32 || code === 341 || code === 613) {
    return true;
  }
  if (code === 368 && subcode === 1390008) {
    return true;
  }
  if (code >= 80000 && code <= 80014) {
    return true;
  }
  return false;
}

async function postFirstCommentWithRetry(
  fbClient: IFacebookPublishClient,
  params: {
    postId: string;
    accessToken: string;
    message: string;
    itemId: string;
  },
  attempt = 1,
  maxAttempts = 3
): Promise<{ commentId: string | null; warning: string | null }> {
  try {
    const commentRes = await fbClient.postComment({
      postId: params.postId,
      accessToken: params.accessToken,
      message: params.message,
    });
    return { commentId: commentRes.commentId, warning: null };
  } catch (commentErr: unknown) {
    if (attempt >= maxAttempts) {
      const errMsg = commentErr instanceof Error ? commentErr.message : String(commentErr);
      console.warn(
        `[Dispatcher] First comment failed for queue item ${params.itemId} (post ${params.postId}):`,
        commentErr
      );
      return {
        commentId: null,
        warning: `Published post but first comment failed: ${errMsg}`,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * FIRST_COMMENT_RETRY_DELAY_MS));
    return postFirstCommentWithRetry(fbClient, params, attempt + 1, maxAttempts);
  }
}

/**
 * Dispatches a claimed queue item to Facebook Graph API v26.0 based on its post format:
 * 'text', 'image', 'reel', 'video', or 'story'.
 */
export async function dispatchItem(
  item: ClaimedQueueItem,
  fbClient: IFacebookPublishClient,
  masterKey: string,
  maxRetries: number = 3
): Promise<DispatchOutcome> {
  const effectiveMaxRetries = item.maxRetries ?? maxRetries;
  const format: PostFormat =
    item.postFormat ?? (item.mediaType === 'image' ? 'image' : 'reel');

  // 1. Decrypt page access token
  let accessToken: string;
  try {
    const decrypted = await decryptToken(item.encryptedPageToken, masterKey, { allowEmpty: true });
    if (!decrypted) {
      throw new UnauthorizedError('Access token is missing or page is soft-deleted');
    }
    accessToken = decrypted;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const outcome: DispatchOutcome = {
      queueItemId: item.id,
      status: 'failed',
      errorMessage: `Token decryption failed: ${errorMessage}`,
    };
    return outcome;
  }

  // 2. Publish post according to format
  let publishResult: { postId: string; telemetry?: any };
  try {
    switch (format) {
      case 'text': {
        if (typeof fbClient.publishTextPost === 'function') {
          publishResult = await fbClient.publishTextPost({
            pageId: item.fbPageId,
            accessToken,
            message: item.caption,
            linkUrl: item.linkUrl,
          });
        } else {
          throw new TypeError('Facebook client does not support publishTextPost');
        }
        break;
      }

      case 'image': {
        if (!item.mediaUrl) {
          throw new ValidationError('Media URL is required for image publishing');
        }
        publishResult = await fbClient.publishPhoto({
          pageId: item.fbPageId,
          accessToken,
          imageUrl: item.mediaUrl,
          caption: item.caption,
        });
        break;
      }

      case 'reel': {
        if (!item.mediaUrl) {
          throw new ValidationError('Media URL is required for reel publishing');
        }
        publishResult = await fbClient.publishReel({
          pageId: item.fbPageId,
          accessToken,
          videoUrl: item.mediaUrl,
          caption: item.caption,
        });
        break;
      }

      case 'video': {
        if (!item.mediaUrl) {
          throw new ValidationError('Media URL is required for video publishing');
        }
        if (typeof fbClient.publishVideo === 'function') {
          publishResult = await fbClient.publishVideo({
            pageId: item.fbPageId,
            accessToken,
            videoUrl: item.mediaUrl,
            caption: item.caption,
          });
        } else {
          publishResult = await fbClient.publishReel({
            pageId: item.fbPageId,
            accessToken,
            videoUrl: item.mediaUrl,
            caption: item.caption,
          });
        }
        break;
      }

      case 'story': {
        if (!item.mediaUrl) {
          throw new ValidationError('Media URL is required for story publishing');
        }
        if (item.mediaType === 'image') {
          if (typeof fbClient.publishPhotoStory === 'function') {
            publishResult = await fbClient.publishPhotoStory({
              pageId: item.fbPageId,
              accessToken,
              imageUrl: item.mediaUrl,
            });
          } else {
            throw new TypeError('Facebook client does not support publishPhotoStory');
          }
        } else if (typeof fbClient.publishVideoStory === 'function') {
          publishResult = await fbClient.publishVideoStory({
            pageId: item.fbPageId,
            accessToken,
            videoUrl: item.mediaUrl,
          });
        } else {
          throw new TypeError('Facebook client does not support publishVideoStory');
        }
        break;
      }

      default: {
        throw new ValidationError(`Unsupported post format: ${String(format)}`);
      }
    }
  } catch (err: unknown) {
    let errorCode: number | undefined;
    let errorSubcode: number | undefined;
    let graphTelemetry: any;

    if (err instanceof FacebookGraphError) {
      errorCode = err.code;
      errorSubcode = err.errorSubcode;
      graphTelemetry = err.telemetry;
    } else if (typeof (err as { code?: number })?.code === 'number') {
      errorCode = (err as { code: number }).code;
    }

    const isAuthError = err instanceof FacebookGraphError ? err.isAuthError : false;
    const isPermanentPolicyError =
      err instanceof FacebookGraphError ? err.isPermanentPolicyError : false;
    const isPermanentClientError =
      err instanceof FacebookGraphError
        ? err.isPermanentClientError
        : errorCode === 100 ||
          (typeof errorCode === 'number' && errorCode >= 400 && errorCode < 500 && !isAuthError);
    const rawMessage = err instanceof Error ? err.message : String(err);

    const evaluation =
      errorCode !== undefined ? evaluateGraphApiError(errorCode, errorSubcode) : null;

    let targetPageStatus: FacebookPageStatus | undefined;
    if (evaluation?.pageStatus && evaluation.pageStatus !== 'active') {
      targetPageStatus = evaluation.pageStatus as FacebookPageStatus;
    } else if (errorCode === 368 && errorSubcode === 1390008) {
      targetPageStatus = 'fb_rate_limited';
    }

    let targetAccountStatus: 'active' | 'expired' | undefined;
    const isAccountExpired =
      ((evaluation as any)?.accountStatus === 'expired') ||
      (isAuthError && (errorCode === 190 || errorCode === 102));
    if (isAccountExpired) {
      targetAccountStatus = 'expired';
    }

    const errorMessage =
      errorCode === 368 && (errorSubcode === 4854002 || errorSubcode === 1404082) && evaluation
        ? evaluation.message
        : rawMessage;

    const isRateLimit = isRateLimitErrorCode(errorCode, errorSubcode);
    const isTransient = evaluation?.isTransient || isRateLimit || (!isAuthError && !isPermanentPolicyError && !isPermanentClientError);

    const canRetry = isTransient && item.retryCount < effectiveMaxRetries;

    let retryDelaySeconds: number | undefined;
    let pageCooldownSeconds: number | undefined;

    if (canRetry) {
      if (graphTelemetry?.estimatedTimeToRegainAccessMinutes && graphTelemetry.estimatedTimeToRegainAccessMinutes > 0) {
        retryDelaySeconds = graphTelemetry.estimatedTimeToRegainAccessMinutes * 60;
      } else {
        retryDelaySeconds = Math.min(DISPATCH_RETRY_MAX_DELAY_SECONDS, DISPATCH_RETRY_BASE_DELAY_SECONDS * Math.pow(2, item.retryCount || 0));
      }

      if (isRateLimit) {
        pageCooldownSeconds = retryDelaySeconds;
      }
    }

    const outcome: DispatchOutcome = {
      queueItemId: item.id,
      status: canRetry ? 'retry' : 'failed',
      errorMessage,
      ...(errorCode !== undefined ? { errorCode } : {}),
      ...(errorSubcode !== undefined ? { errorSubcode } : {}),
      ...(targetPageStatus !== undefined ? { targetPageStatus } : {}),
      ...(targetAccountStatus !== undefined ? { targetAccountStatus } : {}),
      ...(retryDelaySeconds !== undefined ? { retryDelaySeconds } : {}),
      ...(pageCooldownSeconds !== undefined ? { pageCooldownSeconds } : {}),
    };
    return outcome;
  }

  // 3. Automated first comment (strictly forbidden on 'story')
  let fbCommentId: string | undefined;
  let commentWarning: string | undefined;

  if (format !== 'story' && item.firstComment && item.firstComment.trim().length > 0) {
    const outcome = await postFirstCommentWithRetry(fbClient, {
      postId: publishResult.postId,
      accessToken,
      message: item.firstComment.trim(),
      itemId: item.id,
    });
    fbCommentId = outcome.commentId ?? undefined;
    commentWarning = outcome.warning ?? undefined;
  }

  // 4. Proactive telemetry pacing check
  let bucUsagePct: number | undefined;
  let pageCooldownSeconds: number | undefined;

  if (
    publishResult.telemetry?.bucUsageMaxPct !== undefined &&
    publishResult.telemetry.bucUsageMaxPct !== null
  ) {
    const usage = publishResult.telemetry.bucUsageMaxPct;
    bucUsagePct = usage;
    if (usage >= 85) {
      const waitMins = publishResult.telemetry.estimatedTimeToRegainAccessMinutes || 5;
      pageCooldownSeconds = waitMins * 60;
    }
  }

  const outcome: DispatchOutcome = {
    queueItemId: item.id,
    status: 'published',
    fbPostId: publishResult.postId,
    ...(fbCommentId !== undefined ? { fbCommentId } : {}),
    ...(commentWarning ? { errorMessage: commentWarning } : {}),
    ...(bucUsagePct !== undefined ? { bucUsagePct } : {}),
    ...(pageCooldownSeconds !== undefined ? { pageCooldownSeconds } : {}),
  };
  return outcome;
}

export interface RunDispatchCycleParams {
  db: DispatcherDbClient;
  fbClient?: IFacebookPublishClient;
  masterKey: string;
  limit?: number;
  concurrency?: number;
  onSettleOutcome?: (outcome: DispatchOutcome, item?: ClaimedQueueItem) => Promise<void>;
}

/**
 * Runs a full dispatch cycle: claims due items, streams to Facebook with bounded parallel pool, settles outcomes.
 */
export async function runDispatchCycle(
  params: RunDispatchCycleParams
): Promise<{ processed: number; succeeded: number; failed: number; retried: number }> {
  const { db, masterKey, limit = 10, concurrency = 25, onSettleOutcome } = params;
  const fbClient = params.fbClient ?? new FacebookPublishClient();

  const claimedItems = await claimDueItems(db, limit);
  let succeeded = 0;
  let failed = 0;
  let retried = 0;

  if (claimedItems.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, retried: 0 };
  }

  const poolLimit = Math.max(1, Math.min(concurrency, claimedItems.length));
  let cursor = 0;

  const workers = Array.from({ length: poolLimit }, async () => {
    while (cursor < claimedItems.length) {
      const idx = cursor++;
      const item = claimedItems[idx];
      const outcome = await dispatchItem(item, fbClient, masterKey);

      if (onSettleOutcome) {
        await onSettleOutcome(outcome, item);
      } else {
        await settleOutcome(db, item, outcome);
      }

      if (outcome.status === 'published') {
        succeeded++;
      } else if (outcome.status === 'retry' || outcome.status === 'queued') {
        retried++;
      } else {
        failed++;
      }
    }
  });

  await Promise.all(workers);

  return {
    processed: claimedItems.length,
    succeeded,
    failed,
    retried,
  };
}
