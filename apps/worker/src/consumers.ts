import {
  decryptToken,
  type DatabaseDestinationRow,
  type DatabaseSocialAccountRow,
  type DatabaseUnifiedQueueItemRow,
  type Platform,
  type PublishLane,
  type PublishOutcome,
  type PublisherRegistry,
  type SettleQueueItemOutcomeUnifiedArgs,
} from '@fbuploadpro/contracts';
import { captureWorkerError, type PostHogEnv } from './analytics.js';
import { recordHeartbeat } from './heartbeat.js';
import type { PublishQueueMessage } from './claimer.js';

// ==========================================
// Queue consumers (spec 121 Scope 5) + DLQ consumers (Scope 6)
// ==========================================
//
// Publish consumers run per queue message: load the CURRENT row state
// (a cancelled/edited/settled item is honoured, never published from a
// stale message), decrypt the stored tokens, call the registered
// platform `Publisher`, and settle through the unified
// `settle_queue_item_outcome` RPC — which writes a `publish_logs` row on
// every attempt.
//
// Consumers contain ZERO token-refresh calls (spec 121 D6): an
// auth-classified outcome settles `failed` with the account-expired
// cascade carried in the settle args; the separate token-refresh job is
// the sole owner of token rotation.
//
// Error semantics: an unexpected throw (publisher bug, DB failure,
// decrypt failure, settle failure) is NOT caught-and-acked. The message
// stays un-acked, the batch handler rethrows, and Cloudflare Queues
// retries the message with backoff until it lands in the lane DLQ.

export const PUBLISH_FAST_QUEUE_NAME = 'publish-fast';
export const PUBLISH_HEAVY_QUEUE_NAME = 'publish-heavy';
export const PUBLISH_FAST_DLQ_NAME = 'publish-fast-dlq';
export const PUBLISH_HEAVY_DLQ_NAME = 'publish-heavy-dlq';

/** Fallback backoff for a `retry` outcome with no publisher-supplied delay. */
export const DEFAULT_RETRY_DELAY_SECONDS = 300;

/** Error code settled onto items that exhaust queue retries into a DLQ. */
export const DLQ_ERROR_CODE = 'queue_dlq_exhausted';

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'published',
  'failed',
  'cancelled',
]);

export interface ConsumerDbClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): Promise<{ data: unknown; error: unknown }>;
  from(table: string): RowQueryBuilder;
}

export interface RowQueryBuilder {
  select(columns: string): RowQueryBuilder;
  eq(column: string, value: unknown): RowQueryBuilder;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
}

export interface ConsumerDeps {
  db: ConsumerDbClient;
  registry: PublisherRegistry;
  masterKey?: string | undefined;
  env?: PostHogEnv;
}

export interface DlqConsumerDeps {
  db: ConsumerDbClient;
  env?: PostHogEnv;
}

function isPublishQueueMessage(body: unknown): body is PublishQueueMessage {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as Partial<PublishQueueMessage>;
  return (
    typeof candidate.itemId === 'string' &&
    typeof candidate.platform === 'string' &&
    typeof candidate.lane === 'string'
  );
}

async function loadRowById(
  db: ConsumerDbClient,
  table: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db.from(table).select('*').eq('id', id).maybeSingle();
  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  return (data as Record<string, unknown> | null) ?? null;
}

/** Counts-only heartbeat write; the consumer DB handle is the supabase client at runtime. */
async function writeHeartbeatCounts(
  db: ConsumerDbClient,
  record: { settled?: number; dlqFast?: number; dlqHeavy?: number }
): Promise<void> {
  await recordHeartbeat(db as never, { success: true, countsOnly: true, ...record });
}

