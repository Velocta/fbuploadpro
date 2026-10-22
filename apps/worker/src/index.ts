import { createClient } from '@supabase/supabase-js';
import { InternalError, type PublisherRegistry } from '@fbuploadpro/contracts';
import {
  runClaimTick,
  type ClaimerDbClient,
  type ClaimerQueues,
  type PublishQueueMessage,
} from './claimer.js';
import { handleQueueBatch, type ConsumerDbClient } from './consumers.js';
import {
  isTokenEncryptionKeyWellFormed,
  recordHeartbeat,
} from './heartbeat.js';
import { createWorkerPublisherRegistry } from './registry.js';
import {
  runRefreshCycle,
  TOKEN_REFRESH_CRON,
  type RefreshDbClient,
} from './refresh.js';

export { recordHeartbeat, WORKER_HEARTBEAT_NAME } from './heartbeat.js';
export {
  runClaimTick,
  runRecoverySweep,
  isRecoveryTick,
  CLAIM_ROUND_LIMIT,
  MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK,
} from './claimer.js';
export {
  handlePublishBatch,
  handleDlqBatch,
  handleQueueBatch,
  mapPublishOutcomeToSettleArgs,
  buildDlqSettleArgs,
} from './consumers.js';
export { createWorkerPublisherRegistry } from './registry.js';
export {
  runRefreshCycle,
  TOKEN_REFRESH_CRON,
  CLAIM_TICK_CRON,
  REFRESH_LEASE_TTL_MS,
} from './refresh.js';
export type { RefreshCycleResult, RefreshDbClient } from './refresh.js';

export interface Env {
  ENVIRONMENT?: string;
  /**
   * Test-only seam: integration tests inject a mock DB handle here.
   * Never set in production. Never derived from request input.
   */
  __TEST_DB__?: unknown;
  POSTHOG_KEY?: string;
  POSTHOG_HOST?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Producer binding for the publish-fast lane queue (spec 121). */
  PUBLISH_FAST_QUEUE?: Queue<PublishQueueMessage>;
  /** Producer binding for the publish-heavy lane queue (spec 121). */
  PUBLISH_HEAVY_QUEUE?: Queue<PublishQueueMessage>;
  /** Comma-separated extra origins allowed by CORS (see getAllowedOrigin). */
  CORS_ALLOWED_ORIGINS?: string;
}

export interface ScheduledOptions {
  db?: ClaimerDbClient & ConsumerDbClient;
  registry?: PublisherRegistry;
  queues?: ClaimerQueues;
  now?: Date;
}

export interface QueueOptions {
  db?: ConsumerDbClient & ClaimerDbClient;
  registry?: PublisherRegistry;
}

