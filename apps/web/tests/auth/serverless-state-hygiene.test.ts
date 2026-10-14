import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { validateOtpServiceConfig, createPendingSignup, getPendingSignup } from '../../src/lib/otp-service';
import { validateInsightsCacheConfig, globalInsightsCache } from '../../src/lib/insights/insights-cache';
import { handleGetInsights } from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route';
import { signSessionToken, encryptToken, type DatabaseClient } from '@fbuploadpro/contracts';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('[ISSUE-25] Serverless State Hygiene & Distributed Cache Enforcement', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('OTP Service Serverless Configuration in Production', () => {
    it('throws in production when Supabase / distributed auth credentials are missing', () => {
      process.env = { ...process.env, NODE_ENV: 'production' };
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => validateOtpServiceConfig()).toThrow(
        /Native Supabase Auth credentials .* are strictly required for authentication and OTP in production/
      );
    });

    it('passes in production when Supabase credentials are configured', () => {
      process.env = {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://xyz.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'valid-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'valid-service-role-key',
      };

      expect(() => validateOtpServiceConfig()).not.toThrow();
    });

    it('warns in production when createPendingSignup fallback is invoked', () => {
      process.env = {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://xyz.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'valid-anon-key',
      };

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createPendingSignup({
        name: 'Test Agent',
        phone: '+14155552671',
        email: 'agent.serverless@gmail.com',
        password: 'ValidPassword123!',
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OTP Service] Fallback in-memory pendingSignup used in production')
      );

      warnSpy.mockRestore();
    });
  });

  describe('Insights Cache Serverless Configuration & SWR Cache-Control', () => {
    it('throws in production when Upstash Redis credentials are missing', () => {
      process.env = { ...process.env, NODE_ENV: 'production' };
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      expect(() => validateInsightsCacheConfig()).toThrow(
        /Upstash Redis credentials .* are strictly required for distributed insights caching in production/
      );
    });

    it('passes in production when Upstash Redis credentials are configured', () => {
      process.env = {
        ...process.env,
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'test-token',
      };

      expect(() => validateInsightsCacheConfig()).not.toThrow();
    });

    it('returns Cache-Control with stale-while-revalidate headers in GET insights response', async () => {
      process.env.SESSION_SECRET = TEST_SECRET;
      process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

      const userId = '11111111-1111-4111-a111-111111111111';
      const pageId = '22222222-2222-4222-a222-222222222222';
      const fbPageId = '846840138502516';

      const token = await signSessionToken(
        {
          userId,
          email: 'alexander@gmail.com',
          name: 'Alex Acme',
          subdomain: 'acme',
          role: 'user',
          status: 'active',
        },
        TEST_SECRET
      );

      const sampleEncryptedPageToken = await encryptToken(
        'mock_raw_fb_page_access_token_secret',
        TEST_ENCRYPTION_KEY
      );

      const mockDb = {
        query: vi.fn().mockResolvedValue([
          {
            id: pageId,
            user_id: userId,
            fb_page_id: fbPageId,
            page_name: 'Viral Cooking Daily',
            encrypted_access_token: sampleEncryptedPageToken,
            status: 'active',
          },
        ]),
      } as unknown as DatabaseClient;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            name: 'Viral Cooking Daily',
            fan_count: 24500,
            followers_count: 28900,
          }),
      });

      const request = new NextRequest(
        `https://acme.fbuploadpro.com/api/tenant/acme/pages/${pageId}/insights?range=28d`,
        {
          headers: {
            cookie: `fbup_session=${token}`,
          },
        }
      );

      const res = await handleGetInsights(request, 'acme', pageId, {
        dbClient: mockDb,
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(res.status).toBe(200);
      const cacheControl = res.headers.get('Cache-Control');
      expect(cacheControl).toBeDefined();
      expect(cacheControl).toContain('s-maxage=900');
      expect(cacheControl).toContain('stale-while-revalidate=86400');
    });

    it('warns when get and set are called in production without Upstash credentials', () => {
      process.env = { ...process.env, NODE_ENV: 'production' };
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      globalInsightsCache.set('test-key', { sample: 123 }, 60);
      const cached = globalInsightsCache.get('test-key');

      expect(cached).not.toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[InsightsCache] Upstash Redis credentials not configured'),
        expect.stringContaining('Upstash Redis credentials')
      );

      warnSpy.mockRestore();
    });

    it('does not warn when get and set are called in production with Upstash credentials configured', () => {
      process.env = {
        ...process.env,
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token-ok',
      };

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      globalInsightsCache.set('prod-key', { sample: 456 }, 60);
      const cached = globalInsightsCache.get('prod-key');

      expect(cached).not.toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('Password Reset OTP Serverless Warning in Production', () => {
    it('warns in production when createPasswordResetOtp fallback is invoked', async () => {
      process.env = {
        ...process.env,
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://xyz.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'valid-anon-key',
      };

      const { createPasswordResetOtp } = await import('../../src/lib/otp-service');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createPasswordResetOtp('reset.agent@gmail.com');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OTP Service] Fallback in-memory pendingPasswordReset used in production')
      );

      warnSpy.mockRestore();
    });
  });
});

