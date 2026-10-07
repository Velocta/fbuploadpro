import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signOAuthState, signSessionToken } from '@fbuploadpro/contracts';
import { handleFacebookCallback } from '../../src/app/api/auth/facebook/callback/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Multi-Account Facebook OAuth Connection (User Story 1 - T059)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  let validSessionCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    process.env.FACEBOOK_APP_ID = 'fb_app_id_123';
    process.env.FACEBOOK_APP_SECRET = 'fb_app_secret_456';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

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

  it('allows connecting multiple distinct Facebook accounts under the same workspace without collisions', async () => {
    const statePayload = {
      tenantSubdomain: 'acme',
      userId,
      nonce: 'nonce_multi_12345',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const validState = await signOAuthState(statePayload, TEST_SECRET);

    // Mock in-memory database storage simulating ON CONFLICT (user_id, fb_account_id)
    const storedAccounts = new Map<string, { fbAccountId: string; displayName: string; token: string }>();

    const mockDb = {
      query: vi.fn().mockImplementation((_sql, params) => {
        const [uId, fbAccountId, displayName, token] = params;
        const key = `${uId}:${fbAccountId}`;
        storedAccounts.set(key, { fbAccountId, displayName, token });
        return Promise.resolve([{ id: 'acc_id' }]);
      }),
    } as unknown as DatabaseClient;

    // Simulate Account 1 connection
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'short_1', token_type: 'bearer' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'long_1', token_type: 'bearer', expires_in: 5184000 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'fb_user_alpha', name: 'Alpha Agency Profile' })));

    const req1 = new NextRequest(
      `http://localhost:3000/api/auth/facebook/callback?code=code_alpha&state=${validState}`,
      { headers: { cookie: validSessionCookie } }
    );
    await handleFacebookCallback(req1, mockDb);

    // Simulate Account 2 connection
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

    // Verify both distinct accounts are preserved in the workspace
    expect(storedAccounts.size).toBe(2);
    expect(storedAccounts.get(`${userId}:fb_user_alpha`)?.displayName).toBe('Alpha Agency Profile');
    expect(storedAccounts.get(`${userId}:fb_user_beta`)?.displayName).toBe('Beta Personal Profile');
  });

  it('updates existing credentials when reconnecting the same Facebook account', async () => {
    const statePayload = {
      tenantSubdomain: 'acme',
      userId,
      nonce: 'nonce_multi_reconnect',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const validState = await signOAuthState(statePayload, TEST_SECRET);

    const storedAccounts = new Map<string, { fbAccountId: string; displayName: string; token: string }>();

    const mockDb = {
      query: vi.fn().mockImplementation((_sql, params) => {
        const [uId, fbAccountId, displayName, token] = params;
        const key = `${uId}:${fbAccountId}`;
        storedAccounts.set(key, { fbAccountId, displayName, token });
        return Promise.resolve([{ id: 'acc_id' }]);
      }),
    } as unknown as DatabaseClient;

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

    // Reconnection of same fbAccountId
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'short_2', token_type: 'bearer' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'long_refreshed', token_type: 'bearer', expires_in: 5184000 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'fb_user_same', name: 'Same Profile Renamed' })));

    const req2 = new NextRequest(
      `http://localhost:3000/api/auth/facebook/callback?code=code_2&state=${validState}`,
      { headers: { cookie: validSessionCookie } }
    );
    await handleFacebookCallback(req2, mockDb);

    // Size remains 1 (no duplicate rows created)
    expect(storedAccounts.size).toBe(1);
    expect(storedAccounts.get(`${userId}:fb_user_same`)?.displayName).toBe('Same Profile Renamed');
  });
});
