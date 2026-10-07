import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  decryptToken,
  signOAuthState,
  signSessionToken,
} from '@fbuploadpro/contracts';
import { GET as initiateFacebookOAuth } from '../../src/app/api/auth/facebook/route';
import { handleFacebookCallback } from '../../src/app/api/auth/facebook/callback/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Facebook OAuth Initiation & Callback Handlers (User Story 1 - T058)', () => {
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

  it('redirects unauthenticated users to /login when initiating OAuth', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/facebook');
    const res = await initiateFacebookOAuth(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('redirects authenticated users to Facebook OAuth dialog targeting v26.0 with required scopes', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/facebook', {
      headers: { cookie: validSessionCookie },
    });
    const res = await initiateFacebookOAuth(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBeDefined();

    const url = new URL(location!);
    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.pathname).toBe('/v26.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('fb_app_id_123');
    expect(url.searchParams.get('scope')).toBe(
      'pages_show_list,pages_read_engagement,pages_manage_posts,business_management'
    );
    expect(url.searchParams.get('state')).toBeDefined();
  });

  it('handles Facebook OAuth callback error with safe redirection', async () => {
    const mockDb = { query: vi.fn() } as unknown as DatabaseClient;
    const req = new NextRequest(
      'http://localhost:3000/api/auth/facebook/callback?error=access_denied&error_description=User+denied+permissions&state=fake'
    );

    const res = await handleFacebookCallback(req, mockDb);
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).toContain('/accounts');
    expect(location).toContain('error=access_denied');
  });

  it('processes valid callback, exchanges code for long-lived token, encrypts token, and persists account', async () => {
    const statePayload = {
      tenantSubdomain: 'acme',
      userId,
      nonce: 'random_nonce_1234567890',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const validState = await signOAuthState(statePayload, TEST_SECRET);

    // Mock fetch for Graph API calls
    const mockFetch = vi.fn();
    // 1. Code to short-lived token
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'short_lived_token_abc',
          token_type: 'bearer',
          expires_in: 7200,
        }),
        { status: 200 }
      )
    );
    // 2. Short-lived to long-lived token
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'long_lived_token_xyz_60_days',
          token_type: 'bearer',
          expires_in: 5184000,
        }),
        { status: 200 }
      )
    );
    // 3. User profile /me
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'fb_user_10928374',
          name: 'Alex Professional',
        }),
        { status: 200 }
      )
    );
    global.fetch = mockFetch;

    let savedEncryptedToken = '';
    const mockDb = {
      query: vi.fn().mockImplementation((sql, params) => {
        savedEncryptedToken = params[3];
        return Promise.resolve([{ id: 'acc_123' }]);
      }),
    } as unknown as DatabaseClient;

    const req = new NextRequest(
      `http://localhost:3000/api/auth/facebook/callback?code=mock_code_123&state=${validState}`,
      { headers: { cookie: validSessionCookie } }
    );

    const res = await handleFacebookCallback(req, mockDb);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/tenant/acme/accounts?connected=1');

    expect(mockDb.query).toHaveBeenCalled();
    expect(savedEncryptedToken).toBeTypeOf('string');
    expect(savedEncryptedToken).toContain(':');

    // Verify encrypted token decodes back to original long-lived token
    const decrypted = await decryptToken(savedEncryptedToken, TEST_ENCRYPTION_KEY);
    expect(decrypted).toBe('long_lived_token_xyz_60_days');
  });
});
