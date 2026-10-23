import {
  getLaneKindSet,
  InternalError,
  PUBLISH_LANE_FAST,
  PUBLISH_LANE_HEAVY,
  type Platform,
  type PublishLane,
  type PublisherRegistry,
} from '@fbuploadpro/contracts';
import { captureWorkerError, type PostHogEnv } from './analytics.js';

// ==========================================
// Claimer (spec 121 Scope 3 + Scope 6 recovery)
// ==========================================
//
// The scheduled tick ONLY claims and enqueues — it never publishes.
// Per tick, for each lane and each platform REGISTERED in the publisher
// registry, it loops claim rounds against the unified
// `claim_due_queue_items` RPC and `sendBatch`es the claimed rows to the
// lane's Cloudflare Queue. Platforms without a registered publisher are
// not claimable traffic yet (their items stay `queued` until their
// platform spec registers a publisher — Facebook lands in spec 122).

/** Rows requested per claim round (spec 121: batch 500/round). */
export const CLAIM_ROUND_LIMIT = 500;

/** Per-destination fairness cap passed to the claim RPC (as today). */
export const CLAIM_MAX_PER_DESTINATION = 3;

/**
 * Per-tick round cap, per (platform, lane).
 *
 * TUNED 4 → 1 by the spec 122 load-proof harness (see
 * apps/worker/load-harness/results/): the original arithmetic assumed
 * ~250 ms per claim RPC, sized for a one-platform registry. Measured on
 * the harness database at a 1M-item backlog, one unified
 * `claim_due_queue_items` call costs ~1.1–1.6 s (the D5-amended RPC makes
 * three passes over the due set), independent of the round limit. With
 * six registered platforms a tick runs 12 (platform, lane) pairs, so a
 * cap of 4 meant up to 48 sequential claim RPCs ≈ 55–75 s per tick —
 * over the < 30 s tick criterion (spec 119 §5.2) at depth. At a cap of
 * 1 a tick is ≤ 12 claim RPCs, and claim capacity is still
 * 12 × 500 = 6,000 items/tick ≈ 8.6M items/day at the 1-minute tick
 * cadence — far above the consumer drain rate the harness certifies.
 * The cap bounds tick duration independently of backlog depth:
 * un-claimed backlog simply stays `queued` for the next tick, and
 * consumers drain the queues in parallel.
 */
export const MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK = 1;

/** Cloudflare Queues `sendBatch` accepts at most 100 messages per call. */
export const SEND_BATCH_CHUNK_SIZE = 100;

/** How often (in minutes) the stuck-`publishing` recovery sweep runs. */
export const RECOVERY_INTERVAL_MINUTES = 5;

/** Stuck-`publishing` threshold for the recovery sweep, in minutes. */
export const RECOVERY_TIMEOUT_MINUTES = 10;

/** Every platform in the unified schema enum — recovery is table hygiene. */
export const ALL_PLATFORMS: readonly Platform[] = [
  'facebook',
  'instagram',
  'threads',
  'youtube',
  'x',
  'tiktok',
];

/** Queue message payload: the item id plus fields derivable from its row. Never tokens or media bytes. */
export interface PublishQueueMessage {
  itemId: string;
  platform: Platform;
  lane: PublishLane;
}

export interface ClaimerDbClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>
  ): Promise<{ data: unknown; error: unknown }>;
}

export interface LaneQueueProducer {
  sendBatch(
    messages: Iterable<MessageSendRequest<PublishQueueMessage>>
  ): Promise<unknown>;
}

export interface ClaimerQueues {
  fast?: LaneQueueProducer | undefined;
  heavy?: LaneQueueProducer | undefined;
}

export interface ClaimTickDeps {
  db: ClaimerDbClient;
  registry: PublisherRegistry;
  queues: ClaimerQueues;
  /** PostHog env for recovery-error capture; optional in tests. */
  env?: PostHogEnv;
  /** Tick time; defaults to now. Drives the every-5th-tick recovery cadence. */
  now?: Date;
  /**
   * `ctx.waitUntil` from the scheduled handler (spec 139): threaded to
   * every `captureWorkerError` call so PostHog captures are not lost
   * when the isolate would otherwise terminate after the handler returns.
   */
  waitUntil?: ((promise: Promise<unknown>) => void) | undefined;
}

