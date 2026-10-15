import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import {
  handleEnqueueMedia,
  handleListQueueItems,
} from '../../src/app/api/tenant/[subdomain]/publishing/queue/route';
import type { DatabaseClient } from '@fbuploadpro/contracts';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Publishing Queue Route Handlers (T125, T126, T127)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const pageId = '22222222-2222-4222-a222-222222222222';
  const mediaId = '33333333-3333-4333-a333-333333333333';
  const slotId = '44444444-4444-4444-a444-444444444444';
  const queueItemId = '55555555-5555-4555-a555-555555555555';
  let validSessionCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;

    const token = await signSessionToken(
      {
        userId,
        email: 'alexander@gmail.com',
        name: 'Alex Acme',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    validSessionCookie = `fbup_session=${token}`;
  });

  describe('POST /api/tenant/[subdomain]/publishing/queue (T126)', () => {
    const validEnqueuePayload = {
      pageId,
      mediaId,
      caption: 'Test post caption',
      firstComment: 'First comment link: https://example.com',
    };

    it('returns 401 Unauthorized when missing session cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        method: 'POST',
        body: JSON.stringify(validEnqueuePayload),
        headers: { 'content-type': 'application/json' },
      });
      const res = await handleEnqueueMedia(req, 'acme');
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 403 Forbidden on cross-tenant subdomain mismatch', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/other-tenant/publishing/queue', {
        method: 'POST',
        body: JSON.stringify(validEnqueuePayload),
        headers: {
          cookie: validSessionCookie,
          'content-type': 'application/json',
        },
      });
      const res = await handleEnqueueMedia(req, 'other-tenant');
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Forbidden');
    });

    it('returns 400 Bad Request on invalid request body', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        method: 'POST',
        body: JSON.stringify({ pageId: 'not-a-uuid' }),
        headers: {
          cookie: validSessionCookie,
          'content-type': 'application/json',
        },
      });
      const res = await handleEnqueueMedia(req, 'acme');
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('INVALID_REQUEST');
    });

    it('returns 404 Not Found if target Facebook page does not belong to user', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        method: 'POST',
        body: JSON.stringify(validEnqueuePayload),
        headers: {
          cookie: validSessionCookie,
          'content-type': 'application/json',
        },
      });

      const res = await handleEnqueueMedia(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Page not found');
    });

    it('returns 404 Not Found if target media item does not belong to user', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId }]);
          }
          if (sql.includes('FROM media_items')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        method: 'POST',
        body: JSON.stringify(validEnqueuePayload),
        headers: {
          cookie: validSessionCookie,
          'content-type': 'application/json',
        },
      });

      const res = await handleEnqueueMedia(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Media not found');
    });

    it('returns 404 Not Found if slotId is provided but slot does not exist', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId }]);
          }
          if (sql.includes('FROM media_items')) {
            return Promise.resolve([{
              id: mediaId,
              name: 'video1.mp4',
              media_type: 'video',
              url: 'https://cdn.example.com/video1.mp4',
              thumbnail_url: null,
              aspect_ratio: '9:16',
              duration_seconds: 30,
            }]);
          }
          if (sql.includes('FROM page_queue_slots')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        method: 'POST',
        body: JSON.stringify({ ...validEnqueuePayload, slotId }),
        headers: {
          cookie: validSessionCookie,
          'content-type': 'application/json',
        },
      });

      const res = await handleEnqueueMedia(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('Queue slot not found');
    });

    it('returns 201 Created and auto-computes next vacant slot when slotId and scheduledTime are omitted', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId }]);
          }
          if (sql.includes('FROM media_items')) {
            return Promise.resolve([{
              id: mediaId,
              name: 'video1.mp4',
              media_type: 'video',
              url: 'https://cdn.example.com/video1.mp4',
              thumbnail_url: 'https://cdn.example.com/thumb.webp',
              aspect_ratio: '9:16',
              duration_seconds: 45,
            }]);
          }
          if (sql.includes('FROM page_queue_slots')) {
            return Promise.resolve([
              {
                id: slotId,
                fb_page_id: pageId,
                slot_time: '18:00:00',
                timezone: 'UTC',
                is_active: true,
              },
            ]);
          }
          if (sql.includes('FROM queue_items WHERE') && sql.includes("status = 'queued'")) {
            return Promise.resolve([]);
          }
          if (sql.includes('INSERT INTO queue_items')) {
            return Promise.resolve([
              {
                id: queueItemId,
                user_id: userId,
                fb_page_id: pageId,
                slot_id: slotId,
                media_id: mediaId,
                scheduled_time: new Date('2026-10-07T18:00:00Z'),
                caption: 'Test post caption',
                first_comment: 'First comment link: https://example.com',
                status: 'queued',
                retry_count: 0,
                max_retries: 3,
                fb_post_id: null,
                fb_comment_id: null,
                published_at: null,
                created_at: new Date('2026-10-07T12:00:00Z'),
                updated_at: new Date('2026-10-07T12:00:00Z'),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        method: 'POST',
        body: JSON.stringify(validEnqueuePayload),
        headers: {
          cookie: validSessionCookie,
          'content-type': 'application/json',
        },
      });

      const res = await handleEnqueueMedia(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe(queueItemId);
      expect(data.pageId).toBe(pageId);
      expect(data.mediaId).toBe(mediaId);
      expect(data.slotId).toBe(slotId);
      expect(data.status).toBe('queued');
      expect(data.caption).toBe('Test post caption');
      expect(data.firstComment).toBe('First comment link: https://example.com');
      expect(data.media).toEqual({
        name: 'video1.mp4',
        mediaType: 'video',
        url: 'https://cdn.example.com/video1.mp4',
        thumbnailUrl: 'https://cdn.example.com/thumb.webp',
        aspectRatio: '9:16',
        durationSeconds: 45,
      });
    });

    it('returns 201 Created with explicit slotId and scheduledTime', async () => {
      const explicitTime = '2026-10-08T15:30:00.000Z';
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId }]);
          }
          if (sql.includes('FROM media_items')) {
            return Promise.resolve([{
              id: mediaId,
              name: 'photo.jpg',
              media_type: 'image',
              url: 'https://cdn.example.com/photo.jpg',
              thumbnail_url: null,
              aspect_ratio: '1:1',
              duration_seconds: null,
            }]);
          }
          if (sql.includes('FROM page_queue_slots')) {
            return Promise.resolve([
              {
                id: slotId,
                fb_page_id: pageId,
                slot_time: '15:30:00',
                timezone: 'UTC',
                is_active: true,
              },
            ]);
          }
          if (sql.includes('INSERT INTO queue_items')) {
            return Promise.resolve([
              {
                id: queueItemId,
                user_id: userId,
                fb_page_id: pageId,
                slot_id: slotId,
                media_id: mediaId,
                scheduled_time: new Date(explicitTime),
                caption: 'Photo post',
                first_comment: null,
                status: 'queued',
                retry_count: 0,
                max_retries: 3,
                fb_post_id: null,
                fb_comment_id: null,
                published_at: null,
                created_at: new Date('2026-10-07T12:00:00Z'),
                updated_at: new Date('2026-10-07T12:00:00Z'),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        method: 'POST',
        body: JSON.stringify({
          pageId,
          mediaId,
          slotId,
          scheduledTime: explicitTime,
          caption: 'Photo post',
        }),
        headers: {
          cookie: validSessionCookie,
          'content-type': 'application/json',
        },
      });

      const res = await handleEnqueueMedia(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe(queueItemId);
      expect(data.slotId).toBe(slotId);
      expect(data.scheduledTime).toBe(explicitTime);
      expect(data.firstComment).toBeNull();
      expect(data.media.mediaType).toBe('image');
    });
  });

  describe('GET /api/tenant/[subdomain]/publishing/queue (T127)', () => {
    it('returns 401 Unauthorized when missing session cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue');
      const res = await handleListQueueItems(req, 'acme');
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden on tenant mismatch', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/other-tenant/publishing/queue', {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleListQueueItems(req, 'other-tenant');
      expect(res.status).toBe(403);
    });

    it('returns 400 Bad Request on invalid query parameters', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue?status=not_a_valid_status', {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleListQueueItems(req, 'acme');
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('INVALID_QUERY');
    });

    it('returns 200 with list of queue items and joined media information', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('SELECT COUNT(*)')) {
            return Promise.resolve([{ total: 1 }]);
          }
          return Promise.resolve([
            {
              id: queueItemId,
              user_id: userId,
              fb_page_id: pageId,
              slot_id: slotId,
              media_id: mediaId,
              scheduled_time: new Date('2026-10-07T18:00:00Z'),
              caption: 'Scheduled Reel',
              first_comment: 'Check out bio',
              status: 'queued',
              retry_count: 0,
              max_retries: 3,
              fb_post_id: null,
              fb_comment_id: null,
              published_at: null,
              created_at: new Date('2026-10-07T12:00:00Z'),
              updated_at: new Date('2026-10-07T12:00:00Z'),
              media_name: 'video1.mp4',
              media_type: 'video',
              media_thumbnail_url: 'https://cdn.example.com/thumb.webp',
              media_url: 'https://cdn.example.com/video1.mp4',
              media_aspect_ratio: '9:16',
              media_duration_seconds: '29.5',
            },
          ]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue?pageId=' + pageId + '&status=queued', {
        headers: { cookie: validSessionCookie },
      });

      const res = await handleListQueueItems(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe(queueItemId);
      expect(data.items[0].media).toBeDefined();
      expect(data.items[0].media.name).toBe('video1.mp4');
      expect(data.items[0].media.durationSeconds).toBe(29.5);
    });
  });

  describe('Multi-Format Enqueueing (Spec 042)', () => {
    it('enqueues a text post with mediaId: null, non-empty caption, and linkUrl', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId, status: 'active' }]);
          }
          if (sql.includes('INSERT INTO queue_items')) {
            return Promise.resolve([
              {
                id: 'queue-text-1',
                user_id: userId,
                fb_page_id: pageId,
                slot_id: null,
                media_id: null,
                post_format: 'text',
                link_url: 'https://example.com/blog',
                caption: 'Exciting product update!',
                first_comment: 'Check the link in post',
                scheduled_time: new Date('2026-10-16T12:00:00Z'),
                status: 'queued',
                retry_count: 0,
                max_retries: 3,
                fb_post_id: null,
                fb_comment_id: null,
                published_at: null,
                created_at: new Date('2026-10-16T10:00:00Z'),
                updated_at: new Date('2026-10-16T10:00:00Z'),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        method: 'POST',
        headers: {
          cookie: validSessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          pageId,
          mediaId: null,
          postFormat: 'text',
          caption: 'Exciting product update!',
          linkUrl: 'https://example.com/blog',
          firstComment: 'Check the link in post',
          scheduledTime: '2026-10-16T12:00:00Z',
        }),
      });

      const res = await handleEnqueueMedia(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.postFormat).toBe('text');
      expect(data.linkUrl).toBe('https://example.com/blog');
      expect(data.mediaId).toBeNull();
    });

    it('enqueues a story post and forces firstComment to null', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId, status: 'active' }]);
          }
          if (sql.includes('FROM media_items')) {
            return Promise.resolve([
              {
                id: mediaId,
                media_type: 'image',
                file_size: 2 * 1024 * 1024,
              },
            ]);
          }
          if (sql.includes('INSERT INTO queue_items')) {
            return Promise.resolve([
              {
                id: 'queue-story-1',
                user_id: userId,
                fb_page_id: pageId,
                slot_id: null,
                media_id: mediaId,
                post_format: 'story',
                link_url: null,
                caption: 'Morning Story',
                first_comment: null,
                scheduled_time: new Date('2026-10-16T12:00:00Z'),
                status: 'queued',
                retry_count: 0,
                max_retries: 3,
                fb_post_id: null,
                fb_comment_id: null,
                published_at: null,
                created_at: new Date('2026-10-16T10:00:00Z'),
                updated_at: new Date('2026-10-16T10:00:00Z'),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        method: 'POST',
        headers: {
          cookie: validSessionCookie,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          pageId,
          mediaId,
          postFormat: 'story',
          caption: 'Morning Story',
          firstComment: null,
          scheduledTime: '2026-10-16T12:00:00Z',
        }),
      });

      const res = await handleEnqueueMedia(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.postFormat).toBe('story');
      expect(data.firstComment).toBeNull();
    });
  });
});
