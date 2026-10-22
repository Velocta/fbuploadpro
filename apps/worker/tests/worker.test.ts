import { describe, expect, it, vi } from 'vitest';
import worker, { handleScheduled, type Env } from '../src/index.js';
import { runDispatchCycle, type DispatcherDbClient } from '../src/dispatcher.js';
import { MockFacebookPublishClient } from '../src/fb-client.js';
import type { ClaimedQueueItem } from '@fbuploadpro/contracts';

vi.mock('@fbuploadpro/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fbuploadpro/contracts')>();
  return {
    ...actual,
    decryptToken: vi.fn().mockResolvedValue('decrypted_access_token'),
  };
});

const VALID_WORKER_TOKEN_KEY =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

function healthyWorkerDb() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ error: null }),
    })),
  };
}

function healthyWorkerEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: 'test',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    TOKEN_ENCRYPTION_KEY: VALID_WORKER_TOKEN_KEY,
    __TEST_DB__: healthyWorkerDb(),
    ...overrides,
  };
}

describe('Cloudflare Worker Health Probing', () => {
  const dummyCtx = {} as ExecutionContext;

  it('GET /health returns 200 OK with boolean checks when DB and config pass', async () => {
    const request = new Request('https://worker.internal/health', {
      method: 'GET',
    });

    const response = await worker.fetch(request, healthyWorkerEnv(), dummyCtx);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const data = (await response.json()) as Record<string, unknown>;
    expect(data.status).toBe('ok');
    expect(data.worker).toBe('fbuploadpro-worker');
    expect(data.checks).toEqual({ database: true, config: true });
    expect(Object.keys(data).sort()).toEqual(['checks', 'status', 'timestamp', 'worker']);
    expect(new Date(String(data.timestamp)).getTime()).not.toBeNaN();
  });

  it('GET /health returns 503 when TOKEN_ENCRYPTION_KEY is removed', async () => {
    const env = healthyWorkerEnv();
    delete env.TOKEN_ENCRYPTION_KEY;
    const request = new Request('https://worker.internal/health', { method: 'GET' });

    const response = await worker.fetch(request, env, dummyCtx);
    expect(response.status).toBe(503);
    const data = (await response.json()) as { status: string; checks: Record<string, boolean> };
    expect(data.status).toBe('unhealthy');
    expect(data.checks).toEqual({ database: true, config: false });
  });

  it('GET /health returns 503 and leaks no detail when the database probe fails', async () => {
    const failingDb = {
      from: vi.fn(() => ({
        select: vi
          .fn()
          .mockResolvedValue({ error: new Error('connect postgres://admin:secretpw@10.0.0.1/db') }),
      })),
    };
    const env = healthyWorkerEnv({ __TEST_DB__: failingDb });
    const request = new Request('https://worker.internal/health', { method: 'GET' });

    const response = await worker.fetch(request, env, dummyCtx);
    expect(response.status).toBe(503);
    const text = await response.text();
    const data = JSON.parse(text) as { status: string; checks: Record<string, boolean> };
    expect(data.checks.database).toBe(false);
    expect(text).not.toContain('secretpw');
    expect(text).not.toContain('10.0.0.1');
    expect(text).not.toContain('postgres://');
  });

  it('GET /health returns 503 when the database is unconfigured', async () => {
    const env: Env = { ENVIRONMENT: 'test' };
    const request = new Request('https://worker.internal/health', { method: 'GET' });

    const response = await worker.fetch(request, env, dummyCtx);
    expect(response.status).toBe(503);
    const data = (await response.json()) as { checks: Record<string, boolean> };
    expect(data.checks).toEqual({ database: false, config: false });
  });

  it('unhandled routes return 404 Not Found fallback', async () => {
    const request = new Request('https://worker.internal/unknown-endpoint', {
      method: 'GET',
    });

    const response = await worker.fetch(request, healthyWorkerEnv(), dummyCtx);
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

    const response = await worker.fetch(request, healthyWorkerEnv(), dummyCtx);
    expect(response.status).toBe(404);
  });
});