export interface ClaimTickResult {
  claimed: number;
  enqueuedFast: number;
  enqueuedHeavy: number;
  recovered: number;
}

interface ClaimedRow {
  id: string;
}

function queueForLane(queues: ClaimerQueues, lane: PublishLane): LaneQueueProducer {
  const queue = lane === PUBLISH_LANE_FAST ? queues.fast : queues.heavy;
  if (!queue) {
    throw new InternalError(
      `Queue producer binding for lane "${lane}" is not configured`
    );
  }
  return queue;
}

/** Mark an error as already captured so the per-pair wrapper does not double-report it. */
function markCaptured(err: unknown): void {
  if (err && typeof err === 'object') {
    (err as { __workerCaptured?: boolean }).__workerCaptured = true;
  }
}

function isCaptured(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && (err as { __workerCaptured?: boolean }).__workerCaptured
  );
}

async function claimAndEnqueueLane(
  deps: ClaimTickDeps,
  platform: Platform,
  lane: PublishLane,
  result: ClaimTickResult
): Promise<void> {
  const queue = queueForLane(deps.queues, lane);
  const kindSet = getLaneKindSet(platform, lane);
  if (kindSet.length === 0) return;

  for (let round = 0; round < MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK; round++) {
    const { data, error } = await deps.db.rpc('claim_due_queue_items', {
      p_platform: platform,
      p_lane_kind_set: kindSet,
      p_limit: CLAIM_ROUND_LIMIT,
      p_max_per_destination: CLAIM_MAX_PER_DESTINATION,
    });
    if (error) {
      const claimError = error instanceof Error ? error : new Error(String(error));
      captureWorkerError(
        deps.env ?? {},
        claimError,
        { site: 'runClaimTick', kind: 'claim_rpc_error', platform, lane },
        deps.waitUntil
      );
      markCaptured(claimError);
      throw claimError;
    }
    const rows = (Array.isArray(data) ? data : []) as ClaimedRow[];
    if (rows.length === 0) return;

    result.claimed += rows.length;

    // The claiming lane is authoritative at enqueue time: an item is
    // enqueued to the lane under whose kind set it was claimed. (The
    // contracts kind sets are kind-only — forced by the claim RPC
    // signature — while routePublishLaneForItem remains the per-item
    // truth for consumers/diagnostics.)
    const messages: PublishQueueMessage[] = rows.map((row) => ({
      itemId: row.id,
      platform,
      lane,
    }));
    for (let i = 0; i < messages.length; i += SEND_BATCH_CHUNK_SIZE) {
      const chunk = messages.slice(i, i + SEND_BATCH_CHUNK_SIZE);
      try {
        await queue.sendBatch(chunk.map((body) => ({ body })));
      } catch (err) {
        // Per-chunk progress (spec 139): `result` already counts only
        // the chunks that succeeded, so log the exact gap here — the
        // claimed-but-not-enqueued remainder is diagnosable from this
        // line / capture, and is backstopped by the recovery sweep
        // (claimed rows stuck in `publishing` return to `queued`).
        const enqueuedForLane =
          lane === PUBLISH_LANE_FAST ? result.enqueuedFast : result.enqueuedHeavy;
        // Chunks before offset `i` in this round already went out, so
        // the not-yet-enqueued remainder of this round is messages - i.
        console.error(
          `[claimer] sendBatch failed platform=${platform} lane=${lane} chunkOffset=${i} chunkSize=${chunk.length} claimedTotal=${result.claimed} enqueuedForLane=${enqueuedForLane} claimedButNotEnqueuedThisRound=${messages.length - i}`,
          err
        );
        captureWorkerError(
          deps.env ?? {},
          err,
          {
            site: 'runClaimTick',
            kind: 'send_batch_failed',
            platform,
            lane,
            chunkOffset: i,
            chunkSize: chunk.length,
            claimedTotal: result.claimed,
            enqueuedFast: result.enqueuedFast,
            enqueuedHeavy: result.enqueuedHeavy,
          },
          deps.waitUntil
        );
        markCaptured(err);
        throw err;
      }
      if (lane === PUBLISH_LANE_FAST) {
        result.enqueuedFast += chunk.length;
      } else {
        result.enqueuedHeavy += chunk.length;
      }
      // Record per-chunk enqueue progress so a later chunk failure in
      // this batch can be reconciled against what already went out.
      console.info(
        `[claimer] enqueued chunk platform=${platform} lane=${lane} chunkOffset=${i} chunkSize=${chunk.length} enqueuedFast=${result.enqueuedFast} enqueuedHeavy=${result.enqueuedHeavy} claimed=${result.claimed}`
      );
    }

    if (rows.length < CLAIM_ROUND_LIMIT) return;
  }
}

