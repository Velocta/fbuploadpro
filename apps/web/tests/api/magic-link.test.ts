import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  signMagicLinkToken,
  signOAuthState,
  signSessionToken,
  verifyOAuthState,
} from '@fbuploadpro/contracts';
import { POST as generateMagicLink } from '../../src/app/api/tenant/[subdomain]/accounts/magic-link/route';
import { GET as forwardMagicLink } from '../../src/app/connect/facebook/route';
import { handleFacebookCallback } from '../../src/app/api/auth/facebook/callback/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Magic Link Facebook Connection Endpoints (Spec 027)', () => {
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

  describe('POST /api/tenant/[subdomain]/accounts/magic-link', () => {
    it('returns 401 when unauthenticated', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/tenant/acme/accounts/magic-link',
        { method: 'POST' }
      );
      const res = await generateMagicLink(req, {
        params: Promise.resolve({ subdomain: 'acme' }),
      });

      expect(res.status).toBe(401);
    });

    it('returns 403 on tenant subdomain mismatch', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/tenant/other-tenant/accounts/magic-link',
        {
          method: 'POST',
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await generateMagicLink(req, {
        params: Promise.resolve({ subdomain: 'other-tenant' }),
      });

      expect(res.status).toBe(403);
    });

    it('generates 15-minute signed magic link url on valid session', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/tenant/acme/accounts/magic-link',
        {
          method: 'POST',
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await generateMagicLink(req, {
        params: Promise.resolve({ subdomain: 'acme' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.magicUrl).toContain('http://localhost:3000/connect/facebook?token=');
      expect(data.expiresInSeconds).toBe(900);
      expect(data.expiresAt).toBeDefined();
    });
  });

  describe('GET /connect/facebook (Magic Link Forwarder)', () => {
    it('redirects to error page when token is missing', async () => {
      const req = new NextRequest('http://localhost:3000/connect/facebook');
      const res = await forwardMagicLink(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://localhost:3000/connect/facebook/error?reason=missing_token'
      );
    });

    it('redirects to error page when token is invalid or expired', async () => {
      const req = new NextRequest(
        'http://localhost:3000/connect/facebook?token=invalid.token.signature'
      );
      const res = await forwardMagicLink(req);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://localhost:3000/connect/facebook/error?reason=expired_or_invalid'
      );
    });

    it('redirects to Facebook OAuth dialog with isMagic=true in signed state', async () => {
      const now = Math.floor(Date.now() / 1000);
      const magicToken = await signMagicLinkToken(
        {
          tenantSubdomain: 'acme',
          userId,
          nonce: 'test_nonce_12345678',
          iat: now,
          exp: now + 900,
        },
        TEST_SECRET
      );

      const req = new NextRequest(
        `http://localhost:3000/connect/facebook?token=${magicToken}`
      );
      const res = await forwardMagicLink(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toBeDefined();

      const url = new URL(location!);
      expect(url.origin).toBe('https://www.facebook.com');
      expect(url.pathname).toBe('/v26.0/dialog/oauth');

      const state = url.searchParams.get('state');
      expect(state).toBeDefined();

      const statePayload = await verifyOAuthState(state!, TEST_SECRET);
      expect(statePayload.tenantSubdomain).toBe('acme');
      expect(statePayload.userId).toBe(userId);
      expect(statePayload.isMagic).toBe(true);
    });
  });

  describe('OAuth Callback with isMagic Flag', () => {
    it('redirects to /connect/facebook/success when isMagic is true', async () => {
      const now = Math.floor(Date.now() / 1000);
      const state = await signOAuthState(
        {
          tenantSubdomain: 'acme',
          userId,
          nonce: 'test_nonce_12345678',
          iat: now,
          exp: now + 600,
          isMagic: true,
        },
        TEST_SECRET
      );

      // Mock Graph API token exchange
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'mock_short_token_123',
            token_type: 'bearer',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'mock_long_token_456',
            token_type: 'bearer',
            expires_in: 5184000,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'fb_user_magic_999',
            name: 'Magic User',
            gender: 'female',
            link: 'https://facebook.com/magicuser',
            picture: {
              data: {
                url: 'https://graph.facebook.com/v26.0/magic/picture',
              },
            },
          }),
        });

      const mockDb: DatabaseClient = {
        query: vi.fn().mockResolvedValue([{ id: 'mock-account-uuid' }]),
      } as unknown as DatabaseClient;

      const req = new NextRequest(
        `http://localhost:3000/api/auth/facebook/callback?code=mock_code&state=${state}`
      );
      const res = await handleFacebookCallback(req, mockDb);

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        'http://localhost:3000/connect/facebook/success'
      );
    });
  });
});
