import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  recordFailedAttempt,
  isLockedOut,
  clearLockout,
  extractClientIp,
  _resetRateLimiter,
} from '../../src/lib/rate-limiter';

describe('Rate Limiter & Abuse Shield (Spec 014)', () => {
  beforeEach(() => {
    _resetRateLimiter();
  });

  describe('checkRateLimit', () => {
    it('allows requests within limit and tracks remaining quota', async () => {
      const res1 = await checkRateLimit('ip:1.2.3.4', 3, 60000);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);

      const res2 = await checkRateLimit('ip:1.2.3.4', 3, 60000);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = await checkRateLimit('ip:1.2.3.4', 3, 60000);
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);

      // Exceeded
      const res4 = await checkRateLimit('ip:1.2.3.4', 3, 60000);
      expect(res4.allowed).toBe(false);
      expect(res4.remaining).toBe(0);
      expect(res4.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('isolates different keys independently', async () => {
      await checkRateLimit('key:A', 1, 60000);
      const resA = await checkRateLimit('key:A', 1, 60000);
      expect(resA.allowed).toBe(false);

      const resB = await checkRateLimit('key:B', 1, 60000);
      expect(resB.allowed).toBe(true);
    });
  });

  describe('recordFailedAttempt and lockout', () => {
    it('tracks attempts and triggers lockout after threshold', async () => {
      const key = 'user:testuser@gmail.com';
      expect(isLockedOut(key).locked).toBe(false);

      for (let i = 1; i <= 4; i++) {
        const attempt = recordFailedAttempt(key, 5, 60000);
        expect(attempt.locked).toBe(false);
        expect(attempt.remainingAttempts).toBe(5 - i);
      }

      // 5th attempt locks out
      const fifth = recordFailedAttempt(key, 5, 60000);
      expect(fifth.locked).toBe(true);
      expect(fifth.remainingAttempts).toBe(0);
      expect(fifth.retryAfterSeconds).toBeGreaterThan(0);

      expect(isLockedOut(key).locked).toBe(true);

      // Clearing lockout restores access
      clearLockout(key);
      expect(isLockedOut(key).locked).toBe(false);
    });
  });

  describe('extractClientIp', () => {
    it('prioritizes trusted platform header x-vercel-forwarded-for over spoofed x-forwarded-for', async () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '1.1.1.1, 2.2.2.2');
      headers.set('x-vercel-forwarded-for', '203.0.113.195');
      expect(extractClientIp(headers)).toBe('203.0.113.195');
    });

    it('prioritizes cf-connecting-ip over spoofed x-forwarded-for', async () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '1.1.1.1, 2.2.2.2');
      headers.set('cf-connecting-ip', '198.51.100.4');
      expect(extractClientIp(headers)).toBe('198.51.100.4');
    });

    it('prioritizes x-real-ip over spoofed x-forwarded-for', async () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '1.1.1.1, 2.2.2.2');
      headers.set('x-real-ip', '198.51.100.5');
      expect(extractClientIp(headers)).toBe('198.51.100.5');
    });

    it('extracts rightmost client IP when only x-forwarded-for is present to prevent leftmost client spoofing', async () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', 'spoofed.ip.address, 203.0.113.195');
      expect(extractClientIp(headers)).toBe('203.0.113.195');
    });

    it('falls back to 127.0.0.1 when no IP headers are present', async () => {
      expect(extractClientIp(new Headers())).toBe('127.0.0.1');
    });
  });

  describe('validateRateLimiterConfig in production', () => {
    const originalEnv = process.env;

    it('throws in production when Upstash Redis credentials are missing', async () => {
      process.env = { ...originalEnv, NODE_ENV: 'production' };
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const { validateRateLimiterConfig } = await import('../../src/lib/rate-limiter');
      expect(() => validateRateLimiterConfig()).toThrow(
        /Upstash Redis credentials .* are strictly required/
      );
      process.env = originalEnv;
    });

    it('passes in production when Upstash Redis credentials are present', async () => {
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'valid_token',
      };

      const { validateRateLimiterConfig } = await import('../../src/lib/rate-limiter');
      expect(() => validateRateLimiterConfig()).not.toThrow();
      process.env = originalEnv;
    });

    it('denies (fail-closed) checkRateLimit in production when Upstash Redis is unreachable', async () => {
      process.env = { ...originalEnv, NODE_ENV: 'production' };
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      // Fail-closed: missing/unreachable Redis denies the request rather
      // than silently allowing unlimited attempts.
      const res = await checkRateLimit('prod-user:1.2.3.4', 5, 60000);
      expect(res.allowed).toBe(false);
      expect(res.retryAfterSeconds).toBeGreaterThan(0);

      process.env = originalEnv;
    });
  });
});

