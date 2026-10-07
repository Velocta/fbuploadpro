import { describe, expect, it } from 'vitest';
import worker, { type Env } from '../src/index.js';

describe('Cloudflare Worker Health Probing', () => {
  const dummyEnv: Env = { ENVIRONMENT: 'test' };
  const dummyCtx = {} as ExecutionContext;

  it('GET /health returns 200 OK with worker identification', async () => {
    const request = new Request('https://worker.internal/health', {
      method: 'GET',
    });

    const response = await worker.fetch(request, dummyEnv, dummyCtx);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const data = await response.json();
    expect(data).toEqual({
      status: 'ok',
      worker: 'fbuploadpro-worker',
    });
  });

  it('unhandled routes return 404 Not Found fallback', async () => {
    const request = new Request('https://worker.internal/unknown-endpoint', {
      method: 'GET',
    });

    const response = await worker.fetch(request, dummyEnv, dummyCtx);
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const data = await response.json();
    expect(data).toEqual({
      error: 'Not Found',
    });
  });

  it('non-GET methods on /health return 404 Not Found', async () => {
    const request = new Request('https://worker.internal/health', {
      method: 'POST',
    });

    const response = await worker.fetch(request, dummyEnv, dummyCtx);
    expect(response.status).toBe(404);
  });
});
