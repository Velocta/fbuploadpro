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