function initWorkerDb(env: Env, optionsDb?: unknown): any {
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

function queuesFromEnv(env: Env, overrides?: ClaimerQueues): ClaimerQueues {
  return {
    fast: overrides?.fast ?? (env.PUBLISH_FAST_QUEUE as ClaimerQueues['fast']),
    heavy: overrides?.heavy ?? (env.PUBLISH_HEAVY_QUEUE as ClaimerQueues['heavy']),
  };
}

/**
 * Scheduled handler: heartbeat first on EVERY tick — including the
 * skip paths — then branch on `controller.cron`: the refresh cron runs
 * the token-refresh cycle (refresh.ts), anything else runs the claimer
 * (claim rounds that only claim and enqueue; the tick never publishes,
 * consumers do the publishing).
 */
export async function handleScheduled(
  controller: ScheduledController,
  env: Env,
  _ctx?: ExecutionContext,
  options?: ScheduledOptions
): Promise<void> {
  const db = initWorkerDb(env, options?.db);
  const masterKey = env.TOKEN_ENCRYPTION_KEY;

  if (!masterKey) {
    console.warn('[Scheduled] TOKEN_ENCRYPTION_KEY is not configured; skipping cycle');
    await recordHeartbeat(db, {
      success: false,
      skipReason: 'missing_token_encryption_key',
    });
    return;
  }

  if (!db) {
    console.warn('[Scheduled] Database client is not configured; skipping cycle');
    await recordHeartbeat(null, { success: false, skipReason: 'db_unconfigured' });
    return;
  }

  const registry = options?.registry ?? createWorkerPublisherRegistry();

  // Cron routing (spec 121 Scope 9): the refresh cron runs ONLY the
  // token-refresh cycle; every other cron (the `* * * * *` claim tick)
  // runs the claimer exactly as before. The refresh cycle deliberately
  // writes no heartbeat row: the heartbeat is claimer-owned and a full
  // write from here would zero the claimer's claimed/settled counters
  // and stamp a false claim success. Refresh reports through its own
  // structured counter log line + PostHog captures (see refresh.ts);
  // the shared skip-path heartbeats above still fire for both crons.
  if (controller.cron === TOKEN_REFRESH_CRON) {
    try {
      await runRefreshCycle(
        db as unknown as RefreshDbClient,
        registry,
        env,
        options?.now ?? new Date(controller.scheduledTime)
      );
    } catch (err) {
      console.error('[Scheduled] token refresh cycle failed:', err);
      throw err;
    }
    return;
  }

  try {
    const result = await runClaimTick({
      db,
      registry,
      queues: queuesFromEnv(env, options?.queues),
      env,
      now: options?.now ?? new Date(controller.scheduledTime),
    });

    await recordHeartbeat(db, {
      success: true,
      claimed: result.claimed,
      enqueuedFast: result.enqueuedFast,
      enqueuedHeavy: result.enqueuedHeavy,
    });
  } catch (err) {
    await recordHeartbeat(db, { success: false, skipReason: 'claim_error' });
    throw err;
  }
}

/**
 * Queue handler (spec 121 consumers): dispatches by queue name to the
 * publish consumers or the DLQ consumers. See consumers.ts for the
 * ack/retry semantics.
 */
export async function handleQueue(
  batch: MessageBatch<PublishQueueMessage>,
  env: Env,
  _ctx?: ExecutionContext,
  options?: QueueOptions
): Promise<void> {
  const db = initWorkerDb(env, options?.db);
  if (!db) {
    throw new InternalError('Database client is not configured; cannot consume queue batch');
  }
  const registry = options?.registry ?? createWorkerPublisherRegistry();
  await handleQueueBatch(batch, {
    db,
    registry,
    masterKey: env.TOKEN_ENCRYPTION_KEY,
    env,
  });
}

export interface WorkerHealthPayload {
  status: 'ok' | 'unhealthy';
  timestamp: string;
  worker: 'fbuploadpro-worker';
  checks: {
    database: boolean;
    config: boolean;
  };
}

const WORKER_HEALTH_TIMEOUT_MS = 2000;

interface WorkerProbeDb {
  from: (table: string) => {
    select: (
      columns: string,
      options: { head: boolean; count: string }
    ) => Promise<{ error: unknown }>;
  };
}

async function probeWorkerDatabase(
  db: WorkerProbeDb | null,
  timeoutMs: number
): Promise<boolean> {
  if (!db || typeof db.from !== 'function') return false;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const probePromise = db
      .from('workspaces')
      .select('id', { head: true, count: 'exact' });
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error('Health probe timeout exceeded budget')),
        timeoutMs
      );
    });
    const { error } = await Promise.race([probePromise, timeoutPromise]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error(
      '[health] worker database probe failed:',
      err instanceof Error ? err.message : err
    );
    return false;
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

/**
 * Worker health probe (spec 116): mirrors the web DB probe (workspaces
 * head query, 2s budget) plus env-presence booleans. Sanitized — booleans
 * only, never hosts, values, or error detail (logged server-side only).
 */
export async function probeWorkerHealth(
  env: Env,
  injectedDb?: unknown,
  timeoutMs = WORKER_HEALTH_TIMEOUT_MS
): Promise<{ statusCode: number; payload: WorkerHealthPayload }> {
  const timestamp = new Date().toISOString();
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const config = Boolean(
    supabaseUrl &&
      env.SUPABASE_SERVICE_ROLE_KEY &&
      isTokenEncryptionKeyWellFormed(env.TOKEN_ENCRYPTION_KEY)
  );

  const testDb =
    env.ENVIRONMENT === 'production'
      ? null
      : ((env as unknown as { __TEST_DB__?: unknown }).__TEST_DB__ ?? null);
  const db = (initWorkerDb(env, injectedDb) ?? testDb) as WorkerProbeDb | null;
  const database = await probeWorkerDatabase(db, timeoutMs);

  const ok = database && config;
  return {
    statusCode: ok ? 200 : 503,
    payload: {
      status: ok ? 'ok' : 'unhealthy',
      timestamp,
      worker: 'fbuploadpro-worker',
      checks: { database, config },
    },
  };
}

/**
 * Returns the request origin if it is allowed to call this worker, else null.
 * The worker serves the FBUploadPro web app, so only its domains (apex,
 * www, *.fbuploadpro.com tenant subdomains, app.vinsmokemedia.online) plus
 * localhost in non-production are accepted. Extra origins can be added via
 * the CORS_ALLOWED_ORIGINS env var (comma-separated). Never '*': these
 * endpoints authenticate via Bearer tokens.
 */
function getAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  let hostname: string;
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
  const extra = (env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allowedHosts = new Set([
    'fbuploadpro.com',
    'www.fbuploadpro.com',
    'app.vinsmokemedia.online',
    ...extra,
  ]);
  const isTenantSubdomain =
    hostname.endsWith('.fbuploadpro.com') || hostname.endsWith('.vinsmokemedia.online');
  const isLocalhost =
    env.ENVIRONMENT !== 'production' &&
    (hostname === 'localhost' || hostname === '127.0.0.1');
  if (allowedHosts.has(hostname) || isTenantSubdomain || isLocalhost) {
    return origin;
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const allowedOrigin = getAllowedOrigin(request, env);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      const preflightHeaders: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      if (allowedOrigin) {
        preflightHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
        preflightHeaders['Vary'] = 'Origin';
      }
      return new Response(null, { status: 204, headers: preflightHeaders });
    }

    const corsHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (allowedOrigin) {
      corsHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
      corsHeaders['Vary'] = 'Origin';
    }

    // 2. Healthcheck (spec 116: real DB probe + env-presence booleans)
    if (request.method === 'GET' && url.pathname === '/health') {
      const result = await probeWorkerHealth(env);
      return new Response(JSON.stringify(result.payload), {
        status: result.statusCode,
        headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
      });
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
    batch: MessageBatch<PublishQueueMessage>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    await handleQueue(batch, env, ctx);
  },
};
