import { describe, expect, it } from 'vitest';
import worker, { type Env } from '../src/index.js';

describe('Cloudflare Worker Scheduled Cron Handler', () => {
  const dummyEnv: Env = {
    ENVIRONMENT: 'test',
    FB_ENCRYPTION_MASTER_KEY: 'test-master-key',
    FB_GRAPH_API_URL: 'https://graph.facebook.com/v21.0',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/fbuploadpro_test',
  };

  const dummyController: ScheduledController = {
    cron: '* * * * *',
    scheduledTime: Date.now(),
    noRetry: () => {},
  };

  const dummyCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  it('exports a scheduled handler function', () => {
    expect(worker.scheduled).toBeDefined();
    expect(typeof worker.scheduled).toBe('function');
  });

  it('executes scheduled handler returning Promise<void>', async () => {
    expect(worker.scheduled).toBeDefined();
    const result = await worker.scheduled(dummyController, dummyEnv, dummyCtx);
    expect(result).toBeUndefined();
  });
});
