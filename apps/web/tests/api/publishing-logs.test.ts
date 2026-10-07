import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { handleListPublishLogs } from '../../src/app/api/tenant/[subdomain]/publishing/logs/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Publish Logs API Route Handler (T138)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const pageId = '22222222-2222-4222-a222-222222222222';
  const queueItemId = '33333333-3333-4333-a333-333333333333';
  const logId = '44444444-4444-4444-a444-444444444444';
  let validSessionCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;

    const token = await signSessionToken(
      {
        userId,
        email: 'alex@acme.com',
        name: 'Alex Acme',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    validSessionCookie = `fbup_session=${token}`;
  });

  describe('GET /api/tenant/[subdomain]/publishing/logs', () => {
    it('returns 401 Unauthorized when missing session cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/logs');
      const res = await handleListPublishLogs(req, 'acme');
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 401 Unauthorized when session token is invalid', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/logs', {
        headers: { cookie: 'fbup_session=invalid.token.payload' },
      });
      const res = await handleListPublishLogs(req, 'acme');
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 403 Forbidden on cross-tenant subdomain mismatch', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/other-tenant/publishing/logs', {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleListPublishLogs(req, 'other-tenant');
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Forbidden');
    });

    it('returns 400 Bad Request on invalid query parameters', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/tenant/acme/publishing/logs?status=invalid_status',
        {
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleListPublishLogs(req, 'acme');
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('INVALID_QUERY');
    });

    it('returns 200 with list of publish logs and total count with default pagination', async () => {
      const mockLog = {
        id: logId,
        user_id: userId,
        queue_item_id: queueItemId,
        fb_page_id: pageId,
        status: 'success',
        attempt_number: 1,
        fb_response_code: null,
        error_message: null,
        error_details: null,
        tokens_deducted: 1,
        created_at: new Date('2026-10-07T12:00:00Z'),
      };

      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT COUNT(*)')) {
            return Promise.resolve([{ total: 1 }]);
          }
          if (sql.includes('SELECT pl.id')) {
            return Promise.resolve([mockLog]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/logs', {
        headers: { cookie: validSessionCookie },
      });

      const res = await handleListPublishLogs(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(data.logs).toHaveLength(1);
      expect(data.logs[0]).toEqual({
        id: logId,
        userId,
        queueItemId,
        pageId,
        status: 'success',
        attemptNumber: 1,
        fbResponseCode: null,
        errorMessage: null,
        errorDetails: null,
        tokensDeducted: 1,
        createdAt: '2026-10-07T12:00:00.000Z',
      });
    });

    it('filters publish logs by pageId and status with custom limit and offset', async () => {
      const capturedQueries: Array<{ sql: string; params: unknown[] | undefined }> = [];
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          capturedQueries.push({ sql, params });
          if (sql.includes('SELECT COUNT(*)')) {
            return Promise.resolve([{ total: 0 }]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/publishing/logs?pageId=${pageId}&status=failure&limit=15&offset=30`,
        {
          headers: { cookie: validSessionCookie },
        }
      );

      const res = await handleListPublishLogs(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(0);
      expect(data.logs).toEqual([]);

      // Verify query filters
      const listQuery = capturedQueries.find((q) => q.sql.includes('SELECT pl.id'));
      expect(listQuery).toBeDefined();
      expect(listQuery!.sql).toContain('pl.user_id = $1');
      expect(listQuery!.sql).toContain('pl.fb_page_id = $2');
      expect(listQuery!.sql).toContain('pl.status = $3');
      expect(listQuery!.params).toEqual([userId, pageId, 'failure', 15, 30]);
    });
  });
});