/**
 * Recovery sweep (spec 121 Scope 6): for EVERY platform in the enum —
 * registered or not, this is table hygiene — return items stuck in
 * `publishing` past the threshold to `queued` via the 2-arg unified
 * `recover_stuck_publishing_items` overload. This is also the safety
 * net for the claim/enqueue gap: an item claimed by a claimer that
 * crashed before `sendBatch` is recovered here, never re-claimed in the
 * same tick. Errors are captured and logged, never thrown — a recovery
 * failure must not stop this tick's claiming.
 */
export async function runRecoverySweep(
  db: ClaimerDbClient,
  env: PostHogEnv = {},
  waitUntil?: (promise: Promise<unknown>) => void
): Promise<number> {
  let recovered = 0;
  for (const platform of ALL_PLATFORMS) {
    try {
      const { data, error } = await db.rpc('recover_stuck_publishing_items', {
        p_platform: platform,
        p_timeout_minutes: RECOVERY_TIMEOUT_MINUTES,
      });
      if (error) {
        captureWorkerError(
          env,
          error,
          {
            site: 'runRecoverySweep',
            kind: 'rpc_error',
            platform,
          },
          waitUntil
        );
        console.error('[runRecoverySweep] RPC error:', platform, error);
        continue;
      }
      const count = Number(data ?? 0);
      if (count > 0) {
        console.info(
          `[runRecoverySweep] Recovered ${count} stuck publishing items (${platform})`
        );
        recovered += count;
      }
    } catch (err) {
      captureWorkerError(
        env,
        err,
        {
          site: 'runRecoverySweep',
          kind: 'unexpected',
          platform,
        },
        waitUntil
      );
      console.error('[runRecoverySweep] Unexpected error:', platform, err);
    }
  }
  return recovered;
}

/** True when the given tick time falls on the every-5th-tick recovery cadence. */
export function isRecoveryTick(now: Date): boolean {
  return now.getMinutes() % RECOVERY_INTERVAL_MINUTES === 0;
}

/**
 * Runs one claimer tick: recovery first (on the 5-minute cadence), then
 * claim rounds per lane per registered platform. Never publishes.
 */
export async function runClaimTick(deps: ClaimTickDeps): Promise<ClaimTickResult> {
  const now = deps.now ?? new Date();
  const result: ClaimTickResult = {
    claimed: 0,
    enqueuedFast: 0,
    enqueuedHeavy: 0,
    recovered: 0,
  };

  if (isRecoveryTick(now)) {
    result.recovered = await runRecoverySweep(deps.db, deps.env ?? {}, deps.waitUntil);
  }

  const platforms = deps.registry.platforms();
  for (const lane of [PUBLISH_LANE_FAST, PUBLISH_LANE_HEAVY] as const) {
    for (const platform of platforms) {
      // Per-pair isolation (spec 139): one failing (lane, platform)
      // pair must not abort the tick for the remaining pairs.
      try {
        await claimAndEnqueueLane(deps, platform, lane, result);
      } catch (err) {
        if (!isCaptured(err)) {
          captureWorkerError(
            deps.env ?? {},
            err,
            { site: 'runClaimTick', kind: 'claim_pair_failed', platform, lane },
            deps.waitUntil
          );
        }
        console.error(
          `[claimer] claim pair failed platform=${platform} lane=${lane}; continuing with remaining pairs:`,
          err
        );
        continue;
      }
    }
  }

  if (result.claimed > 0) {
    console.info(
      `[claimer] tick claimed=${result.claimed} enqueuedFast=${result.enqueuedFast} enqueuedHeavy=${result.enqueuedHeavy} recovered=${result.recovered}`
    );
  }
  return result;
}
