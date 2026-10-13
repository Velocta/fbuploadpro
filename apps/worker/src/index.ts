import { createClient } from '@supabase/supabase-js';
import { FacebookPublishClient, type IFacebookPublishClient } from './fb-client.js';
import { runDispatchCycle, type DispatcherDbClient } from './dispatcher.js';

export interface Env {
  ENVIRONMENT?: string;
  FB_ENCRYPTION_MASTER_KEY?: string;
  FB_GRAPH_API_URL?: string;
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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

export async function handleScheduled(
  controller: ScheduledController,
  env: Env,
  _ctx?: ExecutionContext,
  options?: ScheduledOptions
): Promise<void> {
  const masterKey = env.FB_ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    console.warn('[Scheduled] FB_ENCRYPTION_MASTER_KEY is not configured; skipping cycle');
    return;
  }

  let db = options?.db;

  if (!db) {
    const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey || env.ENVIRONMENT === 'test') {
      return;
    }
    db = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as any;
  }

  if (!db) {
    return;
  }

  const fbClient =
    options?.fbClient ??
    new FacebookPublishClient(
      env.FB_GRAPH_API_URL ? { baseUrl: env.FB_GRAPH_API_URL } : undefined
    );

  try {
    await runDispatchCycle({
      db,
      fbClient,
      masterKey,
      limit: options?.limit ?? 10,
    });

    // Run Daily Page Insights Snapshot Sync if explicitly requested or on daily schedule
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
    // No-op cleanup for stateless HTTPS Supabase client
  }
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
};