async function callSettleRpc(
  db: ConsumerDbClient,
  args: SettleQueueItemOutcomeUnifiedArgs
): Promise<void> {
  const { error } = await db.rpc(
    'settle_queue_item_outcome',
    args as unknown as Record<string, unknown>
  );
  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Maps a publisher's unified `PublishOutcome` onto the 16-arg unified
 * `settle_queue_item_outcome` RPC (migration 20261022120000 §6b, TEXT
 * error codes):
 *   - `published` → outcome `published`; platform post/comment ids are
 *     passed in the RPC's id fields (they land on the queue item and in
 *     the `publish_logs` row the RPC writes).
 *   - `retry` → outcome `queued` with the publisher's retry delay
 *     (falling back to the error's backoff hint, then the default).
 *   - `failed` → outcome `failed`; an `auth`-classified error with no
 *     explicit account status still cascades the account to `expired`
 *     via `p_target_account_status` — settled by the RPC, never by a
 *     consumer-side refresh attempt.
 *
 * `p_retry_count` convention (matching the RPC, which derives the log's
 * attempt number as `p_retry_count + 1` and stores `p_retry_count` as
 * the item's new retry count on non-published outcomes): published
 * passes the item's current count so the logged attempt number is
 * exact; retry/failed pass the incremented count so the stored retry
 * count advances.
 */
export function mapPublishOutcomeToSettleArgs(
  item: DatabaseUnifiedQueueItemRow,
  outcome: PublishOutcome
): SettleQueueItemOutcomeUnifiedArgs {
  const base: SettleQueueItemOutcomeUnifiedArgs = {
    p_queue_item_id: item.id,
    p_workspace_id: item.workspace_id,
    p_destination_id: item.destination_id,
    p_outcome_status: 'failed',
    p_external_post_id: outcome.externalPostId ?? null,
    p_external_comment_id: outcome.externalCommentId ?? null,
    p_retry_count: item.retry_count,
    p_retry_delay_seconds: DEFAULT_RETRY_DELAY_SECONDS,
    p_error_code: outcome.error?.code ?? null,
    p_error_subcode: outcome.error?.subcode ?? null,
    p_error_message: outcome.error?.message ?? null,
    p_comment_warning: outcome.commentWarning ?? null,
    p_target_destination_status: outcome.targetDestinationStatus ?? null,
    p_target_account_status: outcome.targetAccountStatus ?? null,
    p_destination_cooldown_seconds: outcome.destinationCooldownSeconds ?? null,
    p_rate_usage_pct:
      outcome.rateUsagePct !== undefined ? Math.round(outcome.rateUsagePct) : null,
  };

  if (outcome.status === 'published') {
    return { ...base, p_outcome_status: 'published' };
  }

  if (outcome.status === 'retry') {
    return {
      ...base,
      p_outcome_status: 'queued',
      p_retry_count: item.retry_count + 1,
      p_retry_delay_seconds:
        outcome.retryDelaySeconds ??
        outcome.error?.retryDelaySeconds ??
        DEFAULT_RETRY_DELAY_SECONDS,
    };
  }

  return {
    ...base,
    p_outcome_status: 'failed',
    p_retry_count: item.retry_count + 1,
    p_target_account_status:
      outcome.targetAccountStatus ??
      (outcome.error?.kind === 'auth' ? 'expired' : null),
  };
}

/** Settle args for a DLQ arrival: `failed` with the DLQ reason. */
export function buildDlqSettleArgs(
  item: DatabaseUnifiedQueueItemRow,
  queueName: string,
  attempts: number
): SettleQueueItemOutcomeUnifiedArgs {
  return {
    p_queue_item_id: item.id,
    p_workspace_id: item.workspace_id,
    p_destination_id: item.destination_id,
    p_outcome_status: 'failed',
    p_external_post_id: null,
    p_external_comment_id: null,
    p_retry_count: item.retry_count + 1,
    p_retry_delay_seconds: DEFAULT_RETRY_DELAY_SECONDS,
    p_error_code: DLQ_ERROR_CODE,
    p_error_subcode: null,
    p_error_message:
      `Publish message exhausted queue retries (${attempts} attempt${attempts === 1 ? '' : 's'}) ` +
      `and was moved to ${queueName}; settled as failed.`,
    p_comment_warning: null,
    p_target_destination_status: null,
    p_target_account_status: null,
    p_destination_cooldown_seconds: null,
    p_rate_usage_pct: null,
  };
}

type ProcessResult = 'settled' | 'skipped';

async function processPublishMessage(
  message: Message<PublishQueueMessage>,
  deps: ConsumerDeps
): Promise<ProcessResult> {
  const body = message.body;
  if (!isPublishQueueMessage(body)) {
    throw new Error('Malformed publish queue message body');
  }

  const itemRow = await loadRowById(deps.db, 'queue_items', body.itemId);
  if (!itemRow) {
    console.warn(`[consumer] queue item ${body.itemId} no longer exists; skipping`);
    return 'skipped';
  }
  const item = itemRow as unknown as DatabaseUnifiedQueueItemRow;

  // Current state is honoured: anything no longer in `publishing`
  // (cancelled, edited back to queued, already settled) is skipped.
  if (item.status !== 'publishing') {
    return 'skipped';
  }

  const destinationRow = await loadRowById(deps.db, 'destinations', item.destination_id);
  if (!destinationRow) {
    throw new Error(`Destination ${item.destination_id} for queue item ${item.id} not found`);
  }
  const destination = destinationRow as unknown as DatabaseDestinationRow;

  const accountRow = await loadRowById(deps.db, 'social_accounts', destination.account_id);
  if (!accountRow) {
    throw new Error(`Social account ${destination.account_id} for queue item ${item.id} not found`);
  }
  const account = accountRow as unknown as DatabaseSocialAccountRow;

  const publisher = deps.registry.get(item.platform);
  if (!publisher) {
    throw new Error(`No publisher registered for platform "${item.platform}"`);
  }

  if (!deps.masterKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not configured');
  }
  const masterKey = deps.masterKey;

  const tokens = {
    accessToken: await decryptToken(account.encrypted_access_token, masterKey),
    refreshToken: account.encrypted_refresh_token
      ? await decryptToken(account.encrypted_refresh_token, masterKey)
      : null,
    destinationToken: destination.encrypted_destination_token
      ? await decryptToken(destination.encrypted_destination_token, masterKey)
      : null,
    tokenExpiresAt: account.token_expires_at ?? null,
  };

  const outcome = await publisher.publish(item, destination, tokens);
  await callSettleRpc(deps.db, mapPublishOutcomeToSettleArgs(item, outcome));
  return 'settled';
}

/**
 * Handles one publish-lane batch (publish-fast / publish-heavy).
 * Messages that settle or are legitimately skipped are acked; a message
 * whose processing throws stays un-acked and the handler rethrows after
 * the batch so Cloudflare Queues retries it with backoff.
 */
export async function handlePublishBatch(
  batch: MessageBatch<PublishQueueMessage>,
  deps: ConsumerDeps
): Promise<void> {
  let settled = 0;
  const failures: unknown[] = [];

  for (const message of batch.messages) {
    try {
      const result = await processPublishMessage(message, deps);
      if (result === 'settled') settled++;
      message.ack();
    } catch (err) {
      console.error(
        `[consumer] publish message ${message.id} failed; leaving un-acked for queue retry:`,
        err
      );
      failures.push(err);
    }
  }

  if (settled > 0) {
    await writeHeartbeatCounts(deps.db, { settled });
  }

  if (failures.length > 0) {
    throw failures[0];
  }
}

async function processDlqMessage(
  message: Message<PublishQueueMessage>,
  queueName: string,
  deps: DlqConsumerDeps
): Promise<void> {
  const env = deps.env ?? {};
  const body = message.body as Partial<PublishQueueMessage> | undefined;
  if (!body || typeof body.itemId !== 'string') {
    captureWorkerError(env, new Error('DLQ message with malformed body'), {
      site: 'handleDlqBatch',
      kind: 'malformed_dlq_message',
      queue: queueName,
    });
    console.error(`[dlq] malformed message ${message.id} on ${queueName}; acking`);
    return;
  }

  let item: DatabaseUnifiedQueueItemRow;
  try {
    const itemRow = await loadRowById(deps.db, 'queue_items', body.itemId);
    if (!itemRow) {
      captureWorkerError(
        env,
        new Error(`DLQ message references missing queue item ${body.itemId}`),
        { site: 'handleDlqBatch', kind: 'dlq_item_missing', queue: queueName }
      );
      console.error(`[dlq] queue item ${body.itemId} not found (${queueName}); acking`);
      return;
    }
    item = itemRow as unknown as DatabaseUnifiedQueueItemRow;
  } catch (err) {
    captureWorkerError(env, err, {
      site: 'handleDlqBatch',
      kind: 'dlq_item_load_failed',
      queue: queueName,
    });
    console.error(`[dlq] failed to load queue item ${body.itemId} (${queueName}):`, err);
    return;
  }

  // Every DLQ arrival is loud: a PostHog exception, whether the item
  // still needs settlement or already reached a terminal state.
  captureWorkerError(
    env,
    new Error(
      `Publish message for queue item ${item.id} landed in ${queueName} after exhausting retries`
    ),
    {
      site: 'handleDlqBatch',
      kind: 'dlq_arrival',
      queue: queueName,
      queueItemId: item.id,
      platform: item.platform satisfies Platform,
      attempts: message.attempts,
    }
  );

  if (TERMINAL_STATUSES.has(item.status)) {
    return;
  }

  try {
    await callSettleRpc(
      deps.db,
      buildDlqSettleArgs(item, queueName, message.attempts)
    );
  } catch (err) {
    // Loud, but acked anyway (handled by the caller): a DLQ message must
    // not loop forever. The stuck-`publishing` recovery sweep remains
    // the backstop for the item itself.
    captureWorkerError(env, err, {
      site: 'handleDlqBatch',
      kind: 'dlq_settlement_failed',
      queue: queueName,
      queueItemId: item.id,
    });
    console.error(`[dlq] settlement failed for queue item ${item.id} (${queueName}):`, err);
  }
}

/**
 * Handles one DLQ batch (publish-fast-dlq / publish-heavy-dlq): settles
 * each non-terminal item `failed` with the DLQ reason, raises a PostHog
 * exception per arrival, counts the batch toward the heartbeat DLQ
 * counters, and acks every message after its settlement attempt.
 */
export async function handleDlqBatch(
  batch: MessageBatch<PublishQueueMessage>,
  deps: DlqConsumerDeps
): Promise<void> {
  const queueName = batch.queue;
  const lane: PublishLane =
    queueName === PUBLISH_HEAVY_DLQ_NAME ? 'publish-heavy' : 'publish-fast';

  for (const message of batch.messages) {
    try {
      await processDlqMessage(message, queueName, deps);
    } catch (err) {
      captureWorkerError(deps.env ?? {}, err, {
        site: 'handleDlqBatch',
        kind: 'unexpected',
        queue: queueName,
      });
      console.error(`[dlq] unexpected error processing message ${message.id}:`, err);
    } finally {
      message.ack();
    }
  }

  await writeHeartbeatCounts(
    deps.db,
    lane === 'publish-fast'
      ? { dlqFast: batch.messages.length }
      : { dlqHeavy: batch.messages.length }
  );
}

/** Dispatches a queue batch by queue name (the worker's `queue()` handler). */
export async function handleQueueBatch(
  batch: MessageBatch<PublishQueueMessage>,
  deps: ConsumerDeps & DlqConsumerDeps
): Promise<void> {
  switch (batch.queue) {
    case PUBLISH_FAST_QUEUE_NAME:
    case PUBLISH_HEAVY_QUEUE_NAME:
      return handlePublishBatch(batch, deps);
    case PUBLISH_FAST_DLQ_NAME:
    case PUBLISH_HEAVY_DLQ_NAME:
      return handleDlqBatch(batch, deps);
    default:
      console.error(`[consumer] unknown queue "${batch.queue}"; leaving batch un-acked`);
      throw new Error(`Unknown queue: ${batch.queue}`);
  }
}
