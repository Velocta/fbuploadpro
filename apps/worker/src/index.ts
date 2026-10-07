import { createDatabaseClient } from '@fbuploadpro/database';
import { FacebookPublishClient, type IFacebookPublishClient } from './fb-client.js';
import { runDispatchCycle, type DispatcherDbClient } from './dispatcher.js';

export interface Env {
  ENVIRONMENT?: string;
  FB_ENCRYPTION_MASTER_KEY?: string;
  FB_GRAPH_API_URL?: string;
  DATABASE_URL?: string;
}

export * from './fb-client.js';
export * from './dispatcher.js';
export * from './settlement.js';

export interface ScheduledOptions {
  db?: DispatcherDbClient;
  fbClient?: IFacebookPublishClient;
  limit?: number;
}

export async function handleScheduled(
  _controller: ScheduledController,
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
  let shouldCloseDb = false;

  if (!db) {
    if (!env.DATABASE_URL || env.ENVIRONMENT === 'test') {
      return;
    }
    db = createDatabaseClient({ connectionString: env.DATABASE_URL });
    shouldCloseDb = true;
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
  } finally {
    if (
      shouldCloseDb &&
      db &&
      'close' in db &&
      typeof (db as { close?: () => Promise<void> }).close === 'function'
    ) {
      await (db as { close: () => Promise<void> }).close().catch(() => {});
    }
  }
}

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
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
