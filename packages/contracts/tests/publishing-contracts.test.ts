import { describe, it, expect } from 'vitest';
import {
  SlotTimeSchema,
  TimezoneSchema,
  CreateQueueSlotRequestSchema,
  UpdateQueueSlotRequestSchema,
  PageQueueSlotSchema,
  ListQueueSlotsResponseSchema,
  QueueItemStatusSchema,
  EnqueueMediaRequestSchema,
  UpdateQueueItemRequestSchema,
  QueueItemSchema,
  ListQueueItemsQuerySchema,
  ListQueueItemsResponseSchema,
  ClaimedQueueItemSchema,
  PublishLogSchema,
} from '../src/index.js';

describe('Publishing Engine Domain Contracts', () => {
  describe('Page Queue Slots Contracts (T115)', () => {
    describe('SlotTimeSchema', () => {
      it('accepts valid HH:MM formats', () => {
        expect(SlotTimeSchema.safeParse('09:30').success).toBe(true);
        expect(SlotTimeSchema.safeParse('00:00').success).toBe(true);
        expect(SlotTimeSchema.safeParse('23:59').success).toBe(true);
        expect(SlotTimeSchema.safeParse('14:05').success).toBe(true);
      });

      it('accepts valid HH:MM:SS formats', () => {
        expect(SlotTimeSchema.safeParse('09:30:00').success).toBe(true);
        expect(SlotTimeSchema.safeParse('23:59:59').success).toBe(true);
        expect(SlotTimeSchema.safeParse('00:00:01').success).toBe(true);
      });

      it('rejects invalid slot time formats', () => {
        expect(SlotTimeSchema.safeParse('24:00').success).toBe(false);
        expect(SlotTimeSchema.safeParse('25:00').success).toBe(false);
        expect(SlotTimeSchema.safeParse('12:60').success).toBe(false);
        expect(SlotTimeSchema.safeParse('9:30').success).toBe(false);
        expect(SlotTimeSchema.safeParse('12:34:567').success).toBe(false);
        expect(SlotTimeSchema.safeParse('invalid').success).toBe(false);
        expect(SlotTimeSchema.safeParse('').success).toBe(false);
      });
    });

    describe('TimezoneSchema', () => {
      it('defaults to UTC when undefined', () => {
        const res = TimezoneSchema.safeParse(undefined);
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data).toBe('UTC');
        }
      });

      it('accepts valid timezone strings', () => {
        expect(TimezoneSchema.safeParse('America/New_York').success).toBe(true);
        expect(TimezoneSchema.safeParse('Asia/Karachi').success).toBe(true);
      });

      it('rejects empty or overly long timezone strings', () => {
        expect(TimezoneSchema.safeParse('').success).toBe(false);
        expect(TimezoneSchema.safeParse('A'.repeat(51)).success).toBe(false);
      });
    });

    describe('CreateQueueSlotRequestSchema', () => {
      it('validates a valid create queue slot request', () => {
        const validPayload = {
          pageId: '11111111-1111-4111-a111-111111111111',
          slotTime: '10:00',
          timezone: 'America/New_York',
        };
        const res = CreateQueueSlotRequestSchema.safeParse(validPayload);
        expect(res.success).toBe(true);
      });

      it('rejects invalid pageId UUID', () => {
        const payload = {
          pageId: 'invalid-uuid',
          slotTime: '10:00',
        };
        const res = CreateQueueSlotRequestSchema.safeParse(payload);
        expect(res.success).toBe(false);
      });
    });

    describe('UpdateQueueSlotRequestSchema', () => {
      it('validates partial slot updates', () => {
        const res = UpdateQueueSlotRequestSchema.safeParse({
          isActive: false,
          slotTime: '18:30:00',
        });
        expect(res.success).toBe(true);
      });
    });

    describe('PageQueueSlotSchema', () => {
      it('validates complete PageQueueSlot domain model', () => {
        const slot = {
          id: '22222222-2222-4222-a222-222222222222',
          userId: '33333333-3333-4333-a333-333333333333',
          pageId: '11111111-1111-4111-a111-111111111111',
          slotTime: '14:00',
          timezone: 'UTC',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const res = PageQueueSlotSchema.safeParse(slot);
        expect(res.success).toBe(true);
      });
    });

    describe('ListQueueSlotsResponseSchema', () => {
      it('validates list response structure', () => {
        const res = ListQueueSlotsResponseSchema.safeParse({
          slots: [
            {
              id: '22222222-2222-4222-a222-222222222222',
              userId: '33333333-3333-4333-a333-333333333333',
              pageId: '11111111-1111-4111-a111-111111111111',
              slotTime: '14:00',
              timezone: 'UTC',
              isActive: true,
              createdAt: '2026-10-07T12:00:00.000Z',
              updatedAt: '2026-10-07T12:00:00.000Z',
            },
          ],
          total: 1,
        });
        expect(res.success).toBe(true);
      });
    });
  });

  describe('Queue Item & Enqueueing Contracts (T116)', () => {
    describe('QueueItemStatusSchema', () => {
      it('accepts all valid statuses', () => {
        const statuses = ['queued', 'publishing', 'published', 'failed', 'skipped'];
        for (const status of statuses) {
          expect(QueueItemStatusSchema.safeParse(status).success).toBe(true);
        }
      });

      it('rejects invalid statuses', () => {
        expect(QueueItemStatusSchema.safeParse('pending').success).toBe(false);
        expect(QueueItemStatusSchema.safeParse('processing').success).toBe(false);
        expect(QueueItemStatusSchema.safeParse('cancelled').success).toBe(false);
      });
    });

    describe('EnqueueMediaRequestSchema', () => {
      it('accepts valid enqueue request and defaults caption to empty string', () => {
        const res = EnqueueMediaRequestSchema.safeParse({
          pageId: '11111111-1111-4111-a111-111111111111',
          mediaId: '44444444-4444-4444-a444-444444444444',
        });
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.caption).toBe('');
          expect(res.data.firstComment).toBeUndefined();
        }
      });

      it('accepts caption up to 5000 characters and first comment up to 2000 characters', () => {
        const res = EnqueueMediaRequestSchema.safeParse({
          pageId: '11111111-1111-4111-a111-111111111111',
          mediaId: '44444444-4444-4444-a444-444444444444',
          caption: 'A'.repeat(5000),
          firstComment: 'B'.repeat(2000),
        });
        expect(res.success).toBe(true);
      });

      it('rejects caption exceeding 5000 characters', () => {
        const res = EnqueueMediaRequestSchema.safeParse({
          pageId: '11111111-1111-4111-a111-111111111111',
          mediaId: '44444444-4444-4444-a444-444444444444',
          caption: 'A'.repeat(5001),
        });
        expect(res.success).toBe(false);
      });

      it('rejects firstComment exceeding 2000 characters', () => {
        const res = EnqueueMediaRequestSchema.safeParse({
          pageId: '11111111-1111-4111-a111-111111111111',
          mediaId: '44444444-4444-4444-a444-444444444444',
          caption: 'Valid caption',
          firstComment: 'B'.repeat(2001),
        });
        expect(res.success).toBe(false);
      });
    });

    describe('UpdateQueueItemRequestSchema', () => {
      it('allows updating status to queued or skipped', () => {
        expect(UpdateQueueItemRequestSchema.safeParse({ status: 'queued' }).success).toBe(true);
        expect(UpdateQueueItemRequestSchema.safeParse({ status: 'skipped' }).success).toBe(true);
      });

      it('rejects updating status to published or failed via update schema', () => {
        expect(UpdateQueueItemRequestSchema.safeParse({ status: 'published' }).success).toBe(false);
        expect(UpdateQueueItemRequestSchema.safeParse({ status: 'failed' }).success).toBe(false);
      });

      it('enforces character limits on updates', () => {
        expect(UpdateQueueItemRequestSchema.safeParse({ caption: 'C'.repeat(5001) }).success).toBe(false);
        expect(UpdateQueueItemRequestSchema.safeParse({ firstComment: 'D'.repeat(2001) }).success).toBe(false);
      });
    });

    describe('QueueItemSchema', () => {
      it('validates full QueueItem domain model with nullable fields and media details', () => {
        const queueItem = {
          id: '55555555-5555-4555-a555-555555555555',
          userId: '33333333-3333-4333-a333-333333333333',
          pageId: '11111111-1111-4111-a111-111111111111',
          slotId: null,
          mediaId: '44444444-4444-4444-a444-444444444444',
          scheduledTime: '2026-10-07T15:00:00.000Z',
          caption: 'Check out our new reel!',
          firstComment: 'Link in bio: https://example.com',
          status: 'queued',
          retryCount: 0,
          maxRetries: 3,
          fbPostId: null,
          fbCommentId: null,
          publishedAt: null,
          createdAt: '2026-10-07T12:00:00.000Z',
          updatedAt: '2026-10-07T12:00:00.000Z',
          media: {
            name: 'epic_reel.mp4',
            mediaType: 'video',
            thumbnailUrl: 'https://cdn.example.com/thumb.webp',
            url: 'https://cdn.example.com/epic_reel.mp4',
            aspectRatio: '9:16',
            durationSeconds: 45.2,
          },
        };
        const res = QueueItemSchema.safeParse(queueItem);
        expect(res.success).toBe(true);
      });
    });

    describe('ListQueueItemsQuerySchema & ListQueueItemsResponseSchema', () => {
      it('coerces and defaults query pagination parameters', () => {
        const query = ListQueueItemsQuerySchema.safeParse({
          limit: '25',
          offset: '10',
          status: 'queued',
        });
        expect(query.success).toBe(true);
        if (query.success) {
          expect(query.data.limit).toBe(25);
          expect(query.data.offset).toBe(10);
          expect(query.data.status).toBe('queued');
        }
      });

      it('validates ListQueueItemsResponseSchema', () => {
        const res = ListQueueItemsResponseSchema.safeParse({
          items: [],
          total: 0,
          limit: 50,
          offset: 0,
        });
        expect(res.success).toBe(true);
      });
    });
  });

  describe('Edge Dispatcher & Facebook Graph Contracts (T117)', () => {
    describe('ClaimedQueueItemSchema', () => {
      it('validates claimed queue item with joined media and page credentials', () => {
        const claimed = {
          id: '55555555-5555-4555-a555-555555555555',
          userId: '33333333-3333-4333-a333-333333333333',
          pageId: '11111111-1111-4111-a111-111111111111',
          mediaId: '44444444-4444-4444-a444-444444444444',
          caption: 'Ready for prime time',
          firstComment: null,
          retryCount: 0,
          maxRetries: 3,
          mediaType: 'video',
          mediaUrl: 'https://r2.fbuploadpro.com/tenant/video.mp4',
          storageKey: 'tenant/video.mp4',
          fbPageId: '1029384756',
          encryptedPageToken: 'v1.iv.ciphertext.tag',
          pageName: 'My Awesome Page',
        };
        const res = ClaimedQueueItemSchema.safeParse(claimed);
        expect(res.success).toBe(true);
      });

      it('rejects claimed item if mediaUrl is not a valid URL', () => {
        const claimed = {
          id: '55555555-5555-4555-a555-555555555555',
          userId: '33333333-3333-4333-a333-333333333333',
          pageId: '11111111-1111-4111-a111-111111111111',
          mediaId: '44444444-4444-4444-a444-444444444444',
          caption: 'Test',
          firstComment: null,
          retryCount: 0,
          maxRetries: 3,
          mediaType: 'video',
          mediaUrl: 'not-a-url',
          storageKey: 'tenant/video.mp4',
          fbPageId: '1029384756',
          encryptedPageToken: 'token',
          pageName: 'My Page',
        };
        const res = ClaimedQueueItemSchema.safeParse(claimed);
        expect(res.success).toBe(false);
      });
    });

    describe('PublishLogSchema', () => {
      it('validates success publish log record', () => {
        const log = {
          id: '66666666-6666-4666-a666-666666666666',
          userId: '33333333-3333-4333-a333-333333333333',
          queueItemId: '55555555-5555-4555-a555-555555555555',
          pageId: '11111111-1111-4111-a111-111111111111',
          status: 'success',
          attemptNumber: 1,
          fbResponseCode: 200,
          errorMessage: null,
          errorDetails: null,
          tokensDeducted: 1,
          createdAt: new Date().toISOString(),
        };
        const res = PublishLogSchema.safeParse(log);
        expect(res.success).toBe(true);
      });

      it('validates failure publish log record with error details', () => {
        const log = {
          id: '66666666-6666-4666-a666-666666666666',
          userId: '33333333-3333-4333-a333-333333333333',
          queueItemId: '55555555-5555-4555-a555-555555555555',
          pageId: '11111111-1111-4111-a111-111111111111',
          status: 'failure',
          attemptNumber: 3,
          fbResponseCode: 400,
          errorMessage: 'OAuthException: Session expired',
          errorDetails: { code: 190, subcode: 463 },
          tokensDeducted: 0,
          createdAt: new Date().toISOString(),
        };
        const res = PublishLogSchema.safeParse(log);
        expect(res.success).toBe(true);
      });
    });
  });
});
