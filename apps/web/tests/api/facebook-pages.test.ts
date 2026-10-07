import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  encryptToken,
  decryptToken,
  signSessionToken,
} from '@fbuploadpro/contracts';
import { handleDiscoverPages } from '../../src/app/api/tenant/[subdomain]/accounts/[accountId]/pages/discover/route';
import { handleImportPages } from '../../src/app/api/tenant/[subdomain]/pages/import/route';
import { handleListPages } from '../../src/app/api/tenant/[subdomain]/pages/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Facebook Pages Discovery & Selective Import (User Story 2 - T062)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';
  let validSessionCookie: string;
  let sampleEncryptedAccountToken: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

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

    sampleEncryptedAccountToken = await encryptToken(
      'mock_long_lived_account_token',
      TEST_ENCRYPTION_KEY
    );
  });

  describe('Page Discovery (GET /api/tenant/[subdomain]/accounts/[accountId]/pages/discover)', () => {
    it('discovers pages from Graph API v26.0, excludes groups, marks isImported flag, and never leaks tokens', async () => {
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM facebook_accounts')) {
            return Promise.resolve([
              {
                id: accountId,
                userId,
                fbAccountId: 'fb_act_123',
                displayName: 'Alex Marketing Profile',
                encryptedAccessToken: sampleEncryptedAccountToken,
                status: 'active',
              },
            ]);
          }
          if (sql.includes('FROM facebook_pages')) {
            // Already imported page 1
            return Promise.resolve([{ fbPageId: 'page_1001' }]);
          }
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      // Mock Graph API v26.0 /me/accounts response with pages and mixed items
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'page_1001',
                name: 'Brand Flagship Page',
                category: 'Retail Company',
                followers_count: 52000,
                tasks: ['CREATE_CONTENT', 'MANAGE'],
                access_token: 'page_token_1001_secret',
              },
              {
                id: 'page_1002',
                name: 'Creator Vlog Page',
                category: 'Digital Creator',
                followers_count: 14000,
                tasks: ['CREATE_CONTENT'],
                access_token: 'page_token_1002_secret',
              },
              {
                // Hypothetical group node accidentally returned - must be ignored
                id: 'group_9999',
                name: 'Unofficial Community Group',
                access_token: 'group_token',
              },
            ],
          }),
          { status: 200 }
        )
      );

      const req = new NextRequest(
        'http://localhost:3000/api/tenant/acme/accounts/22222222-2222-4222-a222-222222222222/pages/discover',
        { headers: { cookie: validSessionCookie } }
      );

      const res = await handleDiscoverPages(req, 'acme', accountId, mockDb);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.accountId).toBe(accountId);
      expect(json.pages).toHaveLength(2); // strictly pages, group filtered out

      const page1 = json.pages.find((p: { fbPageId: string }) => p.fbPageId === 'page_1001');
      const page2 = json.pages.find((p: { fbPageId: string }) => p.fbPageId === 'page_1002');

      expect(page1.isImported).toBe(true);
      expect(page2.isImported).toBe(false);

      // Verify zero token leakage in response
      const resString = JSON.stringify(json);
      expect(resString).not.toContain('page_token');
      expect(resString).not.toContain('secret');
      expect(resString).not.toContain('group_9999');
    });
  });

  describe('Selective Import (POST /api/tenant/[subdomain]/pages/import)', () => {
    it('selectively imports chosen pages, encrypts Page access tokens, and persists to facebook_pages', async () => {
      let savedPages: any[] = [];
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('FROM facebook_accounts')) {
            return Promise.resolve([
              {
                id: accountId,
                userId,
                fbAccountId: 'fb_act_123',
                encryptedAccessToken: sampleEncryptedAccountToken,
                status: 'active',
              },
            ]);
          }
          if (sql.includes('INSERT INTO facebook_pages')) {
            savedPages.push(params);
            return Promise.resolve([
              {
                id: '33333333-3333-4333-a333-333333333333',
                fbPageId: params[2],
                pageName: params[3],
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      // Mock Graph API v26.0 /me/accounts returning details with Page access tokens
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'page_1002',
                name: 'Creator Vlog Page',
                category: 'Digital Creator',
                followers_count: 14000,
                tasks: ['CREATE_CONTENT'],
                access_token: 'page_token_1002_raw_secret_value',
              },
            ],
          }),
          { status: 200 }
        )
      );

      const req = new NextRequest(
        'http://localhost:3000/api/tenant/acme/pages/import',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: validSessionCookie,
          },
          body: JSON.stringify({
            accountId,
            selectedPageIds: ['page_1002'],
          }),
        }
      );

      const res = await handleImportPages(req, 'acme', mockDb);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.importedCount).toBe(1);

      expect(savedPages).toHaveLength(1);
      const [uId, accId, fbPageId, pageName, category, tasksJson, followers, encryptedToken] = savedPages[0];

      expect(uId).toBe(userId);
      expect(accId).toBe(accountId);
      expect(fbPageId).toBe('page_1002');
      expect(pageName).toBe('Creator Vlog Page');
      expect(category).toBe('Digital Creator');
      expect(followers).toBe(14000);
      expect(encryptedToken).toBeTypeOf('string');
      expect(encryptedToken).toContain(':');

      // Verify page token decodes back to original
      const decrypted = await decryptToken(encryptedToken, TEST_ENCRYPTION_KEY);
      expect(decrypted).toBe('page_token_1002_raw_secret_value');
    });
  });

  describe('List Imported Pages (GET /api/tenant/[subdomain]/pages)', () => {
    it('returns sanitized imported pages for the tenant workspace', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue([
          {
            id: '33333333-3333-4333-a333-333333333333',
            facebookAccountId: accountId,
            accountDisplayName: 'Alex Marketing',
            fbPageId: 'page_1001',
            pageName: 'Brand Flagship Page',
            category: 'Retail Company',
            followersCount: 52000,
            status: 'active',
            tasks: ['CREATE_CONTENT', 'MANAGE'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
      } as unknown as DatabaseClient;

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/pages', {
        headers: { cookie: validSessionCookie },
      });

      const res = await handleListPages(req, 'acme', mockDb);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.total).toBe(1);
      expect(json.pages[0].pageName).toBe('Brand Flagship Page');

      // Never leak tokens
      const str = JSON.stringify(json);
      expect(str).not.toContain('encryptedAccessToken');
      expect(str).not.toContain('accessToken');
    });
  });
});
