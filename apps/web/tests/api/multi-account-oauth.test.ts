import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { decryptToken, signOAuthState, signSessionToken } from '@fbuploadpro/contracts';
import { handleFacebookCallback } from '../../src/app/api/auth/facebook/callback/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Multi-Account Facebook OAuth Connection (User Story 1 - T059 & Spec 031)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  let validSessionCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    process.env.FACEBOOK_APP_ID = 'fb_app_id_123';
    process.env.FACEBOOK_APP_SECRET = 'fb_app_secret_456';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;

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

  function createMockAccountStore() {
    const storedAccounts = new Map<
      string,
      {
        id: string;
        fbAccountId: string;
        displayName: string;
        token: string;
        profilePictureUrl: string | null;
        gender: string | null;
        accountLink: string | null;
        status: string;
      }
    >();

    const storedPages = new Map<
      string,
      {
        id: string;
        facebookAccountId: string;
        fbPageId: string;
        encryptedPageToken: string;
        status: string;
      }
    >();

    const mockDb = {
      query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, status FROM facebook_accounts')) {
          const [uId, fbAccountId] = params as [string, string];
          const existing = storedAccounts.get(`${uId}:${fbAccountId}`);
          return Promise.resolve(existing ? [{ id: existing.id, status: existing.status }] : []);
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO facebook_accounts')) {
          const [
            uId,
            fbAccountId,
            displayName,
            token,
            _expiresAt,
            profilePictureUrl,
            gender,
            accountLink,
          ] = params as [
            string,
            string,
            string,
            string,
            unknown,
            string | null,
            string | null,
            string | null,
          ];
          const existing = storedAccounts.get(`${uId}:${fbAccountId}`);
          const rowId = existing?.id ?? `acc_${fbAccountId}`;
          storedAccounts.set(`${uId}:${fbAccountId}`, {
            id: rowId,
            fbAccountId,
            displayName,
            token,
            profilePictureUrl,
            gender,
            accountLink,
            status: 'active',
          });
          return Promise.resolve([{ id: rowId }]);
        }
        if (typeof sql === 'string' && sql.includes('FROM facebook_pages')) {
          const [accountRowId] = params as [string, string];
          const matching = Array.from(storedPages.values())
            .filter(
              (p) =>
                p.facebookAccountId === accountRowId && p.status !== 'disconnected'
            )
            .map((p) => ({
              id: p.id,
              fb_page_id: p.fbPageId,
              status: p.status,
            }));
          return Promise.resolve(matching);
        }
        if (typeof sql === 'string' && sql.includes('UPDATE facebook_pages')) {
          const [encryptedPageToken, _expiresAt, pageId] = params as [
            string,
            Date,
            string,
            string,
          ];
          const existingPage = storedPages.get(pageId);
          if (existingPage) {
            existingPage.encryptedPageToken = encryptedPageToken;
            if (existingPage.status === 'invalid_token') {
              existingPage.status = 'active';
            }
          }
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
    } as unknown as DatabaseClient;

    return { storedAccounts, storedPages, mockDb };
  }

  it('allows connecting multiple distinct Facebook accounts under the same workspace without collisions', async () => {
    const statePayload = {
      tenantSubdomain: 'acme',
      userId,
      nonce: 'nonce_multi_12345',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const validState = await signOAuthState(statePayload, TEST_SECRET);
    const { storedAccounts, mockDb } = createMockAccountStore();

    // Simulate Account 1 connection (with picture.data.url, gender, and link)
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'short_1', token_type: 'bearer' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'long_1', token_type: 'bearer', expires_in: 5184000 })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'fb_user_alpha',
            name: 'Alpha Agency Profile',
            gender: 'female',
            link: 'https://www.facebook.com/app_scoped_user_id/fb_user_alpha/',
            picture: { data: { url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/alpha.jpg' } },
          })
        )
      );

    const req1 = new NextRequest(
      `http://localhost:3000/api/auth/facebook/callback?code=code_alpha&state=${validState}`,
      { headers: { cookie: validSessionCookie } }
    );
    await handleFacebookCallback(req1, mockDb);

    // Simulate Account 2 connection (without picture, gender, or link -> null fallback)
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'short_2', token_type: 'bearer' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'long_2', token_type: 'bearer', expires_in: 5184000 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'fb_user_beta', name: 'Beta Personal Profile' })));

    const req2 = new NextRequest(
      `http://localhost:3000/api/auth/facebook/callback?code=code_beta&state=${validState}`,
      { headers: { cookie: validSessionCookie } }
    );
    await handleFacebookCallback(req2, mockDb);

    // Verify both distinct accounts are preserved in the workspace with profile_picture_url, gender, and account_link
    expect(storedAccounts.size).toBe(2);
    expect(storedAccounts.get(`${userId}:fb_user_alpha`)?.displayName).toBe('Alpha Agency Profile');
    expect(storedAccounts.get(`${userId}:fb_user_alpha`)?.profilePictureUrl).toBe(
      'https://platform-lookaside.fbsbx.com/platform/profilepic/alpha.jpg'
    );
    expect(storedAccounts.get(`${userId}:fb_user_alpha`)?.gender).toBe('female');
    expect(storedAccounts.get(`${userId}:fb_user_alpha`)?.accountLink).toBe(
      'https://www.facebook.com/app_scoped_user_id/fb_user_alpha/'
    );
    expect(storedAccounts.get(`${userId}:fb_user_beta`)?.displayName).toBe('Beta Personal Profile');
    expect(storedAccounts.get(`${userId}:fb_user_beta`)?.profilePictureUrl).toBeNull();
    expect(storedAccounts.get(`${userId}:fb_user_beta`)?.gender).toBeNull();
    expect(storedAccounts.get(`${userId}:fb_user_beta`)?.accountLink).toBeNull();
  });

  it('updates existing credentials, profile_picture_url, gender, and account_link when reconnecting the same Facebook account', async () => {
    const statePayload = {
      tenantSubdomain: 'acme',
      userId,
      nonce: 'nonce_multi_reconnect',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const validState = await signOAuthState(statePayload, TEST_SECRET);
    const { storedAccounts, mockDb } = createMockAccountStore();

    // Initial connection
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'short_1', token_type: 'bearer' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'long_initial', token_type: 'bearer', expires_in: 5184000 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'fb_user_same', name: 'Same Profile' })));

    const req1 = new NextRequest(
      `http://localhost:3000/api/auth/facebook/callback?code=code_1&state=${validState}`,
      { headers: { cookie: validSessionCookie } }
    );
    await handleFacebookCallback(req1, mockDb);

    // Reconnection of same fbAccountId with updated avatar, gender, and link
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'short_2', token_type: 'bearer' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'long_refreshed', token_type: 'bearer', expires_in: 5184000 })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'fb_user_same',
            name: 'Same Profile Renamed',
            gender: 'male',
            link: 'https://www.facebook.com/app_scoped_user_id/fb_user_same/',
            picture: { data: { url: 'https://platform-lookaside.fbsbx.com/platform/profilepic/refreshed.jpg' } },
          })
        )
      );

    const req2 = new NextRequest(
      `http://localhost:3000/api/auth/facebook/callback?code=code_2&state=${validState}`,
      { headers: { cookie: validSessionCookie } }
    );
    const res2 = await handleFacebookCallback(req2, mockDb);

    // Standard connect flow for already-connected account redirects with ?connected=already&accountName=...
    expect(res2.status).toBe(307);
    expect(res2.headers.get('location')).toBe(
      'http://localhost:3000/tenant/acme/accounts?connected=already&accountName=Same+Profile+Renamed'
    );

    // Size remains 1 (no duplicate rows created)
    expect(storedAccounts.size).toBe(1);
    expect(storedAccounts.get(`${userId}:fb_user_same`)?.displayName).toBe('Same Profile Renamed');
    expect(storedAccounts.get(`${userId}:fb_user_same`)?.profilePictureUrl).toBe(
      'https://platform-lookaside.fbsbx.com/platform/profilepic/refreshed.jpg'
    );
    expect(storedAccounts.get(`${userId}:fb_user_same`)?.gender).toBe('male');
    expect(storedAccounts.get(`${userId}:fb_user_same`)?.accountLink).toBe(
      'https://www.facebook.com/app_scoped_user_id/fb_user_same/'
    );
  });

  it('auto-refreshes encrypted_page_token for all linked pages on reconnect and sets status = active ONLY for invalid_token pages without importing unlinked pages (Spec 031)', async () => {
    const { storedAccounts, storedPages, mockDb } = createMockAccountStore();
    storedAccounts.set(`${userId}:fb-john`, {
      id: 'acc_fb-john',
      fbAccountId: 'fb-john',
      displayName: 'John Doe',
      token: 'old_encrypted_token',
      profilePictureUrl: null,
      gender: 'male',
      accountLink: null,
      status: 'expired',
    });

    storedPages.set('page_row_a', {
      id: 'page_row_a',
      facebookAccountId: 'acc_fb-john',
      fbPageId: 'fb_page_a',
      encryptedPageToken: 'stale_token_a',
      status: 'invalid_token',
    });
    storedPages.set('page_row_b', {
      id: 'page_row_b',
      facebookAccountId: 'acc_fb-john',
      fbPageId: 'fb_page_b',
      encryptedPageToken: 'stale_token_b',
      status: 'paused',
    });
    storedPages.set('page_row_c', {
      id: 'page_row_c',
      facebookAccountId: 'acc_fb-john',
      fbPageId: 'fb_page_c',
      encryptedPageToken: 'stale_token_c',
      status: 'active',
    });

    const reconnectState = await signOAuthState(
      {
        tenantSubdomain: 'acme',
        userId,
        nonce: 'nonce_page_sync_12345',
        expectedFbAccountId: 'fb-john',
        expectedDisplayName: 'John Doe',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600,
      },
      TEST_SECRET
    );

    global.fetch = vi
      .fn()
      // 1. Short-lived token
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'short_john', token_type: 'bearer' }))
      )
      // 2. Long-lived token
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'long_john_fresh',
            token_type: 'bearer',
            expires_in: 5184000,
          })
        )
      )
      // 3. /me
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'fb-john', name: 'John Doe' }))
      )
      // 4. /me/accounts?fields=id,access_token (includes 3 linked pages + 1 unlinked page)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { id: 'fb_page_a', access_token: 'fresh_page_token_a' },
              { id: 'fb_page_b', access_token: 'fresh_page_token_b' },
              { id: 'fb_page_c', access_token: 'fresh_page_token_c' },
              { id: 'fb_page_unlinked_d', access_token: 'fresh_page_token_d' },
            ],
          })
        )
      );

    const req = new NextRequest(
      `http://localhost:3000/api/auth/facebook/callback?code=code_john&state=${reconnectState}`,
      { headers: { cookie: validSessionCookie } }
    );
    const res = await handleFacebookCallback(req, mockDb);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/tenant/acme/accounts?connected=1'
    );

    // Verify all 3 linked pages had their tokens encrypted and updated
    expect(
      await decryptToken(storedPages.get('page_row_a')!.encryptedPageToken, TEST_ENCRYPTION_KEY)
    ).toBe('fresh_page_token_a');
    expect(
      await decryptToken(storedPages.get('page_row_b')!.encryptedPageToken, TEST_ENCRYPTION_KEY)
    ).toBe('fresh_page_token_b');
    expect(
      await decryptToken(storedPages.get('page_row_c')!.encryptedPageToken, TEST_ENCRYPTION_KEY)
    ).toBe('fresh_page_token_c');

    // Verify status transition: invalid_token -> active, paused -> paused, active -> active
    expect(storedPages.get('page_row_a')!.status).toBe('active');
    expect(storedPages.get('page_row_b')!.status).toBe('paused');
    expect(storedPages.get('page_row_c')!.status).toBe('active');

    // Verify unlinked page was NOT auto-imported
    expect(storedPages.size).toBe(3);
  });

  it('saves the newly authenticated account AND redirects with ?reconnected_mismatch=1 when Facebook returns a different account than expectedFbAccountId (Spec 031)', async () => {
    const { storedAccounts, mockDb } = createMockAccountStore();
    storedAccounts.set(`${userId}:fb-john`, {
      id: 'acc_fb-john',
      fbAccountId: 'fb-john',
      displayName: 'John Doe',
      token: 'expired_token',
      profilePictureUrl: null,
      gender: 'male',
      accountLink: null,
      status: 'expired',
    });

    const mismatchState = await signOAuthState(
      {
        tenantSubdomain: 'acme',
        userId,
        nonce: 'nonce_mismatch_12345',
        expectedFbAccountId: 'fb-john',
        expectedDisplayName: 'John Doe',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600,
      },
      TEST_SECRET
    );

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'short_jane', token_type: 'bearer' }))
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'long_jane',
            token_type: 'bearer',
            expires_in: 5184000,
          })
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'fb-jane', name: 'Jane Smith' }))
      );

    const req = new NextRequest(
      `http://localhost:3000/api/auth/facebook/callback?code=code_jane&state=${mismatchState}`,
      { headers: { cookie: validSessionCookie } }
    );
    const res = await handleFacebookCallback(req, mockDb);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/tenant/acme/accounts?reconnected_mismatch=1&newAccountName=Jane+Smith&expectedAccountName=John+Doe'
    );

    // Jane Smith is saved as active while John Doe remains untouched in the store
    expect(storedAccounts.get(`${userId}:fb-jane`)?.displayName).toBe('Jane Smith');
    expect(storedAccounts.get(`${userId}:fb-jane`)?.status).toBe('active');
    expect(storedAccounts.get(`${userId}:fb-john`)?.status).toBe('expired');
  });
});

