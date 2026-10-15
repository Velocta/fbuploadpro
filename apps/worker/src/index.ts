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
  MEDIA_BUCKET?: any;
  R2_PUBLIC_URL?: string;
}

export * from './fb-client.js';
export * from './dispatcher.js';
export * from './settlement.js';
export * from './insights-sync.js';
export * from './services/downloader-engine.js';
import { syncDailyPageInsights } from './insights-sync.js';
import {
  EnqueueDownloadJobRequestSchema,
  validateSafeRemoteUrl,
  detectSourcePlatform,
} from '@fbuploadpro/contracts';
import { executeDownloadJob } from './services/downloader-engine.js';


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
      const { data, error } = await db.rpc('recover_stuck_publishing_items', { p_timeout_minutes: 10 });
      if (error) {
        console.error('[recoverStuckPublishingItems] RPC error:', error);
      } else if (data && data > 0) {
        console.info(`[recoverStuckPublishingItems] Recovered ${data} stuck publishing items`);
      }
    } catch (err) {
      console.error('[recoverStuckPublishingItems] Unexpected error:', err);
    }
  }
}

async function revertUnsentQueueItems(db: any, unsentIds: string[]): Promise<void> {
  if (unsentIds.length === 0) return;
  try {
    if (typeof db.from === 'function') {
      await db.from('queue_items').update({ status: 'queued', updated_at: new Date().toISOString() }).in('id', unsentIds);
    } else if (typeof db.query === 'function') {
      await db.query(`UPDATE queue_items SET status = 'queued', updated_at = now() WHERE id = ANY($1)`, [unsentIds]);
    }
  } catch (revertErr) {
    console.error('[fanOutClaimedBatches] Failed to revert unsent items to queued:', revertErr);
  }
}

async function sendClaimedSlice(
  queue: { sendBatch: (batch: Array<{ body: any }>) => Promise<unknown> },
  db: any,
  slice: any[]
): Promise<void> {
  try {
    await queue.sendBatch(slice.map((body) => ({ body })));
  } catch (sendErr) {
    console.error('[fanOutClaimedBatches] Failed to send batch to queue; reverting items to queued:', sendErr);
    const unsentIds = slice.map((item) => item.id);
    await revertUnsentQueueItems(db, unsentIds);
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
    await Promise.all(slices.map((slice) => sendClaimedSlice(queue, db, slice)));
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

function createTestMockDb(userId: string): any {
  const defaultJob = {
    id: crypto.randomUUID(),
    user_id: userId,
    status: 'queued',
    progress_percent: 0,
    downloaded_bytes: 0,
  };

  const queryBuilder = {
    single: () => Promise.resolve({ data: defaultJob, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    limit: () => Promise.resolve({ data: [], error: null }),
  };

  const tableMock = {
    insert: () => ({ select: () => queryBuilder }),
    select: () => ({
      eq: () => ({
        eq: () => queryBuilder,
        order: () => queryBuilder,
      }),
    }),
    update: () => ({
      eq: () => Promise.resolve({ data: null, error: null }),
    }),
  };

  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: userId } }, error: null }),
    },
    from: () => tableMock,
  };
}

async function authenticateWorkerRequest(
  request: Request,
  env: Env,
  db: any
): Promise<string | null> {
  if (env.ENVIRONMENT === 'test' && request.headers.get('x-test-user-id')) {
    return request.headers.get('x-test-user-id');
  }

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token && db?.auth && typeof db.auth.getUser === 'function') {
    const { data, error } = await db.auth.getUser(token);
    if (!error && data?.user?.id) {
      return data.user.id;
    }
  }

  return null;
}

async function handleEnqueueDownload(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  db: any,
  userId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON request body' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const parseResult = EnqueueDownloadJobRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid download parameters',
        details: parseResult.error.flatten(),
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  const { url: sourceUrl, folderId, customFilename } = parseResult.data;

  // SSRF Safety Check
  const safeCheck = validateSafeRemoteUrl(sourceUrl);
  if (!safeCheck.valid) {
    return new Response(
      JSON.stringify({
        error: safeCheck.reason || 'Private and loopback network addresses are not allowed.',
        errorCode: 'UNSAFE_URL',
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  const platform = detectSourcePlatform(sourceUrl);
  const jobId = crypto.randomUUID();

  const { data: job, error: insertError } = await db
    .from('media_download_jobs')
    .insert({
      id: jobId,
      user_id: userId,
      source_url: sourceUrl,
      source_platform: platform,
      target_folder_id: folderId ?? null,
      custom_filename: customFilename ?? null,
      status: 'queued',
      progress_percent: 0,
      downloaded_bytes: 0,
      total_bytes: null,
    })
    .select('*')
    .single();

  if (insertError) {
    return new Response(
      JSON.stringify({ error: `Failed to create download job: ${insertError.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }

  // Dispatch asynchronous background download
  const backgroundTask = executeDownloadJob({
    jobId,
    userId,
    sourceUrl,
    targetFolderId: folderId ?? null,
    customFilename: customFilename ?? null,
    db,
    env,
  });

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(backgroundTask);
  }

  return new Response(
    JSON.stringify({
      success: true,
      job,
    }),
    { status: 202, headers: corsHeaders }
  );
}

async function handleGetDownloadJob(
  jobId: string,
  userId: string,
  db: any,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { data: job, error } = await db
    .from('media_download_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !job) {
    return new Response(
      JSON.stringify({ error: 'Download job not found' }),
      { status: 404, headers: corsHeaders }
    );
  }

  return new Response(
    JSON.stringify({ success: true, job }),
    { status: 200, headers: corsHeaders }
  );
}

async function handleListDownloadJobs(
  userId: string,
  db: any,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { data: jobs, error } = await db
    .from('media_download_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch jobs: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }

  return new Response(
    JSON.stringify({ success: true, jobs: jobs || [] }),
    { status: 200, headers: corsHeaders }
  );
}

async function handleMediaDownloadRoutes(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pathname: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  let db = initWorkerDb(env);
  if (!db && env.ENVIRONMENT === 'test') {
    db = createTestMockDb(request.headers.get('x-test-user-id') || 'test-user-id');
  }

  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database client unconfigured' }),
      { status: 500, headers: corsHeaders }
    );
  }

  const userId = await authenticateWorkerRequest(request, env, db);
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: valid authorization token required' }),
      { status: 401, headers: corsHeaders }
    );
  }

  if (request.method === 'POST' && pathname === '/api/media/download/enqueue') {
    return handleEnqueueDownload(request, env, ctx, db, userId, corsHeaders);
  }

  const jobMatch = /^\/api\/media\/download\/jobs\/([a-zA-Z0-9_-]+)$/.exec(pathname);
  if (request.method === 'GET' && jobMatch?.[1]) {
    return handleGetDownloadJob(jobMatch[1], userId, db, corsHeaders);
  }

  if (request.method === 'GET' && pathname === '/api/media/download/jobs') {
    return handleListDownloadJobs(userId, db, corsHeaders);
  }

  return new Response(
    JSON.stringify({ error: 'Not Found' }),
    { status: 404, headers: corsHeaders }
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-test-user-id',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    // 2. Healthcheck
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          worker: 'fbuploadpro-worker',
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    // 3. Media Download API
    if (url.pathname.startsWith('/api/media/download')) {
      return handleMediaDownloadRoutes(request, env, ctx, url.pathname, corsHeaders);
    }

    return new Response(
      JSON.stringify({
        error: 'Not Found',
      }),
      {
        status: 404,
        headers: corsHeaders,
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
