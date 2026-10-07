import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  encryptToken,
  signSessionToken,
} from '@fbuploadpro/contracts';
import { handleListAccounts } from '../../src/app/api/tenant/[subdomain]/accounts/route';
import { handleListPages } from '../../src/app/api/tenant/[subdomain]/pages/route';
import { handleDiscoverPages } from '../../src/app/api/tenant/[subdomain]/accounts/[accountId]/pages/discover/route';
import { handleImportPages } from '../../src/app/api/tenant/[subdomain]/pages/import/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Security Audit: Zero Token & Credential Leakage (T075)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const accountId = '22222222-2222-4222-a222-222222222222';
  const pageId = '33333333-3333-4333-a333-333333333333';
  let validSessionCookie: string;
  let sampleCiphertext: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;

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
    sampleCiphertext = await encryptToken('super_confidential_raw_fb_token_xyz', TEST_KEY);
  });

  it('GET /accounts never leaks raw or encrypted access tokens in JSON body or headers', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue([
        {
          id: accountId,
          fbAccountId: 'fb_123',
          displayName: 'Marketing Lead',
          status: 'active',
          tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          encrypted_access_token: sampleCiphertext,
          connected_pages_count: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    } as unknown as DatabaseClient;

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/accounts', {
      headers: { cookie: validSessionCookie },
    });

    const res = await handleListAccounts(req, 'acme', mockDb);
    expect(res.status).toBe(200);

    const bodyText = await res.text();
    expect(bodyText).not.toContain('super_confidential_raw_fb_token_xyz');
    expect(bodyText).not.toContain(sampleCiphertext);
    expect(bodyText).not.toContain('encrypted_access_token');
    expect(bodyText).not.toContain('encryptedAccessToken');
    expect(bodyText).not.toContain('TOKEN_ENCRYPTION_KEY');
  });

  it('GET /pages never leaks raw or encrypted access tokens in JSON body', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue([
        {
          id: pageId,
          facebookAccountId: accountId,
          accountDisplayName: 'Marketing Lead',
          fbPageId: 'page_987',
          pageName: 'Brand Main Page',
          category: 'Retail',
          followersCount: 50000,
          status: 'active',
          tasks: ['CREATE_CONTENT'],
          encrypted_access_token: sampleCiphertext,
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

    const bodyText = await res.text();
    expect(bodyText).not.toContain('super_confidential_raw_fb_token_xyz');
    expect(bodyText).not.toContain(sampleCiphertext);
    expect(bodyText).not.toContain('encrypted_access_token');
    expect(bodyText).not.toContain('encryptedAccessToken');
  });

  it('GET /discover strips Graph API Page access tokens from client payload', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM facebook_accounts')) {
          return Promise.resolve([
            {
              id: accountId,
              userId,
              fbAccountId: 'fb_123',
              displayName: 'Marketing Lead',
              encryptedAccessToken: sampleCiphertext,
              status: 'active',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DatabaseClient;

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'page_12345',
              name: 'Enterprise Page',
              category: 'Business',
              followers_count: 1000,
              tasks: ['MANAGE'],
              access_token: 'EAA_RAW_PAGE_TOKEN_SECRET_NEVER_LEAK',
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

    const bodyText = await res.text();
    expect(bodyText).not.toContain('EAA_RAW_PAGE_TOKEN_SECRET_NEVER_LEAK');
    expect(bodyText).not.toContain('access_token');
    expect(bodyText).not.toContain(sampleCiphertext);
  });

  it('POST /import returns sanitized confirmation without leaking tokens', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM facebook_accounts')) {
          return Promise.resolve([
            {
              id: accountId,
              userId,
              fbAccountId: 'fb_123',
              displayName: 'Marketing Lead',
              encryptedAccessToken: sampleCiphertext,
              status: 'active',
            },
          ]);
        }
        if (sql.includes('INSERT INTO facebook_pages')) {
          return Promise.resolve([
            {
              id: pageId,
              fbPageId: 'page_12345',
              pageName: 'Enterprise Page',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DatabaseClient;

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'page_12345',
              name: 'Enterprise Page',
              category: 'Business',
              followers_count: 1000,
              tasks: ['MANAGE'],
              access_token: 'EAA_RAW_PAGE_TOKEN_SECRET_NEVER_LEAK',
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
          selectedPageIds: ['page_12345'],
        }),
      }
    );

    const res = await handleImportPages(req, 'acme', mockDb);
    expect(res.status).toBe(200);

    const bodyText = await res.text();
    expect(bodyText).not.toContain('EAA_RAW_PAGE_TOKEN_SECRET_NEVER_LEAK');
    expect(bodyText).not.toContain('access_token');
    expect(bodyText).not.toContain(sampleCiphertext);
  });
});
