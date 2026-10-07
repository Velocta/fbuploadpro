export interface Env {
  ENVIRONMENT?: string;
  FB_ENCRYPTION_MASTER_KEY?: string;
  FB_GRAPH_API_URL?: string;
  DATABASE_URL?: string;
}

export * from './fb-client.js';

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
    _controller: ScheduledController,
    _env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    // Scheduled cron trigger handler skeleton
  },
};

