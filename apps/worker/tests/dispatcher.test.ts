import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  encryptToken,
  type ClaimedQueueItem,
} from '@fbuploadpro/contracts';
import {
  claimDueItems,
  dispatchItem,
  recordDispatchOutcome,
  runDispatchCycle,
  PublishDispatcher,
} from '../src/dispatcher.js';
import {
  MockFacebookPublishClient,
  FacebookGraphError,
} from '../src/fb-client.js';
import worker, { handleScheduled, type Env } from '../src/index.js';

describe('Edge Dispatcher & Facebook Graph API Streaming (T132, T133, T134, T135)', () => {
  const TEST_MASTER_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const RAW_PAGE_TOKEN = 'EAABtest_page_access_token_12345';
  let validEncryptedToken: string;

  const sampleClaimedVideoItem: ClaimedQueueItem = {
    id: '11111111-1111-4111-a111-111111111111',
    userId: '22222222-2222-4222-a222-222222222222',
    pageId: '33333333-3333-4333-a333-333333333333',
    mediaId: '44444444-4444-4444-a444-444444444444',
    caption: 'Awesome reel caption #viral',
    firstComment: 'Check out our link: https://example.com/shop',
    retryCount: 0,
    maxRetries: 3,
    mediaType: 'video',
    mediaUrl: 'https://r2.fbuploadpro.com/media/video.mp4',
    storageKey: 'users/22222222-2222-4222-a222-222222222222/video.mp4',
    fbPageId: '10987654321',
    encryptedPageToken: '',
    pageName: 'Acme Official Page',
  };

  const sampleClaimedPhotoItem: ClaimedQueueItem = {
    id: '55555555-5555-4555-a555-555555555555',
    userId: '22222222-2222-4222-a222-222222222222',
    pageId: '33333333-3333-4333-a333-333333333333',
    mediaId: '66666666-6666-4666-a666-666666666666',
    caption: 'Stunning photo post',
    firstComment: null,
    retryCount: 0,
    maxRetries: 3,
    mediaType: 'image',
    mediaUrl: 'https://r2.fbuploadpro.com/media/photo.jpg',
    storageKey: 'users/22222222-2222-4222-a222-222222222222/photo.jpg',
    fbPageId: '10987654321',
    encryptedPageToken: '',
    pageName: 'Acme Official Page',
  };

  beforeEach(async () => {
    validEncryptedToken = await encryptToken(RAW_PAGE_TOKEN, TEST_MASTER_KEY);
    sampleClaimedVideoItem.encryptedPageToken = validEncryptedToken;
    sampleClaimedPhotoItem.encryptedPageToken = validEncryptedToken;
  });

  describe('T132: PostgreSQL FOR UPDATE SKIP LOCKED Claim Logic', () => {
    it('claims due queue items and updates status to publishing within transaction', async () => {
      const mockRawRows = [
        {
          id: sampleClaimedVideoItem.id,
          user_id: sampleClaimedVideoItem.userId,
          fb_page_id: sampleClaimedVideoItem.pageId,
          media_id: sampleClaimedVideoItem.mediaId,
          caption: sampleClaimedVideoItem.caption,
          first_comment: sampleClaimedVideoItem.firstComment,
          retry_count: 0,
          max_retries: 3,
          media_type: 'video',
          media_url: sampleClaimedVideoItem.mediaUrl,
          storage_key: sampleClaimedVideoItem.storageKey,
          external_page_id: sampleClaimedVideoItem.fbPageId,
          encrypted_access_token: validEncryptedToken,
          page_name: sampleClaimedVideoItem.pageName,
        },
      ];

      const queriesExecuted: Array<{ sql: string; params: unknown[] | undefined }> = [];
      const mockTx = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          queriesExecuted.push({ sql, params });
          if (sql.includes('FOR UPDATE SKIP LOCKED')) {
            return Promise.resolve(mockRawRows);
          }
          if (sql.includes("SET status = 'publishing'")) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const mockDb = {
        query: vi.fn(),
        withTransaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
          return await cb(mockTx);
        }),
      };

      const claimed = await claimDueItems(mockDb as any, 10);

      expect(mockDb.withTransaction).toHaveBeenCalledTimes(1);
      expect(mockTx.query).toHaveBeenCalledTimes(2);

      // Verify SELECT with FOR UPDATE SKIP LOCKED
      const selectQuery = queriesExecuted[0];
      expect(selectQuery.sql).toContain('FOR UPDATE SKIP LOCKED');
      expect(selectQuery.sql).toContain("qi.status = 'queued'");
      expect(selectQuery.sql).toContain('qi.scheduled_time <= now()');
      expect(selectQuery.params).toEqual([10]);

      // Verify UPDATE to 'publishing'
      const updateQuery = queriesExecuted[1];
      expect(updateQuery.sql).toContain("status = 'publishing'");
      expect(updateQuery.sql).toContain('WHERE id = ANY($1)');
      expect(updateQuery.params).toEqual([[sampleClaimedVideoItem.id]]);

      // Verify returned claimed items
      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe(sampleClaimedVideoItem.id);
      expect(claimed[0].mediaType).toBe('video');
      expect(claimed[0].fbPageId).toBe(sampleClaimedVideoItem.fbPageId);
      expect(claimed[0].encryptedPageToken).toBe(validEncryptedToken);
    });

    it('returns empty array and skips update when no queue items are due', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue([]),
      };

      const claimed = await claimDueItems(mockDb as any, 5);

      expect(claimed).toEqual([]);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE SKIP LOCKED'),
        [5]
      );
    });
  });

  describe('T133: Token Decryption & Media Dispatching Loop', () => {
    it('decrypts page access token and streams video to publishReel', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.nextPostId = '10987654321_video_99999';

      const outcome = await dispatchItem(sampleClaimedVideoItem, mockFbClient, TEST_MASTER_KEY);

      expect(outcome.status).toBe('published');
      expect(outcome.fbPostId).toBe('10987654321_video_99999');

      expect(mockFbClient.reelsPublished).toHaveLength(1);
      expect(mockFbClient.reelsPublished[0]).toEqual({
        pageId: sampleClaimedVideoItem.fbPageId,
        accessToken: RAW_PAGE_TOKEN,
        videoUrl: sampleClaimedVideoItem.mediaUrl,
        caption: sampleClaimedVideoItem.caption,
      });
      expect(mockFbClient.photosPublished).toHaveLength(0);
    });

    it('decrypts page access token and posts image to publishPhoto', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.nextPostId = '10987654321_photo_88888';

      const outcome = await dispatchItem(sampleClaimedPhotoItem, mockFbClient, TEST_MASTER_KEY);

      expect(outcome.status).toBe('published');
      expect(outcome.fbPostId).toBe('10987654321_photo_88888');

      expect(mockFbClient.photosPublished).toHaveLength(1);
      expect(mockFbClient.photosPublished[0]).toEqual({
        pageId: sampleClaimedPhotoItem.fbPageId,
        accessToken: RAW_PAGE_TOKEN,
        imageUrl: sampleClaimedPhotoItem.mediaUrl,
        caption: sampleClaimedPhotoItem.caption,
      });
      expect(mockFbClient.reelsPublished).toHaveLength(0);
    });

    it('handles token decryption failure gracefully and returns failed outcome with 0 tokens deducted', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      const corruptedItem: ClaimedQueueItem = {
        ...sampleClaimedVideoItem,
        encryptedPageToken: 'invalid:tampered_token_payload',
      };

      const outcome = await dispatchItem(corruptedItem, mockFbClient, TEST_MASTER_KEY);

      expect(outcome.status).toBe('failed');
      expect(outcome.errorMessage).toContain('Token decryption failed');
      expect(mockFbClient.reelsPublished).toHaveLength(0);
    });

    it('returns failed status without retry on Facebook auth error (code 190)', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.errorToThrow = new FacebookGraphError('Session has expired', {
        message: 'Session has expired',
        code: 190,
        type: 'OAuthException',
      });

      const outcome = await dispatchItem(sampleClaimedVideoItem, mockFbClient, TEST_MASTER_KEY);

      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe(190);
    });

    it('returns retry status on transient/rate-limit error when retryCount < maxRetries', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.errorToThrow = new FacebookGraphError('User request limit reached', {
        message: 'User request limit reached',
        code: 32,
      });

      const outcome = await dispatchItem(
        { ...sampleClaimedVideoItem, retryCount: 1, maxRetries: 3 },
        mockFbClient,
        TEST_MASTER_KEY
      );

      expect(outcome.status).toBe('retry');
      expect(outcome.errorCode).toBe(32);
    });

    it('returns failed status when maxRetries exhausted even on transient error', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.errorToThrow = new FacebookGraphError('Temporary Facebook network failure', {
        message: 'Temporary Facebook network failure',
        code: 2,
      });

      const outcome = await dispatchItem(
        { ...sampleClaimedVideoItem, retryCount: 3, maxRetries: 3 },
        mockFbClient,
        TEST_MASTER_KEY
      );

      expect(outcome.status).toBe('failed');
    });

    it('marks targetPageStatus as fb_rate_limited on error 368 + subcode 1390008', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.errorToThrow = new FacebookGraphError(
        'We limit how often you can post, comment or do other things...',
        {
          message: 'We limit how often you can post, comment or do other things...',
          code: 368,
          error_subcode: 1390008,
        }
      );

      const outcome = await dispatchItem(sampleClaimedVideoItem, mockFbClient, TEST_MASTER_KEY);

      expect(outcome.errorCode).toBe(368);
      expect(outcome.errorSubcode).toBe(1390008);
      expect(outcome.targetPageStatus).toBe('fb_rate_limited');
    });

    it('marks item failed without retry and sets targetPageStatus to page_checkpoint on error 368 + subcode 4854002', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.errorToThrow = new FacebookGraphError(
        'Confirm your identity before you can publish as this Page.',
        {
          message: 'Confirm your identity before you can publish as this Page.',
          code: 368,
          error_subcode: 4854002,
        }
      );

      const outcome = await dispatchItem(sampleClaimedVideoItem, mockFbClient, TEST_MASTER_KEY);

      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe(368);
      expect(outcome.errorSubcode).toBe(4854002);
      expect(outcome.targetPageStatus).toBe('page_checkpoint');
      expect(outcome.errorMessage).toContain(
        'Confirm your identity before you can publish as this Page.'
      );
      expect(outcome.errorMessage).toContain('mobile');
    });

    it('marks item failed without retry and keeps page active on error 368 + subcode 1404082 (duplicate content)', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.errorToThrow = new FacebookGraphError(
        "You've already posted this. Posting the same content repeatedly...",
        {
          message: "You've already posted this. Posting the same content repeatedly...",
          code: 368,
          error_subcode: 1404082,
        }
      );

      const outcome = await dispatchItem(sampleClaimedVideoItem, mockFbClient, TEST_MASTER_KEY);

      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe(368);
      expect(outcome.errorSubcode).toBe(1404082);
      expect(outcome.targetPageStatus).toBeUndefined();
      expect(outcome.errorMessage).toContain("You've already posted this");
    });
  });

  describe('T134: Automated First Comment & External Post ID Recording', () => {
    it('posts automated first comment after successful media publication', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.nextPostId = '10987654321_post_777';
      mockFbClient.nextCommentId = 'comment_12345';

      const outcome = await dispatchItem(sampleClaimedVideoItem, mockFbClient, TEST_MASTER_KEY);

      expect(outcome.status).toBe('published');
      expect(outcome.fbPostId).toBe('10987654321_post_777');
      expect(outcome.fbCommentId).toBe('comment_12345');
      expect(mockFbClient.commentsPosted).toHaveLength(1);
      expect(mockFbClient.commentsPosted[0]).toEqual({
        postId: '10987654321_post_777',
        accessToken: RAW_PAGE_TOKEN,
        message: 'Check out our link: https://example.com/shop',
      });
    });

    it('keeps post published if first comment posting fails', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      mockFbClient.nextPostId = '10987654321_post_888';
      // Mock postComment to throw
      mockFbClient.postComment = vi.fn().mockRejectedValue(new Error('Comment rate limit'));

      const outcome = await dispatchItem(sampleClaimedVideoItem, mockFbClient, TEST_MASTER_KEY);

      expect(outcome.status).toBe('published');
      expect(outcome.fbPostId).toBe('10987654321_post_888');
      expect(outcome.fbCommentId).toBeUndefined();
    });

    it('records external post ID and comment ID into queue_items database table', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue([]),
      };

      await recordDispatchOutcome(mockDb as any, {
        queueItemId: sampleClaimedVideoItem.id,
        status: 'published',
        fbPostId: 'fb_post_999',
        fbCommentId: 'fb_comment_888',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE queue_items\n       SET status = 'published'"),
        [sampleClaimedVideoItem.id, 'fb_post_999', 'fb_comment_888']
      );
    });

    it('reschedules queue item for retry on transient outcome', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue([]),
      };

      await recordDispatchOutcome(mockDb as any, {
        queueItemId: sampleClaimedVideoItem.id,
        status: 'retry',
        errorMessage: 'Transient error',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE queue_items\n       SET status = 'queued'"),
        [sampleClaimedVideoItem.id]
      );
    });

    it('marks queue item failed on permanent failure outcome', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue([]),
      };

      await recordDispatchOutcome(mockDb as any, {
        queueItemId: sampleClaimedVideoItem.id,
        status: 'failed',
        errorMessage: 'Invalid credentials',
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE queue_items\n       SET status = 'failed'"),
        [sampleClaimedVideoItem.id]
      );
    });
  });

  describe('runDispatchCycle Batch Coordination', () => {
    it('executes claim, dispatch, and settlement across batch items', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      const mockRawRows = [
        {
          id: sampleClaimedVideoItem.id,
          user_id: sampleClaimedVideoItem.userId,
          fb_page_id: sampleClaimedVideoItem.pageId,
          media_id: sampleClaimedVideoItem.mediaId,
          caption: sampleClaimedVideoItem.caption,
          first_comment: sampleClaimedVideoItem.firstComment,
          retry_count: 0,
          max_retries: 3,
          media_type: 'video',
          media_url: sampleClaimedVideoItem.mediaUrl,
          storage_key: sampleClaimedVideoItem.storageKey,
          external_page_id: sampleClaimedVideoItem.fbPageId,
          encrypted_access_token: validEncryptedToken,
          page_name: sampleClaimedVideoItem.pageName,
        },
      ];

      const queries: string[] = [];
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          queries.push(sql);
          if (sql.includes('FOR UPDATE SKIP LOCKED')) {
            return Promise.resolve(mockRawRows);
          }
          return Promise.resolve([]);
        }),
      };

      const result = await runDispatchCycle({
        db: mockDb as any,
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

      expect(mockFbClient.reelsPublished).toHaveLength(1);
    });

    it('PublishDispatcher class implements IPublishDispatcher interface', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      const mockDb = {
        query: vi.fn().mockResolvedValue([]),
      };

      const dispatcher = new PublishDispatcher(mockDb as any, mockFbClient, TEST_MASTER_KEY);

      expect(typeof dispatcher.claimDueItems).toBe('function');
      expect(typeof dispatcher.dispatchItem).toBe('function');
      expect(typeof dispatcher.settleOutcome).toBe('function');
      expect(typeof dispatcher.runDispatchCycle).toBe('function');

      const cycle = await dispatcher.runDispatchCycle(5);
      expect(cycle.processed).toBe(0);
    });
  });

  describe('T135: Wire Cloudflare Worker Scheduled Cron Handler', () => {
    const dummyController: ScheduledController = {
      cron: '* * * * *',
      scheduledTime: Date.now(),
      noRetry: () => {},
    };

    const dummyCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    it('triggers runDispatchCycle on scheduled event with configured options', async () => {
      const mockFbClient = new MockFacebookPublishClient();
      const mockDb = {
        query: vi.fn().mockResolvedValue([]),
      };

      const env: Env = {
        ENVIRONMENT: 'test',
        FB_ENCRYPTION_MASTER_KEY: TEST_MASTER_KEY,
        FB_GRAPH_API_URL: 'https://graph.facebook.com/v26.0',
      };

      await handleScheduled(dummyController, env, dummyCtx, {
        db: mockDb as any,
        fbClient: mockFbClient,
      });

      // Claim query was executed
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE SKIP LOCKED'),
        [10]
      );
    });

    it('skips scheduled cycle when FB_ENCRYPTION_MASTER_KEY is not configured', async () => {
      const mockDb = { query: vi.fn() };
      const env: Env = {};

      await handleScheduled(dummyController, env, dummyCtx, { db: mockDb as any });

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('exports worker default object with scheduled function', async () => {
      expect(typeof worker.scheduled).toBe('function');
      const env: Env = { ENVIRONMENT: 'test' };
      const res = await worker.scheduled(dummyController, env, dummyCtx);
      expect(res).toBeUndefined();
    });
  });
});
