import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { handleDisconnectPage } from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/route';
import { handleDisconnectAccount } from '../../src/app/api/tenant/[subdomain]/accounts/[accountId]/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Facebook Granular Disconnection & Multi-Tenant Governance (User Story 4 - T069)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';
  const pageId = '33333333-3333-4333-a333-333333333333';
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

  describe('Disconnect Page (DELETE /api/tenant/[subdomain]/pages/[pageId])', () => {
    it('deletes specific page under (user_id, pageId) without affecting parent account or sibling pages', async () => {
      let deletedParams: any[] = [];
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('DELETE FROM facebook_pages')) {
            deletedParams = params;
            return Promise.resolve([{ id: pageId }]);
          }
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );

      const res = await handleDisconnectPage(req, 'acme', pageId, mockDb);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.pageId).toBe(pageId);

      // Verify deletion parameters include compound user_id check
      expect(deletedParams[0]).toBe(pageId);
      expect(deletedParams[1]).toBe(userId);
    });

    it('returns 404 when page does not exist or belongs to another user', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue([]),
      } as unknown as DatabaseClient;

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/pages/${pageId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );

      const res = await handleDisconnectPage(req, 'acme', pageId, mockDb);
      expect(res.status).toBe(404);
    });

    it('rejects cross-tenant access with 403', async () => {
      const mockDb = { query: vi.fn() } as unknown as DatabaseClient;
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/evil-tenant/pages/${pageId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );

      const res = await handleDisconnectPage(req, 'evil-tenant', pageId, mockDb);
      expect(res.status).toBe(403);
    });
  });

  describe('Disconnect Account (DELETE /api/tenant/[subdomain]/accounts/[accountId])', () => {
    it('deletes account under (user_id, accountId), cascading linked pages, returning disconnected count', async () => {
      let deletedAccountParams: any[] = [];
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('SELECT COUNT')) {
            return Promise.resolve([{ count: 2 }]);
          }
          if (sql.includes('DELETE FROM facebook_accounts')) {
            deletedAccountParams = params;
            return Promise.resolve([{ id: accountId }]);
          }
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/accounts/${accountId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );

      const res = await handleDisconnectAccount(
        req,
        'acme',
        accountId,
        mockDb
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.accountId).toBe(accountId);
      expect(json.disconnectedPagesCount).toBe(2);

      expect(deletedAccountParams[0]).toBe(accountId);
      expect(deletedAccountParams[1]).toBe(userId);
    });

    it('returns 404 when account does not exist or belongs to another user', async () => {
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT COUNT')) {
            return Promise.resolve([{ count: 0 }]);
          }
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/accounts/${accountId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );

      const res = await handleDisconnectAccount(
        req,
        'acme',
        accountId,
        mockDb
      );
      expect(res.status).toBe(404);
    });

    it('rejects cross-tenant access with 403', async () => {
      const mockDb = { query: vi.fn() } as unknown as DatabaseClient;
      const req = new NextRequest(
        `http://localhost:3000/api/tenant/evil-tenant/accounts/${accountId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );

      const res = await handleDisconnectAccount(
        req,
        'evil-tenant',
        accountId,
        mockDb
      );
      expect(res.status).toBe(403);
    });
  });
});
