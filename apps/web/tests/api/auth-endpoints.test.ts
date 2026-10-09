import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleSignup } from '../../src/app/api/auth/signup/route';
import { POST as handleVerifyOtp } from '../../src/app/api/auth/signup/verify-otp/route';
import { POST as handleLogin } from '../../src/app/api/auth/login/route';
import { POST as handleLogout } from '../../src/app/api/auth/logout/route';
import { GET as handleMe } from '../../src/app/api/auth/me/route';
import * as dbModule from '../../src/lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';
import { getPendingSignup, _resetOtpStore } from '../../src/lib/otp-service';
import { _resetRateLimiter } from '../../src/lib/rate-limiter';

describe('Auth API Endpoints (Spec 009 & 014 Hardened)', () => {
  const testUserId = '11111111-1111-4111-a111-111111111111';

  beforeEach(() => {
    vi.restoreAllMocks();
    _resetOtpStore();
    _resetRateLimiter();
    process.env.SESSION_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
    process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock_db';
  });

  describe('POST /api/auth/signup', () => {
    it('creates new tenant user, derives subdomain stripping dots and tags, and sets session cookie', async () => {
      const mockDb: Partial<DatabaseClient> = {
        queryOne: vi.fn()
          // Step 1: handleSignup findUserByEmail -> null
          .mockResolvedValueOnce(null)
          // Step 2: registerTenantUser findUserByEmail -> null
          .mockResolvedValueOnce(null)
          // Step 2: resolveUniqueSubdomain check if 'johndoe' exists -> null
          .mockResolvedValueOnce(null)
          // Step 2: RETURNING inserted user
          .mockResolvedValueOnce({
            id: testUserId,
            email: 'johndoe@gmail.com',
            name: 'John Doe',
            phone: '+14155552671',
            subdomain: 'johndoe',
            role: 'user',
            status: 'active',
          }),
        query: vi.fn().mockResolvedValue([]),
      };

      vi.spyOn(dbModule, 'getDbClient').mockReturnValue(mockDb as DatabaseClient);

      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'John Doe',
          phone: '+14155552671',
          email: 'john.doe+reels@gmail.com',
          password: 'Password123!',
        }),
      });

      const res = await handleSignup(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.requiresOtp).toBe(true);

      const pending = getPendingSignup('johndoe@gmail.com');
      expect(pending).not.toBeNull();

      const verifyReq = new NextRequest('http://localhost:3000/api/auth/signup/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'johndoe@gmail.com',
          otp: pending!.otp,
        }),
      });

      const verifyRes = await handleVerifyOtp(verifyReq);
      expect(verifyRes.status).toBe(201);

      const verifyJson = await verifyRes.json();
      expect(verifyJson.success).toBe(true);
      expect(verifyJson.user.subdomain).toBe('johndoe');
      expect(verifyJson.redirectUrl).toBe('http://johndoe.localhost:3000/dashboard');

      const setCookie = verifyRes.headers.get('set-cookie');
      expect(setCookie).toContain('fbup_session=');
    });

    it('rejects invalid inputs with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          email: 'not-an-email',
          password: 'short',
        }),
      });

      const res = await handleSignup(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe('Validation failed');
    });

    it('returns 409 Conflict when email is already registered', async () => {
      const mockDb: Partial<DatabaseClient> = {
        queryOne: vi.fn().mockResolvedValueOnce({ id: testUserId }),
      };

      vi.spyOn(dbModule, 'getDbClient').mockReturnValue(mockDb as DatabaseClient);

      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'John Doe',
          phone: '+14155552671',
          email: 'existing@gmail.com',
          password: 'Password123!',
        }),
      });

      const res = await handleSignup(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error).toBe('Email is already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates valid user and returns redirect URL', async () => {
      const mockDb: Partial<DatabaseClient> = {
        queryOne: vi.fn().mockResolvedValueOnce({
          id: testUserId,
          email: 'active@gmail.com',
          name: 'Active User',
          phone: '+14155552671',
          subdomain: 'activecorp',
          role: 'user',
          status: 'active',
        }),
      };

      vi.spyOn(dbModule, 'getDbClient').mockReturnValue(mockDb as DatabaseClient);

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'active@gmail.com',
          password: 'Password123!',
          returnUrl: '/publishing',
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.subdomain).toBe('activecorp');
      expect(json.redirectUrl).toBe('http://activecorp.localhost:3000/publishing');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('fbup_session=');
    });

    it('returns 403 Forbidden with account-suspended redirectUrl when account is suspended', async () => {
      const mockDb: Partial<DatabaseClient> = {
        queryOne: vi.fn().mockResolvedValueOnce({
          id: testUserId,
          email: 'suspended@gmail.com',
          name: 'Suspended User',
          phone: null,
          subdomain: 'bannedcorp',
          role: 'user',
          status: 'suspended',
        }),
      };

      vi.spyOn(dbModule, 'getDbClient').mockReturnValue(mockDb as DatabaseClient);

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'suspended@gmail.com',
          password: 'Password123!',
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toBe('Account is suspended');
      expect(json.redirectUrl).toBe('/account-suspended');
    });

    it('returns 401 Unauthorized when user is not found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        queryOne: vi.fn().mockResolvedValueOnce(null),
      };

      vi.spyOn(dbModule, 'getDbClient').mockReturnValue(mockDb as DatabaseClient);

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'unknown@gmail.com',
          password: 'Password123!',
        }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toBe('Invalid email or password');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('expires fbup_session cookie and redirects to /login', async () => {
      const res = await handleLogout();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.redirectUrl).toBe('/login');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('Max-Age=0');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await handleMe();
      expect(res.status).toBe(401);
    });
  });
});
