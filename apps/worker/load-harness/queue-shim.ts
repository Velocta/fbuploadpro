/**
 * In-memory Cloudflare Queues shim for the spec 122 load harness.
 *
 * Implements the claimer's LaneQueueProducer (sendBatch) and delivers
 * Cloudflare-shaped Message / MessageBatch objects to the REAL
 * handleQueueBatch consumer (apps/worker/src/consumers.ts).
 *
 * Delivery semantics mirrored from wrangler.toml + Cloudflare Queues:
 *   - publish-fast:  max_batch_size 10, max_concurrency 20, max_retries 3,
 *     dead_letter_queue publish-fast-dlq
 *   - publish-heavy: max_batch_size 5,  max_concurrency 10, max_retries 3,
 *     dead_letter_queue publish-heavy-dlq
 *   - DLQ consumers: max_batch_size 10, max_concurrency 5
 * A batch whose handler throws leaves its un-acked messages to be retried;
 * a message that exhausts max_retries is delivered to the lane DLQ, whose
 * real handler settles the item `failed` (never silently left `publishing`).
 *
 * Concurrency is parameterised so the certification can run the bulk drain
 * above the wrangler values if (and only if) the calibration projection
 * demands it — the results file must then state the concurrency used and
 * derive capacity at the wrangler-configured concurrency from the measured
 * per-consumer throughput.
 */
import {
  PUBLISH_FAST_QUEUE_NAME,
  PUBLISH_HEAVY_QUEUE_NAME,
  PUBLISH_FAST_DLQ_NAME,
  PUBLISH_HEAVY_DLQ_NAME,
  handleQueueBatch,
  type ConsumerDeps,
  type DlqConsumerDeps,
} from '../src/consumers.js';
import type { PublishQueueMessage } from '../src/claimer.js';
import { PUBLISH_LANE_FAST, type PublishLane } from '@fbuploadpro/contracts';

export interface LaneConfig {
  batchSize: number;
  concurrency: number;
  maxRetries: number;
}

export interface ShimConfig {
  fast: LaneConfig;
  heavy: LaneConfig;
  dlqConcurrency: number;
  dlqBatchSize: number;
}

/** The production configuration from apps/worker/wrangler.toml. */
export const WRANGLER_CONFIG: ShimConfig = {
  fast: { batchSize: 10, concurrency: 20, maxRetries: 3 },
  heavy: { batchSize: 5, concurrency: 10, maxRetries: 3 },
  dlqConcurrency: 5,
  dlqBatchSize: 10,
};

interface ShimMessage {
  body: PublishQueueMessage;
  attempts: number;
}

class ShimQueueProducer {
  constructor(private readonly shim: QueueShim, private readonly lane: PublishLane) {}

  async sendBatch(
    messages: Iterable<MessageSendRequest<PublishQueueMessage>>
  ): Promise<unknown> {
    for (const m of messages) {
      this.shim.enqueue(this.lane, { body: m.body, attempts: 0 });
    }
    return undefined;
  }
}

let messageSeq = 0;

function makeMessage(
  shimMsg: ShimMessage,
  acked: Set<string>
): Message<PublishQueueMessage> {
  const id = `shim-${++messageSeq}`;
  return {
    id,
    timestamp: new Date(),
    body: shimMsg.body,
    attempts: shimMsg.attempts + 1,
    ack: () => {
      acked.add(id);
    },
    retry: () => {
      // Retry is driven by the shim from the ack set after the batch settles.
    },
  } as unknown as Message<PublishQueueMessage>;
}

export class QueueShim {
  readonly fastProducer: ShimQueueProducer;
  readonly heavyProducer: ShimQueueProducer;

  private readonly queues: Record<PublishLane, ShimMessage[]> = {
    'publish-fast': [],
    'publish-heavy': [],
  };
  private readonly dlq: ShimMessage[] = [];
  private waiters: Array<() => void> = [];
  private running = false;
  private workersDone: Promise<void> | null = null;

  enqueuedFast = 0;
  enqueuedHeavy = 0;
  deliveredBatches = 0;
  messageRetries = 0;
  dlqArrivals = 0;

  constructor(
    private readonly config: ShimConfig,
    private readonly deps: ConsumerDeps & DlqConsumerDeps
  ) {
    this.fastProducer = new ShimQueueProducer(this, 'publish-fast');
    this.heavyProducer = new ShimQueueProducer(this, 'publish-heavy');
  }