describe('Worker Heartbeat (Spec 116)', () => {
  const controller = {
    cron: '* * * * *',
    scheduledTime: Date.now(),
    noRetry: () => {},
  } as unknown as ScheduledController;
  const ctx = {} as ExecutionContext;

  function heartbeatCaptureDb() {
    const upserts: Record<string, unknown>[] = [];
    const db = {
      from: vi.fn(() => ({
        upsert: vi.fn(async (row: Record<string, unknown>) => {
          upserts.push(row);
          return { error: null };
        }),
      })),
      query: vi.fn().mockResolvedValue([]),
    };
    return { db, upserts };
  }

  it('records a heartbeat with the skip reason when TOKEN_ENCRYPTION_KEY is missing', async () => {
    const { db, upserts } = heartbeatCaptureDb();
    const env: Env = { ENVIRONMENT: 'test' };

    await handleScheduled(controller, env, ctx, { db: db as never });

    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.worker_name).toBe('fbuploadpro-worker');
    expect(upserts[0]?.last_skip_reason).toBe('missing_token_encryption_key');
    expect(upserts[0]?.last_success_at).toBeUndefined();
    expect(typeof upserts[0]?.last_run_at).toBe('string');
  });

  it('records a success heartbeat with claimed/settled counts after a dispatch cycle', async () => {
    const { db, upserts } = heartbeatCaptureDb();
    const env: Env = {
      ENVIRONMENT: 'test',
      TOKEN_ENCRYPTION_KEY: VALID_WORKER_TOKEN_KEY,
    };

    await handleScheduled(controller, env, ctx, { db: db as never });

    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.last_skip_reason).toBeNull();
    expect(typeof upserts[0]?.last_success_at).toBe('string');
    expect(upserts[0]?.last_claimed_count).toBe(0);
    expect(upserts[0]?.last_settled_count).toBe(0);
  });
});

describe('Parallel Batch Execution in runDispatchCycle (Spec 042)', () => {
  const TEST_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('processes multiple items with bounded parallel concurrency and returns aggregate stats', async () => {
    const mockClient = new MockFacebookPublishClient();
    mockClient.nextPostId = '10987654321_post_success';

    const items = [1, 2, 3].map((num) => ({
      id: `11111111-1111-4111-a111-11111111111${num}`,
      userId: '22222222-2222-4222-a222-222222222222',
      pageId: '33333333-3333-4333-a333-333333333333',
      postFormat: 'text' as const,
      mediaId: null,
      caption: `Post caption ${num}`,
      firstComment: null,
      retryCount: 0,
      maxRetries: 3,
      mediaType: 'image' as const,
      mediaUrl: '',
      storageKey: '',
      fbPageId: '10987654321',
      encryptedPageToken: 'valid-token',
      pageName: 'Acme Official Page',
    }));

    const mockDb: DispatcherDbClient = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FOR UPDATE SKIP LOCKED')) {
          return Promise.resolve(
            items.map((i) => ({
              id: i.id,
              user_id: i.userId,
              fb_page_id: i.pageId,
              media_id: null,
              caption: i.caption,
              first_comment: null,
              retry_count: 0,
              max_retries: 3,
              media_type: null,
              media_url: null,
              storage_key: null,
              external_page_id: i.fbPageId,
              encrypted_access_token: i.encryptedPageToken,
              page_name: i.pageName,
              post_format: 'text',
            }))
          );
        }
        return Promise.resolve([]);
      }),
    };

    const result = await runDispatchCycle({
      db: mockDb,
      fbClient: mockClient,
      masterKey: TEST_MASTER_KEY,
      limit: 10,
      concurrency: 2,
    });

    expect(result).toEqual({
      processed: 3,
      succeeded: 3,
      failed: 0,
      retried: 0,
    });
    expect(mockClient.textPostsPublished).toHaveLength(3);
  });
});
