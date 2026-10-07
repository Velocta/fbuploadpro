import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ClaimedQueueItem, DispatchOutcome } from '@fbuploadpro/contracts';
import { settleOutcome } from '../src/settlement.js';
import { runDispatchCycle, type DispatcherDbClient } from '../src/dispatcher.js';
import { MockFacebookPublishClient } from '../src/fb-client.js';

describe('User Story 4: Atomic Token Settlement & Publish Logs (T136, T137)', () => {
  const sampleItem: ClaimedQueueItem = {
    id: '11111111-1111-4111-a111-111111111111',
    userId: '22222222-2222-4222-a222-222222222222',
    pageId: '33333333-3333-4333-a333-333333333333',
    mediaId: '44444444-4444-4444-a444-444444444444',
    caption: 'Sample caption for video reel',
    firstComment: 'First comment text',
    retryCount: 0,
    maxRetries: 3,
    mediaType: 'video',
    mediaUrl: 'https://r2.fbuploadpro.com/media/video.mp4',
    storageKey: 'users/22222222-2222-4222-a222-222222222222/video.mp4',
    fbPageId: '10987654321',
    encryptedPageToken: 'valid-encrypted-token',
    pageName: 'Acme Official Page',
  };

  const sampleRetriedItem: ClaimedQueueItem = {
    ...sampleItem,
    retryCount: 1,
  };

  describe('settleOutcome Unit Tests', () => {
    it('settles successful publish by deducting 1 token, inserting token_transactions ledger, updating queue item, and recording success publish_log', async () => {
      const queriesExecuted: Array<{ sql: string; params: unknown[] | undefined }> = [];
      const mockTx = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          queriesExecuted.push({ sql, params });
          return Promise.resolve([]);
        }),
      };

      const mockDb: DispatcherDbClient = {
        query: vi.fn(),
        withTransaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
          return await cb(mockTx);
        }),
      };

      const outcome: DispatchOutcome = {
        queueItemId: sampleItem.id,
        status: 'published',
        fbPostId: 'fb_post_12345',
        fbCommentId: 'fb_comment_67890',
        tokensDeducted: 1,
      };

      await settleOutcome(mockDb, sampleItem, outcome);

      expect(mockDb.withTransaction).toHaveBeenCalledTimes(1);
      expect(mockTx.query).toHaveBeenCalledTimes(4);

      // 1. Atomically decrement user token balance (enforces balance >= 1)
      const userUpdate = queriesExecuted.find((q) => q.sql.includes('UPDATE users'));
      expect(userUpdate).toBeDefined();
      expect(userUpdate!.sql).toContain('tokens_balance = tokens_balance - 1');
      expect(userUpdate!.sql).toContain('tokens_balance >= 1');
      expect(userUpdate!.params).toEqual([sampleItem.userId]);

      // 2. Insert into token_transactions
      const ledgerInsert = queriesExecuted.find((q) => q.sql.includes('INSERT INTO token_transactions'));
      expect(ledgerInsert).toBeDefined();
      expect(ledgerInsert!.sql).toContain('transaction_type');
      expect(ledgerInsert!.params).toEqual([
        sampleItem.userId,
        1,
        'debit',
        sampleItem.id,
        expect.stringContaining('Acme Official Page'),
      ]);

      // 3. Update queue_items status to published
      const queueUpdate = queriesExecuted.find((q) => q.sql.includes('UPDATE queue_items'));
      expect(queueUpdate).toBeDefined();
      expect(queueUpdate!.sql).toContain("status = 'published'");
      expect(queueUpdate!.sql).toContain('published_at = now()');
      expect(queueUpdate!.params).toEqual([
        sampleItem.id,
        'fb_post_12345',
        'fb_comment_67890',
      ]);

      // 4. Insert into publish_logs with status 'success' and tokens_deducted: 1
      const logInsert = queriesExecuted.find((q) => q.sql.includes('INSERT INTO publish_logs'));
      expect(logInsert).toBeDefined();
      expect(logInsert!.params).toEqual([
        sampleItem.userId,
        sampleItem.id,
        sampleItem.pageId,
        'success',
        1, // attemptNumber = retryCount (0) + 1
        null,
        null,
        null,
        1, // tokens_deducted
      ]);
    });

    it('settles failed publish with 0 tokens deducted, updating queue item to failed, and inserting failure publish_log', async () => {
      const queriesExecuted: Array<{ sql: string; params: unknown[] | undefined }> = [];
      const mockDb: DispatcherDbClient = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          queriesExecuted.push({ sql, params });
          return Promise.resolve([]);
        }),
      };

      const outcome: DispatchOutcome = {
        queueItemId: sampleItem.id,
        status: 'failed',
        errorMessage: 'Invalid OAuth token',
        errorCode: 190,
        tokensDeducted: 0,
      };

      await settleOutcome(mockDb, sampleItem, outcome);

      // Zero tokens deducted: NO query touching users or token_transactions
      const userUpdate = queriesExecuted.find((q) => q.sql.includes('UPDATE users'));
      const ledgerInsert = queriesExecuted.find((q) => q.sql.includes('INSERT INTO token_transactions'));
      expect(userUpdate).toBeUndefined();
      expect(ledgerInsert).toBeUndefined();

      // 1. Update queue_items to failed
      const queueUpdate = queriesExecuted.find((q) => q.sql.includes('UPDATE queue_items'));
      expect(queueUpdate).toBeDefined();
      expect(queueUpdate!.sql).toContain("status = 'failed'");
      expect(queueUpdate!.sql).toContain('retry_count = retry_count + 1');
      expect(queueUpdate!.params).toEqual([sampleItem.id]);

      // 2. Insert into publish_logs with failure status, error code, error message, and tokens_deducted: 0
      const logInsert = queriesExecuted.find((q) => q.sql.includes('INSERT INTO publish_logs'));
      expect(logInsert).toBeDefined();
      expect(logInsert!.params).toEqual([
        sampleItem.userId,
        sampleItem.id,
        sampleItem.pageId,
        'failure',
        1, // attemptNumber
        190, // fb_response_code
        'Invalid OAuth token', // error_message
        JSON.stringify({ errorCode: 190 }), // error_details
        0, // tokens_deducted
      ]);
    });

    it('settles retry publish with 0 tokens deducted, rescheduling queue item for retry, and inserting retry publish_log', async () => {
      const queriesExecuted: Array<{ sql: string; params: unknown[] | undefined }> = [];
      const mockDb: DispatcherDbClient = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          queriesExecuted.push({ sql, params });
          return Promise.resolve([]);
        }),
      };

      const outcome: DispatchOutcome = {
        queueItemId: sampleRetriedItem.id,
        status: 'retry',
        errorMessage: 'Rate limit reached',
        errorCode: 32,
        tokensDeducted: 0,
      };

      await settleOutcome(mockDb, sampleRetriedItem, outcome);

      // Zero tokens deducted
      expect(queriesExecuted.find((q) => q.sql.includes('UPDATE users'))).toBeUndefined();
      expect(queriesExecuted.find((q) => q.sql.includes('INSERT INTO token_transactions'))).toBeUndefined();

      // 1. Reschedule queue_items
      const queueUpdate = queriesExecuted.find((q) => q.sql.includes('UPDATE queue_items'));
      expect(queueUpdate).toBeDefined();
      expect(queueUpdate!.sql).toContain("status = 'queued'");
      expect(queueUpdate!.sql).toContain('retry_count = retry_count + 1');
      expect(queueUpdate!.sql).toContain("scheduled_time = now() + interval '5 minutes'");
      expect(queueUpdate!.params).toEqual([sampleRetriedItem.id]);

      // 2. Insert into publish_logs with status 'retry', attempt_number: 2
      const logInsert = queriesExecuted.find((q) => q.sql.includes('INSERT INTO publish_logs'));
      expect(logInsert).toBeDefined();
      expect(logInsert!.params).toEqual([
        sampleRetriedItem.userId,
        sampleRetriedItem.id,
        sampleRetriedItem.pageId,
        'retry',
        2, // attempt_number = retryCount (1) + 1
        32,
        'Rate limit reached',
        JSON.stringify({ errorCode: 32 }),
        0, // tokens_deducted
      ]);
    });
  });

  describe('runDispatchCycle Settlement Integration', () => {
    const TEST_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('invokes settleOutcome to atomically deduct token on successful cycle execution', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.nextPostId = '10987654321_post_success';

      const mockRawRows = [
        {
          id: sampleItem.id,
          user_id: sampleItem.userId,
          fb_page_id: sampleItem.pageId,
          media_id: sampleItem.mediaId,
          caption: sampleItem.caption,
          first_comment: sampleItem.firstComment,
          retry_count: 0,
          max_retries: 3,
          media_type: 'video',
          media_url: sampleItem.mediaUrl,
          storage_key: sampleItem.storageKey,
          external_page_id: sampleItem.fbPageId,
          encrypted_access_token: 'valid_encrypted_token',
          page_name: sampleItem.pageName,
        },
      ];

      const queriesExecuted: string[] = [];
      const mockDb: DispatcherDbClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          queriesExecuted.push(sql);
          if (sql.includes('FOR UPDATE SKIP LOCKED')) {
            return Promise.resolve(mockRawRows);
          }
          return Promise.resolve([]);
        }),
      };

      // Mock decryptToken
      vi.mock('@fbuploadpro/contracts', async (importOriginal) => {
        const actual = await importOriginal<typeof import('@fbuploadpro/contracts')>();
        return {
          ...actual,
          decryptToken: vi.fn().mockResolvedValue('decrypted_token'),
        };
      });

      const result = await runDispatchCycle({
        db: mockDb,
        fbClient: mockFbClient,
        masterKey: TEST_MASTER_KEY,
        limit: 10,
      });

      expect(result).toEqual({
        processed: 1,
        succeeded: 1,
        failed: 0,
        retried: 0,
      });

      // Verify settlement queries executed
      expect(queriesExecuted.some((q) => q.includes('UPDATE users'))).toBe(true);
      expect(queriesExecuted.some((q) => q.includes('INSERT INTO token_transactions'))).toBe(true);
      expect(queriesExecuted.some((q) => q.includes('INSERT INTO publish_logs'))).toBe(true);
    });
  });
});
