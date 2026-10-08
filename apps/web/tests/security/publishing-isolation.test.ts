import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import {
  handleListQueueSlots,
  handleCreateQueueSlot,
} from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/slots/route';
import {
  handleUpdateQueueSlot,
  handleDeleteQueueSlot,
} from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]/route';
import {
  handleEnqueueMedia,
  handleListQueueItems,
} from '../../src/app/api/tenant/[subdomain]/publishing/queue/route';
import {
  handleUpdateQueueItem,
  handleDeleteQueueItem,
} from '../../src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/route';
import { handlePublishNow } from '../../src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/publish-now/route';
import { handleListPublishLogs } from '../../src/app/api/tenant/[subdomain]/publishing/logs/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Multi-Tenant Publishing Security & Isolation Audit (T144)', () => {
  const userA = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    subdomain: 'tenant-a',
    pageId: '11111111-1111-4111-a111-111111111111',
    slotId: '22222222-2222-4222-a222-222222222222',
    mediaId: '33333333-3333-4333-a333-333333333333',
    queueItemId: '44444444-4444-4444-a444-444444444444',
  };

  const userB = {
    id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    subdomain: 'tenant-b',
    pageId: '55555555-5555-4555-b555-555555555555',
    slotId: '66666666-6666-4666-b666-666666666666',
    mediaId: '77777777-7777-4777-b777-777777777777',
    queueItemId: '88888888-8888-4888-b888-888888888888',
  };

  let tokenCookieUserB: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;

    const tokenB = await signSessionToken(
      {
        userId: userB.id,
        email: 'bob@tenant-b.com',
        name: 'Bob Tenant B',
        subdomain: userB.subdomain,
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    tokenCookieUserB = `fbup_session=${tokenB}`;
  });

  describe('1. Route-Level Tenant Boundary Isolation Guards', () => {
    it('blocks User B from viewing User A queue slots via tenant-a route with 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-a/pages/${userA.pageId}/slots`,
        { headers: { cookie: tokenCookieUserB } }
      );
      const res = await handleListQueueSlots(req, 'tenant-a', userA.pageId);
      expect(res.status).toBe(403);
    });

    it('blocks User B from creating queue slot in User A tenant route with 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-a/pages/${userA.pageId}/slots`,
        {
          method: 'POST',
          headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
          body: JSON.stringify({ slotTime: '09:00', timezone: 'UTC' }),
        }
      );
      const res = await handleCreateQueueSlot(req, 'tenant-a', userA.pageId);
      expect(res.status).toBe(403);
    });

    it('blocks User B from updating User A queue slot via tenant-a route with 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-a/pages/${userA.pageId}/slots/${userA.slotId}`,
        {
          method: 'PATCH',
          headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
          body: JSON.stringify({ slotTime: '10:00' }),
        }
      );
      const res = await handleUpdateQueueSlot(req, 'tenant-a', userA.pageId, userA.slotId);
      expect(res.status).toBe(403);
    });

    it('blocks User B from deleting User A queue slot via tenant-a route with 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-a/pages/${userA.pageId}/slots/${userA.slotId}`,
        {
          method: 'DELETE',
          headers: { cookie: tokenCookieUserB },
        }
      );
      const res = await handleDeleteQueueSlot(req, 'tenant-a', userA.pageId, userA.slotId);
      expect(res.status).toBe(403);
    });

    it('blocks User B from accessing User A publishing queue list with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-a/publishing/queue', {
        headers: { cookie: tokenCookieUserB },
      });
      const res = await handleListQueueItems(req, 'tenant-a');
      expect(res.status).toBe(403);
    });

    it('blocks User B from enqueuing media via User A tenant route with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-a/publishing/queue', {
        method: 'POST',
        headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
        body: JSON.stringify({
          pageId: userA.pageId,
          mediaId: userA.mediaId,
          caption: 'Cross-tenant breach attempt',
        }),
      });
      const res = await handleEnqueueMedia(req, 'tenant-a');
      expect(res.status).toBe(403);
    });

    it('blocks User B from updating User A queue item via tenant-a route with 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-a/publishing/queue/${userA.queueItemId}`,
        {
          method: 'PATCH',
          headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
          body: JSON.stringify({ caption: 'Tampered caption' }),
        }
      );
      const res = await handleUpdateQueueItem(req, 'tenant-a', userA.queueItemId);
      expect(res.status).toBe(403);
    });

    it('blocks User B from deleting User A queue item via tenant-a route with 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-a/publishing/queue/${userA.queueItemId}`,
        {
          method: 'DELETE',
          headers: { cookie: tokenCookieUserB },
        }
      );
      const res = await handleDeleteQueueItem(req, 'tenant-a', userA.queueItemId);
      expect(res.status).toBe(403);
    });

    it('blocks User B from triggering publish-now on User A queue item via tenant-a route with 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-a/publishing/queue/${userA.queueItemId}/publish-now`,
        {
          method: 'POST',
          headers: { cookie: tokenCookieUserB },
        }
      );
      const res = await handlePublishNow(req, 'tenant-a', userA.queueItemId);
      expect(res.status).toBe(403);
    });

    it('blocks User B from accessing User A publish logs via tenant-a route with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-a/publishing/logs', {
        headers: { cookie: tokenCookieUserB },
      });
      const res = await handleListPublishLogs(req, 'tenant-a');
      expect(res.status).toBe(403);
    });
  });

  describe('2. Object-Level IDOR Guards (Queue Slots)', () => {
    it('blocks User B from listing slots for User A page via tenant-b route with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM facebook_pages')) {
            // Page ID check enforces WHERE id = $1 AND user_id = $2
            if (params && params[0] === userA.pageId && params[1] === userB.id) {
              return Promise.resolve([]); // Page does not belong to User B
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/pages/${userA.pageId}/slots`,
        { headers: { cookie: tokenCookieUserB } }
      );
      const res = await handleListQueueSlots(
        req,
        'tenant-b',
        userA.pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Page not found');
    });

    it('blocks User B from creating slot under User A page with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM facebook_pages')) {
            if (params && params[0] === userA.pageId && params[1] === userB.id) {
              return Promise.resolve([]);
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/pages/${userA.pageId}/slots`,
        {
          method: 'POST',
          headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
          body: JSON.stringify({ slotTime: '12:00', timezone: 'UTC' }),
        }
      );
      const res = await handleCreateQueueSlot(
        req,
        'tenant-b',
        userA.pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Page not found');
    });

    it('blocks User B from updating User A slot by ID with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: userB.pageId }]);
          }
          if (sql.includes('UPDATE page_queue_slots')) {
            // WHERE id = $4 AND fb_page_id = $5 AND user_id = $6
            if (
              params &&
              params[3] === userA.slotId &&
              params[4] === userB.pageId &&
              params[5] === userB.id
            ) {
              return Promise.resolve([]);
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/pages/${userB.pageId}/slots/${userA.slotId}`,
        {
          method: 'PATCH',
          headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
          body: JSON.stringify({ slotTime: '14:00' }),
        }
      );
      const res = await handleUpdateQueueSlot(
        req,
        'tenant-b',
        userB.pageId,
        userA.slotId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Slot not found');
    });

    it('blocks User B from deleting User A slot by ID with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: userB.pageId }]);
          }
          if (sql.includes('DELETE FROM page_queue_slots')) {
            // WHERE id = $1 AND fb_page_id = $2 AND user_id = $3
            if (
              params &&
              params[0] === userA.slotId &&
              params[1] === userB.pageId &&
              params[2] === userB.id
            ) {
              return Promise.resolve([]);
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/pages/${userB.pageId}/slots/${userA.slotId}`,
        {
          method: 'DELETE',
          headers: { cookie: tokenCookieUserB },
        }
      );
      const res = await handleDeleteQueueSlot(
        req,
        'tenant-b',
        userB.pageId,
        userA.slotId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Slot not found');
    });
  });

  describe('3. Cross-Tenant Enqueuing & Foreign Key IDOR Guards', () => {
    it('blocks User B from enqueuing media targeting User A page with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM facebook_pages')) {
            // Page check: WHERE id = $1 AND user_id = $2
            if (params && params[0] === userA.pageId && params[1] === userB.id) {
              return Promise.resolve([]);
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-b/publishing/queue', {
        method: 'POST',
        headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
        body: JSON.stringify({
          pageId: userA.pageId,
          mediaId: userB.mediaId,
          caption: 'Hijack page queue',
        }),
      });
      const res = await handleEnqueueMedia(req, 'tenant-b', mockDb as DatabaseClient);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Page not found');
    });

    it('blocks User B from enqueuing User A media asset with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM facebook_pages')) {
            if (params && params[0] === userB.pageId && params[1] === userB.id) {
              return Promise.resolve([{ id: userB.pageId }]);
            }
          }
          if (sql.includes('FROM media_items')) {
            // Media check: WHERE id = $1 AND user_id = $2
            if (params && params[0] === userA.mediaId && params[1] === userB.id) {
              return Promise.resolve([]);
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-b/publishing/queue', {
        method: 'POST',
        headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
        body: JSON.stringify({
          pageId: userB.pageId,
          mediaId: userA.mediaId,
          caption: 'Steal User A media',
        }),
      });
      const res = await handleEnqueueMedia(req, 'tenant-b', mockDb as DatabaseClient);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Media not found');
    });

    it('blocks User B from enqueuing media into User A queue slot with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: userB.pageId }]);
          }
          if (sql.includes('FROM media_items')) {
            return Promise.resolve([
              {
                id: userB.mediaId,
                name: 'video.mp4',
                media_type: 'video',
                url: 'https://cdn.example.com/video.mp4',
                thumbnail_url: null,
                aspect_ratio: '16:9',
                duration_seconds: 30,
              },
            ]);
          }
          if (sql.includes('FROM page_queue_slots')) {
            // Slot check: WHERE id = $1 AND fb_page_id = $2 AND user_id = $3
            if (
              params &&
              params[0] === userA.slotId &&
              params[1] === userB.pageId &&
              params[2] === userB.id
            ) {
              return Promise.resolve([]);
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-b/publishing/queue', {
        method: 'POST',
        headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
        body: JSON.stringify({
          pageId: userB.pageId,
          mediaId: userB.mediaId,
          slotId: userA.slotId,
          caption: 'Steal User A slot',
        }),
      });
      const res = await handleEnqueueMedia(req, 'tenant-b', mockDb as DatabaseClient);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Queue slot not found');
    });
  });

  describe('4. Object-Level IDOR Guards (Queue Items & Actions)', () => {
    it('blocks User B from updating User A queue item by ID with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM queue_items')) {
            // WHERE qi.id = $1 AND qi.user_id = $2
            if (params && params[0] === userA.queueItemId && params[1] === userB.id) {
              return Promise.resolve([]);
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/publishing/queue/${userA.queueItemId}`,
        {
          method: 'PATCH',
          headers: { cookie: tokenCookieUserB, 'content-type': 'application/json' },
          body: JSON.stringify({ caption: 'Tampered' }),
        }
      );
      const res = await handleUpdateQueueItem(
        req,
        'tenant-b',
        userA.queueItemId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Queue item not found');
    });

    it('blocks User B from deleting User A queue item by ID with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM queue_items')) {
            if (params && params[0] === userA.queueItemId && params[1] === userB.id) {
              return Promise.resolve([]);
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/publishing/queue/${userA.queueItemId}`,
        {
          method: 'DELETE',
          headers: { cookie: tokenCookieUserB },
        }
      );
      const res = await handleDeleteQueueItem(
        req,
        'tenant-b',
        userA.queueItemId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Queue item not found');
    });

    it('blocks User B from triggering publish-now on User A queue item with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM queue_items')) {
            if (params && params[0] === userA.queueItemId && params[1] === userB.id) {
              return Promise.resolve([]);
            }
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/publishing/queue/${userA.queueItemId}/publish-now`,
        {
          method: 'POST',
          headers: { cookie: tokenCookieUserB },
        }
      );
      const res = await handlePublishNow(
        req,
        'tenant-b',
        userA.queueItemId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Queue item not found');
    });
  });

  describe('5. Zero Cross-Tenant Data Leakage in Listings & Logs', () => {
    it('returns empty list when User B queries queue filtered by User A pageId (zero leakage)', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          // SQL query enforces qi.user_id = $1 AND qi.fb_page_id = $2
          expect(params?.[0]).toBe(userB.id);
          expect(params?.[1]).toBe(userA.pageId);
          if (sql.includes('COUNT(*)')) {
            return Promise.resolve([{ total: 0 }]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/publishing/queue?pageId=${userA.pageId}`,
        { headers: { cookie: tokenCookieUserB } }
      );
      const res = await handleListQueueItems(req, 'tenant-b', mockDb as DatabaseClient);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('ensures User B queue list query is strictly parameterized by User B user_id', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          // Parameter 1 must be User B's user_id, never User A or wildcard
          expect(params?.[0]).toBe(userB.id);

          if (sql.includes('COUNT(*)')) {
            return Promise.resolve([{ total: 1 }]);
          }
          return Promise.resolve([
            {
              id: userB.queueItemId,
              user_id: userB.id,
              fb_page_id: userB.pageId,
              slot_id: userB.slotId,
              media_id: userB.mediaId,
              scheduled_time: new Date().toISOString(),
              caption: 'User B post',
              first_comment: null,
              status: 'queued',
              retry_count: 0,
              max_retries: 3,
              fb_post_id: null,
              fb_comment_id: null,
              published_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              media_name: 'b_video.mp4',
              media_type: 'video',
              media_thumbnail_url: null,
              media_url: 'https://cdn.example.com/b_video.mp4',
              media_aspect_ratio: '16:9',
              media_duration_seconds: 15,
            },
          ]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-b/publishing/queue', {
        headers: { cookie: tokenCookieUserB },
      });
      const res = await handleListQueueItems(req, 'tenant-b', mockDb as DatabaseClient);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe(userB.queueItemId);
      expect(body.items[0].userId).toBe(userB.id);
    });

    it('returns empty logs when User B queries logs filtered by User A pageId', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          expect(params?.[0]).toBe(userB.id);
          expect(params?.[1]).toBe(userA.pageId);
          if (sql.includes('COUNT(*)')) {
            return Promise.resolve([{ total: 0 }]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/publishing/logs?pageId=${userA.pageId}`,
        { headers: { cookie: tokenCookieUserB } }
      );
      const res = await handleListPublishLogs(req, 'tenant-b', mockDb as DatabaseClient);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.logs).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('ensures User B publish logs query is strictly parameterized with User B user_id', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          expect(params?.[0]).toBe(userB.id);

          if (sql.includes('COUNT(*)')) {
            return Promise.resolve([{ total: 1 }]);
          }
          return Promise.resolve([
            {
              id: '99999999-9999-4999-b999-999999999999',
              user_id: userB.id,
              queue_item_id: userB.queueItemId,
              fb_page_id: userB.pageId,
              status: 'success',
              attempt_number: 1,
              fb_response_code: 200,
              error_message: null,
              error_details: null,
              created_at: new Date().toISOString(),
            },
          ]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-b/publishing/logs', {
        headers: { cookie: tokenCookieUserB },
      });
      const res = await handleListPublishLogs(req, 'tenant-b', mockDb as DatabaseClient);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.logs).toHaveLength(1);
      expect(body.logs[0].userId).toBe(userB.id);
    });
  });
});
