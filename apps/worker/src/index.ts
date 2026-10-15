import { createClient } from '@supabase/supabase-js';
import { FacebookPublishClient, type IFacebookPublishClient } from './fb-client.js';
import {
  runDispatchCycle,
  claimDueItems,
  dispatchItem,
  type DispatcherDbClient,
} from './dispatcher.js';
import { settleOutcome } from './settlement.js';
import type { ClaimedQueueItem } from '@fbuploadpro/contracts';

export interface Env {
  ENVIRONMENT?: string;
  FB_ENCRYPTION_MASTER_KEY?: string;
  MASTER_ENCRYPTION_KEY?: string;
  FB_GRAPH_API_URL?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  DATABASE_URL?: string;
  DISPATCH_BATCH_SIZE?: string;
  DISPATCH_MAX_BATCHES_PER_TICK?: string;
  DISPATCH_CONCURRENCY?: string;
  PUBLISH_QUEUE?: {
    sendBatch(messages: Array<{ body: ClaimedQueueItem }>): Promise<void>;
  };
}

export * from './fb-client.js';
export * from './dispatcher.js';
export * from './settlement.js';
export * from './insights-sync.js';
import { syncDailyPageInsights } from './insights-sync.js';

export interface ScheduledOptions {
  db?: DispatcherDbClient;
  fbClient?: IFacebookPublishClient;
  limit?: number;
  syncInsights?: boolean;
  insightsFetchImpl?: typeof fetch;
}

export interface QueueMessage {
  body: ClaimedQueueItem;
  ack(): void;
  retry(): void;
}

export interface QueueBatch {
  messages: QueueMessage[];
  queue: string;
}

function initWorkerDb(env: Env, optionsDb?: any): any {
  if (optionsDb) return optionsDb;
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey || env.ENVIRONMENT === 'test') {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

async function recoverStuckPublishingItems(db: any): Promise<void> {
  const currentMinute = new Date().getMinutes();
  if (currentMinute % 5 === 0 && typeof db.rpc === 'function') {
    try {
      await db.rpc('recover_stuck_publishing_items', { p_timeout_minutes: 10 });
    } catch {
      // Non-blocking in environments where recover RPC is not mocked
    }
  }
}

async function fanOutClaimedBatches(
  queue: { sendBatch: (batch: Array<{ body: any }>) => Promise<unknown> },
  db: any,
  maxBatches: number,
  batchSize: number
): Promise<void> {
  const CHUNK_SIZE = 100;
  for (let b = 0; b < maxBatches; b++) {
    const claimed = await claimDueItems(db, batchSize);
    if (claimed.length === 0) break;

    const slices: any[][] = [];
    for (let i = 0; i < claimed.length; i += CHUNK_SIZE) {
      slices.push(claimed.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(slices.map((slice) => queue.sendBatch(slice.map((body) => ({ body })))));
  }
}

export async function handleScheduled(
  controller: ScheduledController,
  env: Env,
  _ctx?: ExecutionContext,
  options?: ScheduledOptions
): Promise<void> {
  const masterKey = env.FB_ENCRYPTION_MASTER_KEY || env.MASTER_ENCRYPTION_KEY;
  if (!masterKey) {
    console.warn('[Scheduled] Encryption master key is not configured; skipping cycle');
    return;
  }

  const db = initWorkerDb(env, options?.db);
  if (!db) {
    return;
  }

  const fbClient =
    options?.fbClient ??
    new FacebookPublishClient(
      env.FB_GRAPH_API_URL ? { baseUrl: env.FB_GRAPH_API_URL } : undefined
    );

  try {
    // 1. Every 5 minutes, recover items stuck in 'publishing' status
    await recoverStuckPublishingItems(db);

    // 2. High-Throughput Producer vs Direct Runner
    if (env.PUBLISH_QUEUE && typeof env.PUBLISH_QUEUE.sendBatch === 'function') {
      const maxBatches = Number(env.DISPATCH_MAX_BATCHES_PER_TICK || 5);
      const batchSize = Number(env.DISPATCH_BATCH_SIZE || 500);
      await fanOutClaimedBatches(env.PUBLISH_QUEUE, db, maxBatches, batchSize);
    } else {
      // Direct execution for tests and local development
      const concurrency = Number(env.DISPATCH_CONCURRENCY || 25);
      await runDispatchCycle({
        db,
        fbClient,
        masterKey,
        limit: options?.limit ?? 10,
        concurrency,
      });
    }

    // 3. Daily Page Insights Snapshot Sync
    const isDailyInsightsCron = controller.cron === '0 2 * * *' || controller.cron === '0 0 * * *';
    if (options?.syncInsights || isDailyInsightsCron) {
      await syncDailyPageInsights({
        db,
        masterKey,
        fbApiUrl: env.FB_GRAPH_API_URL,
        fetchImpl: options?.insightsFetchImpl,
      });
    }
  } finally {
    // Stateless cleanup
  }
}

export async function handleQueueBatch(
  batch: QueueBatch,
  env: Env,
  _ctx?: ExecutionContext
): Promise<void> {
  const masterKey = env.FB_ENCRYPTION_MASTER_KEY || env.MASTER_ENCRYPTION_KEY;
  if (!masterKey) {
    console.error('[QueueConsumer] Encryption master key is missing');
    return;
  }

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('[QueueConsumer] Supabase credentials missing');
    return;
  }

  const db = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;

  const fbClient = new FacebookPublishClient(
    env.FB_GRAPH_API_URL ? { baseUrl: env.FB_GRAPH_API_URL } : undefined
  );

  await Promise.allSettled(
    batch.messages.map(async (msg) => {
      try {
        const outcome = await dispatchItem(msg.body, fbClient, masterKey);
        await settleOutcome(db, msg.body, outcome);
        msg.ack();
      } catch (err) {
        console.error(`[QueueConsumer] Failed processing item ${msg.body.id}:`, err);
        msg.retry();
      }
    })
  );
}

export default {
  fetch(request: Request, _env: Env, _ctx: ExecutionContext): Response {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          worker: 'fbuploadpro-worker',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Not Found',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    await handleScheduled(controller, env, ctx);
  },

  async queue(
    batch: QueueBatch,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    await handleQueueBatch(batch, env, ctx);
  },
};
