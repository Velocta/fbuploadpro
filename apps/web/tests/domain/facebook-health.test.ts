import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  evaluateGraphApiError,
  evaluateTokenExpiry,
  evaluateAccountHealth,
  signSessionToken,
} from '@fbuploadpro/contracts';
import { handleListAccounts } from '../../src/app/api/tenant/[subdomain]/accounts/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Facebook Multi-Account Health Monitoring & Expiration (User Story 3 - T066/T067)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
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

  describe('Graph API Error Evaluation (T067)', () => {
    it('maps OAuth error 190 subcodes 458, 460, 463 to expired/invalid_token and requires re-auth', () => {
      // Subcode 458: App revoked
      const revoked = evaluateGraphApiError(190, 458);
      expect(revoked).not.toBeNull();
      expect(revoked?.accountStatus).toBe('expired');
      expect(revoked?.pageStatus).toBe('invalid_token');
      expect(revoked?.isTransient).toBe(false);
      expect(revoked?.requiresReauth).toBe(true);

      // Subcode 460: Password changed
      const pwdChanged = evaluateGraphApiError(190, 460);
      expect(pwdChanged?.accountStatus).toBe('expired');
      expect(pwdChanged?.pageStatus).toBe('invalid_token');
      expect(pwdChanged?.requiresReauth).toBe(true);

      // Subcode 463: Token expired
      const expired = evaluateGraphApiError(190, 463);
      expect(expired?.accountStatus).toBe('expired');
      expect(expired?.pageStatus).toBe('invalid_token');
      expect(expired?.requiresReauth).toBe(true);

      // Generic error 190
      const generic190 = evaluateGraphApiError(190);
      expect(generic190?.accountStatus).toBe('expired');
      expect(generic190?.pageStatus).toBe('invalid_token');
      expect(generic190?.requiresReauth).toBe(true);
    });

    it('maps rate limit codes 4, 17, 32, 613 to fb_rate_limited as transient errors without re-auth', () => {
      for (const code of [4, 17, 32, 613]) {
        const rateLimit = evaluateGraphApiError(code);
        expect(rateLimit).not.toBeNull();
        expect(rateLimit?.accountStatus).toBe('active');
        expect(rateLimit?.pageStatus).toBe('fb_rate_limited');
        expect(rateLimit?.isTransient).toBe(true);
        expect(rateLimit?.requiresReauth).toBe(false);
      }
    });

    it('returns null for unrecognized non-OAuth error codes', () => {
      expect(evaluateGraphApiError(500)).toBeNull();
      expect(evaluateGraphApiError(1)).toBeNull();
    });
  });

  describe('Token Expiration Horizons (T067)', () => {
    it('evaluates future expiration horizons as active with days remaining', () => {
      const now = new Date('2026-10-01T12:00:00Z');
      const in30Days = new Date('2026-10-31T12:00:00Z');

      const evaluation = evaluateTokenExpiry(in30Days, now);
      expect(evaluation.isExpired).toBe(false);
      expect(evaluation.status).toBe('active');
      expect(evaluation.daysRemaining).toBe(30);

      const health = evaluateAccountHealth(
        { status: 'active', tokenExpiresAt: in30Days },
        now
      );
      expect(health).toBe('active');
    });

    it('evaluates past expiration horizons as expired with zero days remaining', () => {
      const now = new Date('2026-10-01T12:00:00Z');
      const inPast = new Date('2026-09-15T12:00:00Z');

      const evaluation = evaluateTokenExpiry(inPast, now);
      expect(evaluation.isExpired).toBe(true);
      expect(evaluation.status).toBe('expired');
      expect(evaluation.daysRemaining).toBe(0);

      const health = evaluateAccountHealth(
        { status: 'active', tokenExpiresAt: inPast },
        now
      );
      expect(health).toBe('expired');
    });

    it('preserves disconnected status even if token expiration is in future', () => {
      const now = new Date('2026-10-01T12:00:00Z');
      const inFuture = new Date('2026-11-01T12:00:00Z');

      const health = evaluateAccountHealth(
        { status: 'disconnected', tokenExpiresAt: inFuture },
        now
      );
      expect(health).toBe('disconnected');
    });
  });

  describe('List Connected Accounts Endpoint (GET /api/tenant/[subdomain]/accounts - T068)', () => {
    it('returns sanitized multi-account listing with connected page counts and dynamic health status', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();
      const futureDate = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 30
      ).toISOString();

      const mockDb = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM facebook_accounts')) {
            return Promise.resolve([
              {
                id: '22222222-2222-4222-a222-222222222222',
                fbAccountId: 'fb_act_active',
                displayName: 'Active Creator Account',
                profile_picture_url:
                  'https://platform-lookaside.fbsbx.com/platform/profilepic/creator.jpg',
                gender: 'female',
                account_link:
                  'https://www.facebook.com/app_scoped_user_id/fb_act_active/',
                status: 'active',
                tokenExpiresAt: futureDate,
                connectedPagesCount: 2,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: '33333333-3333-4333-a333-333333333333',
                fbAccountId: 'fb_act_expired',
                displayName: 'Expired Client Account',
                status: 'active', // Raw status in DB is active, but token is past
                tokenExpiresAt: pastDate,
                connectedPagesCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      const req = new NextRequest(
        'http://localhost:3000/api/tenant/acme/accounts',
        { headers: { cookie: validSessionCookie } }
      );

      const res = await handleListAccounts(req, 'acme', mockDb);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.total).toBe(2);
      expect(json.accounts).toHaveLength(2);

      const activeAcc = json.accounts.find(
        (a: { id: string }) => a.id === '22222222-2222-4222-a222-222222222222'
      );
      const expiredAcc = json.accounts.find(
        (a: { id: string }) => a.id === '33333333-3333-4333-a333-333333333333'
      );

      expect(activeAcc.status).toBe('active');
      expect(activeAcc.connectedPagesCount).toBe(2);
      expect(activeAcc.profilePictureUrl).toBe(
        'https://platform-lookaside.fbsbx.com/platform/profilepic/creator.jpg'
      );
      expect(activeAcc.gender).toBe('female');
      expect(activeAcc.accountLink).toBe(
        'https://www.facebook.com/app_scoped_user_id/fb_act_active/'
      );

      expect(expiredAcc.status).toBe('expired'); // Evaluated to expired
      expect(expiredAcc.connectedPagesCount).toBe(1);
      expect(expiredAcc.profilePictureUrl).toBeNull();
      expect(expiredAcc.gender).toBeNull();
      expect(expiredAcc.accountLink).toBeNull();

      // Zero token exposure assertion
      const rawString = JSON.stringify(json);
      expect(rawString).not.toContain('encryptedAccessToken');
      expect(rawString).not.toContain('accessToken');
    });

    it('rejects cross-tenant access when user belongs to different subdomain', async () => {
      const mockDb = {
        query: vi.fn(),
      } as unknown as DatabaseClient;

      const req = new NextRequest(
        'http://localhost:3000/api/tenant/other-tenant/accounts',
        { headers: { cookie: validSessionCookie } }
      );

      const res = await handleListAccounts(req, 'other-tenant', mockDb);
      expect(res.status).toBe(403);
    });
  });
});
