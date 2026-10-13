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
import { handleDisconnectPage } from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/route';
import type { DatabaseClient } from '@fbuploadpro/contracts';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Facebook Pages Discovery, Import, Follower Tracking & Soft-Delete (Spec 032)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';
  const pageId = '33333333-3333-4333-a333-333333333333';
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
    it('discovers pages from Graph API v26.0, excludes groups and soft-deleted (disconnected) pages from isImported: true, and never leaks tokens', async () => {
      const executedQueries: string[] = [];
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          executedQueries.push(sql);
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
            // Query must exclude status != 'disconnected' so page_disconnected is not returned here
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
                picture: {
                  data: {
                    url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/page_1001.jpg',
                  },
                },
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
                id: 'page_disconnected',
                name: 'Previously Removed Page',
                category: 'Media/News Company',
                followers_count: 8500,
                tasks: ['CREATE_CONTENT'],
                access_token: 'page_token_disc_secret',
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
        `http://localhost:3000/api/tenant/acme/accounts/${accountId}/pages/discover`,
        { headers: { cookie: validSessionCookie } }
      );

      const res = await handleDiscoverPages(req, 'acme', accountId, mockDb);
      expect(res.status).toBe(200);

      const pagesSql = executedQueries.find((q) => q.includes('FROM facebook_pages'));
      expect(pagesSql).toBeDefined();
      expect(pagesSql).toContain("status != 'disconnected'");

      const json = await res.json();
      expect(json.accountId).toBe(accountId);
      expect(json.pages).toHaveLength(3); // strictly pages, group filtered out

      const page1 = json.pages.find((p: { fbPageId: string }) => p.fbPageId === 'page_1001');
      const page2 = json.pages.find((p: { fbPageId: string }) => p.fbPageId === 'page_1002');
      const pageDisc = json.pages.find(
        (p: { fbPageId: string }) => p.fbPageId === 'page_disconnected'
      );

      expect(page1.isImported).toBe(true);
      expect(page1.currentFollowers).toBe(52000);
      expect(page1.profilePictureUrl).toBe(
        'https://platform-lookaside.fbsbx.com/platform/profilepic/page_1001.jpg'
      );
      expect(page2.isImported).toBe(false);
      expect(page2.currentFollowers).toBe(14000);
      expect(page2.profilePictureUrl).toBeNull();
      expect(pageDisc.isImported).toBe(false);

      // Verify zero token leakage in response
      const resString = JSON.stringify(json);
      expect(resString).not.toContain('page_token');
      expect(resString).not.toContain('secret');
      expect(resString).not.toContain('group_9999');
    });
  });

  describe('Selective Import (POST /api/tenant/[subdomain]/pages/import)', () => {
    it('sets both starting_followers and current_followers on insert, and preserves starting_followers on conflict unless page was disconnected', async () => {
      const savedPages: any[] = [];
      const executedInsertSqls: string[] = [];
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
            executedInsertSqls.push(sql);
            savedPages.push(params);
            return Promise.resolve([
              {
                id: pageId,
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
                picture: {
                  data: {
                    url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/page_1002.jpg',
                  },
                },
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

      expect(executedInsertSqls).toHaveLength(1);
      const insertSql = executedInsertSqls[0]!;
      expect(insertSql).toContain('starting_followers, current_followers');
      expect(insertSql).toContain('VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)');
      expect(insertSql).toContain('current_followers = EXCLUDED.current_followers');
      expect(insertSql).toContain(
        "WHEN facebook_pages.status = 'disconnected' THEN EXCLUDED.starting_followers"
      );
      expect(insertSql).toContain('ELSE facebook_pages.starting_followers');

      expect(savedPages).toHaveLength(1);
      const [
        uId,
        accId,
        fbPageId,
        pageName,
        category,
        _tasksJson,
        followers,
        encryptedToken,
        profilePictureUrl,
      ] = savedPages[0];

      expect(uId).toBe(userId);
      expect(accId).toBe(accountId);
      expect(fbPageId).toBe('page_1002');
      expect(pageName).toBe('Creator Vlog Page');
      expect(category).toBe('Digital Creator');
      expect(followers).toBe(14000);
      expect(encryptedToken).toBeTypeOf('string');
      expect(encryptedToken).toContain(':');
      expect(profilePictureUrl).toBe(
        'https://platform-lookaside.fbsbx.com/platform/profilepic/page_1002.jpg'
      );

      // Verify page token decodes back to original
      const decrypted = await decryptToken(encryptedToken, TEST_ENCRYPTION_KEY);
      expect(decrypted).toBe('page_token_1002_raw_secret_value');
    });
  });

  describe('List Imported Pages (GET /api/tenant/[subdomain]/pages)', () => {
    it('returns startingFollowers, currentFollowers, and signed followersGained (positive, zero, and negative) while excluding soft-deleted pages', async () => {
      let capturedSql = '';
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          capturedSql = sql;
          return Promise.resolve([
            {
              id: '33333333-3333-4333-a333-333333333331',
              facebook_account_id: accountId,
              account_display_name: 'Alex Marketing',
              fb_page_id: 'page_pos',
              page_name: 'Brand Flagship Page',
              profile_picture_url:
                'https://platform-lookaside.fbsbx.com/platform/profilepic/page_1001.jpg',
              category: 'Retail Company',
              starting_followers: 50000,
              current_followers: 52000,
              status: 'active',
              tasks: ['CREATE_CONTENT', 'MANAGE'],
              created_at: '2026-10-10T10:00:00.000Z',
              updated_at: new Date().toISOString(),
            },
            {
              id: '33333333-3333-4333-a333-333333333332',
              facebook_account_id: accountId,
              account_display_name: 'Alex Marketing',
              fb_page_id: 'page_zero',
              page_name: 'Steady Community Page',
              profile_picture_url: null,
              category: 'Community',
              starting_followers: 10000,
              current_followers: 10000,
              status: 'active',
              tasks: ['CREATE_CONTENT'],
              created_at: '2026-10-09T10:00:00.000Z',
              updated_at: new Date().toISOString(),
            },
            {
              id: '33333333-3333-4333-a333-333333333333',
              facebook_account_id: accountId,
              account_display_name: 'Alex Marketing',
              fb_page_id: 'page_neg',
              page_name: 'Churned Followers Page',
              profile_picture_url: null,
              category: 'Digital Creator',
              starting_followers: 5000,
              current_followers: 4750,
              status: 'paused',
              tasks: ['CREATE_CONTENT'],
              created_at: '2026-10-08T10:00:00.000Z',
              updated_at: new Date().toISOString(),
            },
          ]);
        }),
      } as unknown as DatabaseClient;

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/pages', {
        headers: { cookie: validSessionCookie },
      });

      const res = await handleListPages(req, 'acme', mockDb);
      expect(res.status).toBe(200);

      expect(capturedSql).toContain("p.status != 'disconnected'");
      expect(capturedSql).toContain('p.starting_followers');
      expect(capturedSql).toContain('p.current_followers');

      const json = await res.json();
      expect(json.total).toBe(3);

      // Page 1: Positive growth (+2000)
      expect(json.pages[0].pageName).toBe('Brand Flagship Page');
      expect(json.pages[0].startingFollowers).toBe(50000);
      expect(json.pages[0].currentFollowers).toBe(52000);
      expect(json.pages[0].followersGained).toBe(2000);
      expect(json.pages[0].profilePictureUrl).toBe(
        'https://platform-lookaside.fbsbx.com/platform/profilepic/page_1001.jpg'
      );

      // Page 2: Zero growth (0)
      expect(json.pages[1].pageName).toBe('Steady Community Page');
      expect(json.pages[1].startingFollowers).toBe(10000);
      expect(json.pages[1].currentFollowers).toBe(10000);
      expect(json.pages[1].followersGained).toBe(0);

      // Page 3: Negative growth (-250)
      expect(json.pages[2].pageName).toBe('Churned Followers Page');
      expect(json.pages[2].startingFollowers).toBe(5000);
      expect(json.pages[2].currentFollowers).toBe(4750);
      expect(json.pages[2].followersGained).toBe(-250);

      // Never leak tokens
      const str = JSON.stringify(json);
      expect(str).not.toContain('encryptedAccessToken');
      expect(str).not.toContain('accessToken');
    });
  });

  describe('Disconnect Page (DELETE /api/tenant/[subdomain]/pages/[pageId])', () => {
    it("performs a soft-delete (status = 'disconnected', wiping encrypted_access_token) and cancels queued posts", async () => {
      const executedStatements: Array<{ sql: string; params: any[] }> = [];
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string, params: any[]) => {
          executedStatements.push({ sql, params });
          if (sql.includes('UPDATE facebook_pages')) {
            return Promise.resolve([{ id: pageId, fb_page_id: 'page_1001' }]);
          }
          if (sql.includes('UPDATE queue_items')) {
            return Promise.resolve([]);
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

      expect(executedStatements).toHaveLength(2);
      expect(executedStatements[0]!.sql).toContain("SET status = 'disconnected'");
      expect(executedStatements[0]!.sql).toContain("encrypted_access_token = ''");
      expect(executedStatements[0]!.params).toEqual([pageId, userId]);

      expect(executedStatements[1]!.sql).toContain('UPDATE queue_items');
      expect(executedStatements[1]!.sql).toContain("SET status = 'skipped'");
      expect(executedStatements[1]!.params).toEqual([userId, pageId]);
    });
  });
});

