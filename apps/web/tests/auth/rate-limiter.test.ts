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
    it('allows requests within limit and tracks remaining quota', () => {
      const res1 = checkRateLimit('ip:1.2.3.4', 3, 60000);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);

      const res2 = checkRateLimit('ip:1.2.3.4', 3, 60000);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      const res3 = checkRateLimit('ip:1.2.3.4', 3, 60000);
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);

      // Exceeded
      const res4 = checkRateLimit('ip:1.2.3.4', 3, 60000);
      expect(res4.allowed).toBe(false);
      expect(res4.remaining).toBe(0);
      expect(res4.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('isolates different keys independently', () => {
      checkRateLimit('key:A', 1, 60000);
      const resA = checkRateLimit('key:A', 1, 60000);
      expect(resA.allowed).toBe(false);

      const resB = checkRateLimit('key:B', 1, 60000);
      expect(resB.allowed).toBe(true);
    });
  });

  describe('recordFailedAttempt and lockout', () => {
    it('tracks attempts and triggers lockout after threshold', () => {
      const key = 'user:test@gmail.com';
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
    it('extracts ip from x-forwarded-for header', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18');
      expect(extractClientIp(headers)).toBe('203.0.113.195');
    });

    it('extracts ip from cf-connecting-ip or fallback', () => {
      const headers = new Headers();
      headers.set('cf-connecting-ip', '198.51.100.4');
      expect(extractClientIp(headers)).toBe('198.51.100.4');

      expect(extractClientIp(new Headers())).toBe('127.0.0.1');
    });
  });
});
