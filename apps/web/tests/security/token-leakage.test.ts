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
import type { Database } from '@fbuploadpro/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

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
        email: 'alex@gmail.com',
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
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'facebook_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: accountId,
                      fb_account_id: 'fb_123',
                      display_name: 'Marketing Lead',
                      profile_picture_url: null,
                      gender: null,
                      account_link: null,
                      status: 'active',
                      token_expires_at: new Date(Date.now() + 86400000).toISOString(),
                      encrypted_access_token: sampleCiphertext,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      facebook_pages: [
                        {
                          id: pageId,
                          page_name: 'Brand Main Page',
                          profile_picture_url: null,
                          status: 'active',
                        },
                      ],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/accounts', {
      headers: { cookie: validSessionCookie },
    });

    const res = await handleListAccounts(req, 'acme', mockSupabase);
    expect(res.status).toBe(200);

    const bodyText = await res.text();
    expect(bodyText).not.toContain('super_confidential_raw_fb_token_xyz');
    expect(bodyText).not.toContain(sampleCiphertext);
    expect(bodyText).not.toContain('encrypted_access_token');
    expect(bodyText).not.toContain('encryptedAccessToken');
    expect(bodyText).not.toContain('TOKEN_ENCRYPTION_KEY');
  });

  it('GET /pages never leaks raw or encrypted access tokens in JSON body', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'facebook_pages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: pageId,
                        facebook_account_id: accountId,
                        user_id: userId,
                        fb_page_id: 'page_987',
                        page_name: 'Brand Main Page',
                        category: 'Retail',
                        starting_followers: 50000,
                        current_followers: 50000,
                        status: 'active',
                        tasks: ['CREATE_CONTENT'],
                        encrypted_access_token: sampleCiphertext,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        facebook_accounts: {
                          display_name: 'Marketing Lead',
                        },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/pages', {
      headers: { cookie: validSessionCookie },
    });

    const res = await handleListPages(req, 'acme', mockSupabase);
    expect(res.status).toBe(200);

    const bodyText = await res.text();
    expect(bodyText).not.toContain('super_confidential_raw_fb_token_xyz');
    expect(bodyText).not.toContain(sampleCiphertext);
    expect(bodyText).not.toContain('encrypted_access_token');
    expect(bodyText).not.toContain('encryptedAccessToken');
  });

  it('GET /discover strips Graph API Page access tokens from client payload', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'facebook_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: accountId,
                      user_id: userId,
                      fb_account_id: 'fb_123',
                      display_name: 'Marketing Lead',
                      encrypted_access_token: sampleCiphertext,
                      status: 'active',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'facebook_pages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

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

    const res = await handleDiscoverPages(req, 'acme', accountId, mockSupabase);
    expect(res.status).toBe(200);

    const bodyText = await res.text();
    expect(bodyText).not.toContain('EAA_RAW_PAGE_TOKEN_SECRET_NEVER_LEAK');
    expect(bodyText).not.toContain('access_token');
    expect(bodyText).not.toContain(sampleCiphertext);
  });

  it('POST /import returns sanitized confirmation without leaking tokens', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'facebook_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: accountId,
                      user_id: userId,
                      fb_account_id: 'fb_123',
                      display_name: 'Marketing Lead',
                      encrypted_access_token: sampleCiphertext,
                      status: 'active',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'facebook_pages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: pageId,
                    fb_page_id: 'page_12345',
                    page_name: 'Enterprise Page',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient<Database>;

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

    const res = await handleImportPages(req, 'acme', mockSupabase);
    expect(res.status).toBe(200);

    const bodyText = await res.text();
    expect(bodyText).not.toContain('EAA_RAW_PAGE_TOKEN_SECRET_NEVER_LEAK');
    expect(bodyText).not.toContain('access_token');
    expect(bodyText).not.toContain(sampleCiphertext);
  });
});
