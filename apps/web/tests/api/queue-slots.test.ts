import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import {
  handleListQueueSlots,
  handleCreateQueueSlot,
  handleUpdateQueueScheduleTimezone,
} from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/slots/route';
import {
  handleUpdateQueueSlot,
  handleDeleteQueueSlot,
} from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]/route';
import type { DatabaseClient } from '@fbuploadpro/contracts';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Page Queue Slots CRUD (T121, T122, T123)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const pageId = '22222222-2222-4222-a222-222222222222';
  const slotId = '33333333-3333-4333-a333-333333333333';
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

  describe('GET /api/tenant/[subdomain]/pages/[pageId]/slots', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`
      );
      const res = await handleListQueueSlots(req, 'acme', pageId);
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden on tenant mismatch', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/othercorp/pages/${pageId}/slots`,
        {
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleListQueueSlots(req, 'othercorp', pageId);
      expect(res.status).toBe(403);
    });

    it('returns 404 when page does not exist or does not belong to user', async () => {
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

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleListQueueSlots(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Page not found');
    });

    it('returns 200 with list of slots for the page', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId, timezone: 'America/New_York' }]);
          }
          if (sql.includes('FROM page_queue_slots')) {
            return Promise.resolve([
              {
                id: slotId,
                user_id: userId,
                fb_page_id: pageId,
                slot_time: '09:30:00',
                timezone: 'America/New_York',
                is_active: true,
                created_at: new Date('2026-10-07T10:00:00Z'),
                updated_at: new Date('2026-10-07T10:00:00Z'),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleListQueueSlots(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.slots).toHaveLength(1);
      expect(data.slots[0].id).toBe(slotId);
      expect(data.slots[0].pageId).toBe(pageId);
      expect(data.slots[0].slotTime).toBe('09:30:00');
      expect(data.slots[0].timezone).toBe('America/New_York');
      expect(data.slots[0].isActive).toBe(true);
      expect(data.total).toBe(1);
    });
  });

  describe('POST /api/tenant/[subdomain]/pages/[pageId]/slots', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'POST',
          body: JSON.stringify({ slotTime: '14:00', timezone: 'UTC' }),
        }
      );
      const res = await handleCreateQueueSlot(req, 'acme', pageId);
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden on tenant mismatch', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/othercorp/pages/${pageId}/slots`,
        {
          method: 'POST',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ slotTime: '14:00', timezone: 'UTC' }),
        }
      );
      const res = await handleCreateQueueSlot(req, 'othercorp', pageId);
      expect(res.status).toBe(403);
    });

    it('returns 400 Bad Request on invalid slotTime format', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'POST',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ slotTime: '25:99', timezone: 'UTC' }),
        }
      );
      const res = await handleCreateQueueSlot(req, 'acme', pageId);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('INVALID_REQUEST');
    });

    it('returns 404 when page does not exist or does not belong to user', async () => {
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

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'POST',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ slotTime: '14:00', timezone: 'UTC' }),
        }
      );
      const res = await handleCreateQueueSlot(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
    });

    it('returns 201 Created on valid slot creation', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId, timezone: 'UTC' }]);
          }
          if (sql.includes('INSERT INTO page_queue_slots')) {
            return Promise.resolve([
              {
                id: slotId,
                user_id: userId,
                fb_page_id: pageId,
                slot_time: '14:00',
                timezone: 'UTC',
                is_active: true,
                created_at: new Date('2026-10-07T12:00:00Z'),
                updated_at: new Date('2026-10-07T12:00:00Z'),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'POST',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ slotTime: '14:00', timezone: 'UTC' }),
        }
      );
      const res = await handleCreateQueueSlot(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe(slotId);
      expect(data.pageId).toBe(pageId);
      expect(data.slotTime).toBe('14:00');
      expect(data.timezone).toBe('UTC');
      expect(data.isActive).toBe(true);
    });

    it('returns 409 Conflict on duplicate slot_time for page', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId, timezone: 'UTC' }]);
          }
          if (sql.includes('INSERT INTO page_queue_slots')) {
            const err: any = new Error('duplicate key value');
            err.code = '23505';
            return Promise.reject(err);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'POST',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ slotTime: '14:00', timezone: 'UTC' }),
        }
      );
      const res = await handleCreateQueueSlot(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('SLOT_ALREADY_EXISTS');
    });
  });

  describe('PATCH /api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots/${slotId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: false }),
        }
      );
      const res = await handleUpdateQueueSlot(req, 'acme', pageId, slotId);
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden on tenant mismatch', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/othercorp/pages/${pageId}/slots/${slotId}`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ isActive: false }),
        }
      );
      const res = await handleUpdateQueueSlot(
        req,
        'othercorp',
        pageId,
        slotId
      );
      expect(res.status).toBe(403);
    });

    it('returns 404 when page does not exist or does not belong to user', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots/${slotId}`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ isActive: false }),
        }
      );
      const res = await handleUpdateQueueSlot(
        req,
        'acme',
        pageId,
        slotId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when slot does not exist', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId, timezone: 'UTC' }]);
          }
          if (sql.includes('UPDATE page_queue_slots')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots/${slotId}`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ isActive: false }),
        }
      );
      const res = await handleUpdateQueueSlot(
        req,
        'acme',
        pageId,
        slotId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Slot not found');
    });

    it('returns 200 and updates slot active state, slotTime, or timezone', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId, timezone: 'UTC' }]);
          }
          if (sql.includes('UPDATE page_queue_slots')) {
            return Promise.resolve([
              {
                id: slotId,
                user_id: userId,
                fb_page_id: pageId,
                slot_time: '18:00:00',
                timezone: 'UTC',
                is_active: false,
                created_at: new Date('2026-10-07T10:00:00Z'),
                updated_at: new Date('2026-10-07T13:00:00Z'),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots/${slotId}`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ isActive: false, slotTime: '18:00' }),
        }
      );
      const res = await handleUpdateQueueSlot(
        req,
        'acme',
        pageId,
        slotId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(slotId);
      expect(data.isActive).toBe(false);
      expect(data.slotTime).toBe('18:00:00');
    });

    it('returns 409 Conflict if updated slot_time conflicts with existing slot on page', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId, timezone: 'UTC' }]);
          }
          if (sql.includes('UPDATE page_queue_slots')) {
            const err: any = new Error('duplicate key value');
            err.code = '23505';
            return Promise.reject(err);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots/${slotId}`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ slotTime: '09:30' }),
        }
      );
      const res = await handleUpdateQueueSlot(
        req,
        'acme',
        pageId,
        slotId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('SLOT_ALREADY_EXISTS');
    });
  });

  describe('DELETE /api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots/${slotId}`,
        {
          method: 'DELETE',
        }
      );
      const res = await handleDeleteQueueSlot(req, 'acme', pageId, slotId);
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden on tenant mismatch', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/othercorp/pages/${pageId}/slots/${slotId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleDeleteQueueSlot(
        req,
        'othercorp',
        pageId,
        slotId
      );
      expect(res.status).toBe(403);
    });

    it('returns 404 when page does not exist or does not belong to user', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots/${slotId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleDeleteQueueSlot(
        req,
        'acme',
        pageId,
        slotId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when slot does not exist', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId }]);
          }
          if (sql.includes('DELETE FROM page_queue_slots')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots/${slotId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleDeleteQueueSlot(
        req,
        'acme',
        pageId,
        slotId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Slot not found');
    });

    it('returns 200 with { success: true, slotId } on successful deletion', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId }]);
          }
          if (sql.includes('DELETE FROM page_queue_slots')) {
            return Promise.resolve([{ id: slotId }]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots/${slotId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleDeleteQueueSlot(
        req,
        'acme',
        pageId,
        slotId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.slotId).toBe(slotId);
    });
  });

  describe('PATCH /api/tenant/[subdomain]/pages/[pageId]/slots (Schedule Timezone)', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'PATCH',
          body: JSON.stringify({ timezone: 'Asia/Karachi' }),
        }
      );
      const res = await handleUpdateQueueScheduleTimezone(req, 'acme', pageId);
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden on tenant mismatch', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/othercorp/pages/${pageId}/slots`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ timezone: 'Asia/Karachi' }),
        }
      );
      const res = await handleUpdateQueueScheduleTimezone(req, 'othercorp', pageId);
      expect(res.status).toBe(403);
    });

    it('returns 400 on invalid payload', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ timezone: '' }),
        }
      );
      const res = await handleUpdateQueueScheduleTimezone(req, 'acme', pageId);
      expect(res.status).toBe(400);
    });

    it('returns 404 when workspace not found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ timezone: 'Asia/Karachi' }),
        }
      );
      const res = await handleUpdateQueueScheduleTimezone(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Workspace not found');
    });

    it('returns 404 when page not found on timezone update', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('UPDATE facebook_pages')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ timezone: 'Asia/Karachi' }),
        }
      );
      const res = await handleUpdateQueueScheduleTimezone(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Page not found');
    });

    it('returns 200 with { success: true, timezone, updatedCount, realignedQueueCount } when updating timezone on facebook_pages', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('UPDATE facebook_pages')) {
            return Promise.resolve([{ id: pageId }]);
          }
          if (sql.includes('SELECT count(*)::int as count FROM page_queue_slots')) {
            return Promise.resolve([{ count: 3 }]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ timezone: 'Asia/Karachi' }),
        }
      );
      const res = await handleUpdateQueueScheduleTimezone(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.timezone).toBe('Asia/Karachi');
      expect(data.updatedCount).toBe(3);
      expect(data.realignedQueueCount).toBe(0);
    });

    it('realigns pending queued items to match the new timezone and returns realignedQueueCount', async () => {
      const updateQueries: { sql: string; params: any[] }[] = [];
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('UPDATE facebook_pages')) {
            return Promise.resolve([{ id: pageId }]);
          }
          if (sql.includes('SELECT count(*)::int as count FROM page_queue_slots')) {
            return Promise.resolve([{ count: 2 }]);
          }
          if (sql.includes('FROM legacy_queue_items qi')) {
            return Promise.resolve([
              {
                id: 'queue-item-1',
                scheduled_time: '2026-10-25T05:00:00.000Z',
                slot_time: '10:00:00',
              },
              {
                id: 'queue-item-2',
                scheduled_time: '2026-10-26T07:00:00.000Z',
                slot_time: '12:00:00',
              },
            ]);
          }
          if (sql.includes('UPDATE legacy_queue_items')) {
            updateQueries.push({ sql, params });
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ timezone: 'America/New_York' }),
        }
      );
      const res = await handleUpdateQueueScheduleTimezone(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.timezone).toBe('America/New_York');
      expect(data.updatedCount).toBe(2);
      expect(data.realignedQueueCount).toBe(2);
      expect(updateQueries.length).toBe(2);
      expect(updateQueries[0].params[1]).toBe('queue-item-1');
      expect(updateQueries[1].params[1]).toBe('queue-item-2');
    });

    it('preserves custom scheduled items by omitting them from realignment (slot_id is null)', async () => {
      let queriedQueueItemsSql = '';
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: 'ws_123' }]);
          }
          if (sql.includes('UPDATE facebook_pages')) {
            return Promise.resolve([{ id: pageId }]);
          }
          if (sql.includes('SELECT count(*)::int as count FROM page_queue_slots')) {
            return Promise.resolve([{ count: 1 }]);
          }
          if (sql.includes('FROM legacy_queue_items qi')) {
            queriedQueueItemsSql = sql;
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}/slots`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ timezone: 'Europe/London' }),
        }
      );
      const res = await handleUpdateQueueScheduleTimezone(
        req,
        'acme',
        pageId,
        mockDb as DatabaseClient
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.realignedQueueCount).toBe(0);
      expect(queriedQueueItemsSql).toContain('JOIN page_queue_slots s ON s.id = qi.slot_id');
    });
  });
});

