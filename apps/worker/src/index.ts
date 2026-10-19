import { createClient } from '@supabase/supabase-js';
import { FacebookPublishClient, type IFacebookPublishClient } from './fb-client.js';
import {
  runDispatchCycle,
  type DispatcherDbClient,
} from './dispatcher.js';

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
  FB_ENCRYPTION_MASTER_KEY?: string;
  MASTER_ENCRYPTION_KEY?: string;
  FB_GRAPH_API_URL?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  DISPATCH_BATCH_SIZE?: string;
  DISPATCH_MAX_BATCHES_PER_TICK?: string;
  DISPATCH_CONCURRENCY?: string;
  MEDIA_BUCKET?: any;
  R2_PUBLIC_URL?: string;
  /** Comma-separated extra origins allowed by CORS (see getAllowedOrigin). */
  CORS_ALLOWED_ORIGINS?: string;
}

// Explicit re-exports for test imports (replaces export * to avoid leaking internals).
export {
  executeDownloadJob,
  inferMimeFromUrlOrHeader,
  sanitizeFileName,
  extractFilenameFromHeader,
  trimTrailingSlash,
  writeStreamToDestination,
  validateDownloadSafetyAndQuota,
  validateDownloadSafety,
  cleanupFailedDownload,
  resolveRemoteCandidates,
  persistDownloadedMediaItem,
  tryUploadVideoThumbnailToR2,
} from './services/downloader-engine.js';
import {
  EnqueueDownloadJobRequestSchema,
  validateSafeRemoteUrl,
  detectSourcePlatform,
} from '@fbuploadpro/contracts';
import { executeDownloadJob } from './services/downloader-engine.js';
import { captureWorkerError } from './analytics.js';


export interface ScheduledOptions {
  db?: DispatcherDbClient;
  fbClient?: IFacebookPublishClient;
  limit?: number;
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

// How often (in minutes) stuck-item recovery runs. Coupled to the worker's "* * * * *" cron.
const RECOVERY_INTERVAL_MINUTES = 5;

/** Default dispatch concurrency when DISPATCH_CONCURRENCY is not set. */
const DEFAULT_DISPATCH_CONCURRENCY = 25;

/** Max download jobs returned by the recent-jobs listing. */
const RECENT_DOWNLOAD_JOBS_LIMIT = 50;

async function recoverStuckPublishingItems(db: any, env?: Env): Promise<void> {
  const currentMinute = new Date().getMinutes();
  if (currentMinute % RECOVERY_INTERVAL_MINUTES === 0 && typeof db.rpc === 'function') {
    try {
      const { data, error } = await db.rpc('recover_stuck_publishing_items', { p_timeout_minutes: 10 });
      if (error) {
        captureWorkerError(env ?? {}, error, { site: 'recoverStuckPublishingItems', kind: 'rpc_error' });
        console.error('[recoverStuckPublishingItems] RPC error:', error);
      } else if (data && data > 0) {
        console.info(`[recoverStuckPublishingItems] Recovered ${data} stuck publishing items`);
      }
    } catch (err) {
      captureWorkerError(env ?? {}, err, { site: 'recoverStuckPublishingItems', kind: 'unexpected' });
      console.error('[recoverStuckPublishingItems] Unexpected error:', err);
    }
  }
}

export async function failStuckDownloadJobs(db: any, env?: Env): Promise<number> {
  if (typeof db?.rpc === 'function') {
    try {
      const { data, error } = await db.rpc('fail_stuck_download_jobs', { p_timeout_minutes: 15 });
      if (error) {
        captureWorkerError(env ?? {}, error, { site: 'failStuckDownloadJobs', kind: 'rpc_error' });
        console.error('[failStuckDownloadJobs] RPC error:', error);
        return 0;
      }
      if (data && data > 0) {
        console.info(`[failStuckDownloadJobs] Marked ${data} stuck download jobs as failed`);
      }
      return Number(data ?? 0);
    } catch (err) {
      captureWorkerError(env ?? {}, err, { site: 'failStuckDownloadJobs', kind: 'unexpected' });
      console.error('[failStuckDownloadJobs] Unexpected error:', err);
      return 0;
    }
  }
  return 0;
}

export async function handleScheduled(
  controller: ScheduledController,
  env: Env,
  _ctx?: ExecutionContext,
  options?: ScheduledOptions
): Promise<void> {
  const masterKey = env.TOKEN_ENCRYPTION_KEY || env.FB_ENCRYPTION_MASTER_KEY || env.MASTER_ENCRYPTION_KEY;
  if (!masterKey) {
    console.warn('[Scheduled] TOKEN_ENCRYPTION_KEY is not configured; skipping cycle');
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
    await recoverStuckPublishingItems(db, env);

    // 1b. Fail download jobs stalled for > 15 minutes
    await failStuckDownloadJobs(db, env);

    // 2. Direct dispatch (Cloudflare Queues were never provisioned; direct
    //    execution is the design)
    const concurrency = Number(env.DISPATCH_CONCURRENCY || DEFAULT_DISPATCH_CONCURRENCY);
    await runDispatchCycle({
      db,
      fbClient,
      masterKey,
      limit: options?.limit ?? 10,
      concurrency,
    });
  } finally {
    // Stateless cleanup
  }
}

async function authenticateWorkerRequest(
  request: Request,
  db: any
): Promise<string | null> {
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
    .limit(RECENT_DOWNLOAD_JOBS_LIMIT);

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
  // Test-only seam (see Env.__TEST_DB__): integration tests inject a mock DB
  // via env. This is never derived from request input, so it cannot be
  // triggered remotely. Disabled entirely when ENVIRONMENT === 'production'.
  const testDb =
    env.ENVIRONMENT === 'production'
      ? null
      : (env as unknown as { __TEST_DB__?: unknown }).__TEST_DB__ ?? null;
  const db = initWorkerDb(env) ?? testDb;

  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database client unconfigured' }),
      { status: 500, headers: corsHeaders }
    );
  }

  const userId = await authenticateWorkerRequest(request, db);
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
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
};