  enqueue(lane: PublishLane, msg: ShimMessage): void {
    this.queues[lane].push(msg);
    if (lane === PUBLISH_LANE_FAST) this.enqueuedFast += 1;
    else this.enqueuedHeavy += 1;
    this.wake();
  }

  pending(): number {
    return this.queues['publish-fast'].length + this.queues['publish-heavy'].length + this.dlq.length;
  }

  private wake(): void {
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w();
  }

  private waitForWork(ms = 250): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const workers: Array<Promise<void>> = [];
    for (let i = 0; i < this.config.fast.concurrency; i++) {
      workers.push(this.laneWorker('publish-fast', this.config.fast));
    }
    for (let i = 0; i < this.config.heavy.concurrency; i++) {
      workers.push(this.laneWorker('publish-heavy', this.config.heavy));
    }
    for (let i = 0; i < this.config.dlqConcurrency; i++) {
      workers.push(this.dlqWorker());
    }
    this.workersDone = Promise.all(workers).then(() => undefined);
  }

  async stop(): Promise<void> {
    this.running = false;
    this.wake();
    if (this.workersDone) await this.workersDone;
  }

  private async laneWorker(lane: PublishLane, cfg: LaneConfig): Promise<void> {
    const queueName = lane === PUBLISH_LANE_FAST ? PUBLISH_FAST_QUEUE_NAME : PUBLISH_HEAVY_QUEUE_NAME;
    const queue = this.queues[lane];
    while (this.running) {
      if (queue.length === 0) {
        await this.waitForWork();
        continue;
      }
      const batchMsgs = queue.splice(0, cfg.batchSize);
      await this.deliver(queueName, batchMsgs, cfg, lane);
    }
  }

  private async dlqWorker(): Promise<void> {
    while (this.running) {
      if (this.dlq.length === 0) {
        await this.waitForWork();
        continue;
      }
      const batchMsgs = this.dlq.splice(0, this.config.dlqBatchSize);
      const acked = new Set<string>();
      const messages = batchMsgs.map((m) => makeMessage(m, acked));
      // DLQ queue name is carried per message lane; group by lane for the
      // real handler, which dispatches on batch.queue.
      const byQueue = new Map<string, Array<Message<PublishQueueMessage>>>();
      messages.forEach((msg, i) => {
        const body = batchMsgs[i]!.body;
        const name =
          body?.lane === PUBLISH_LANE_FAST ? PUBLISH_FAST_DLQ_NAME : PUBLISH_HEAVY_DLQ_NAME;
        const arr = byQueue.get(name) ?? [];
        arr.push(msg);
        byQueue.set(name, arr);
      });
      for (const [queueName, msgs] of byQueue) {
        const batch = { queue: queueName, messages: msgs } as unknown as MessageBatch<PublishQueueMessage>;
        try {
          await handleQueueBatch(batch, this.deps);
        } catch (err) {
          console.error('[shim] DLQ batch handler threw:', err);
        }
      }
      this.deliveredBatches += 1;
    }
  }

  private async deliver(
    queueName: string,
    batchMsgs: ShimMessage[],
    cfg: LaneConfig,
    lane: PublishLane
  ): Promise<void> {
    const acked = new Set<string>();
    const messages = batchMsgs.map((m) => makeMessage(m, acked));
    const idToMsg = new Map(messages.map((m, i) => [m.id, batchMsgs[i] as ShimMessage]));
    const batch = { queue: queueName, messages } as unknown as MessageBatch<PublishQueueMessage>;
    this.deliveredBatches += 1;
    try {
      await handleQueueBatch(batch, this.deps);
    } catch {
      // Cloudflare semantics: un-acked messages are retried with backoff;
      // after max_retries they move to the DLQ. (The consumer already
      // logged the underlying error.)
    }
    for (const msg of messages) {
      if (acked.has(msg.id)) continue;
      const shimMsg = idToMsg.get(msg.id);
      if (!shimMsg) continue;
      shimMsg.attempts += 1;
      if (shimMsg.attempts > cfg.maxRetries) {
        this.dlqArrivals += 1;
        this.dlq.push(shimMsg);
      } else {
        this.messageRetries += 1;
        this.queues[lane].push(shimMsg);
      }
      this.wake();
    }
  }
}
