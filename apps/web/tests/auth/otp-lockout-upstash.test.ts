import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Spec 139 B2 — OTP lockout in production mode.
 *
 * The lockout trio (isLockedOut / recordFailedAttempt / clearLockout) must
 * be backed by Upstash Redis in production — the old per-instance Map let
 * an attacker spread guesses across Vercel instances — and must fail
 * CLOSED on any Redis error. These tests run the production code path
 * against an in-memory fake of the @upstash/redis client.
 */

const fakeHashes = new Map<string, Record<string, string>>();
const fakeExpiry = new Map<string, number>();
let redisShouldFail = false;

function throwIfFailing(): void {
  if (redisShouldFail) {
    throw new Error('fake redis: connection refused');
  }
}

vi.mock('@upstash/redis', () => ({
  Redis: class FakeRedis {
    async hgetall(key: string): Promise<Record<string, string> | null> {
      throwIfFailing();
      return fakeHashes.get(key) ?? null;
    }

    async hset(
      key: string,
      values: Record<string, number>
    ): Promise<number> {
      throwIfFailing();
      const existing = fakeHashes.get(key) ?? {};
      for (const [field, value] of Object.entries(values)) {
        existing[field] = String(value);
      }
      fakeHashes.set(key, existing);
      return Object.keys(values).length;
    }

    async expire(key: string, seconds: number): Promise<number> {
      throwIfFailing();
      fakeExpiry.set(key, seconds);
      return 1;
    }

    async del(key: string): Promise<number> {
      throwIfFailing();
      fakeExpiry.delete(key);
      return fakeHashes.delete(key) ? 1 : 0;
    }
  },
}));

const ORIGINAL_ENV = { ...process.env };

async function importFreshModules(): Promise<{
  rateLimiter: typeof import('../../src/lib/rate-limiter');
  otpService: typeof import('../../src/lib/otp-service');
}> {
  vi.resetModules();
  const rateLimiter = await import('../../src/lib/rate-limiter');
  const otpService = await import('../../src/lib/otp-service');
  return { rateLimiter, otpService };
}

describe('OTP lockout — production Upstash path (spec 139 B2)', () => {
  beforeEach(() => {
    fakeHashes.clear();
    fakeExpiry.clear();
    redisShouldFail = false;
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://fake-upstash.example.com',
      UPSTASH_REDIS_REST_TOKEN: 'fake-token',
      NEXT_PUBLIC_SUPABASE_URL: 'https://xyz.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'valid-anon-key',
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('counts failed attempts in Redis and decrements remaining attempts', async () => {
    const { rateLimiter } = await importFreshModules();
    const key = 'counter@gmail.com';

    const first = await rateLimiter.recordFailedAttempt(key, 5, 15 * 60 * 1000);
    expect(first).toEqual({
      locked: false,
      attempts: 1,
      remainingAttempts: 4,
      retryAfterSeconds: 0,
    });

    const second = await rateLimiter.recordFailedAttempt(key, 5, 15 * 60 * 1000);
    expect(second.attempts).toBe(2);
    expect(second.remainingAttempts).toBe(3);
    expect(second.locked).toBe(false);

    // State really lives under the shared lockout key, not in this process
    expect(fakeHashes.get('fbuploadpro:lockout:counter@gmail.com')).toEqual({
      attempts: '2',
      lockedUntil: '0',
    });
    expect(await rateLimiter.isLockedOut(key)).toEqual({
      locked: false,
      retryAfterSeconds: 0,
    });
  });

  it('engages a 15-minute lockout on the 5th failed attempt', async () => {
    const { rateLimiter } = await importFreshModules();
    const key = 'victim@gmail.com';

    for (let i = 0; i < 4; i++) {
      const res = await rateLimiter.recordFailedAttempt(key, 5, 15 * 60 * 1000);
      expect(res.locked).toBe(false);
    }

    const fifth = await rateLimiter.recordFailedAttempt(key, 5, 15 * 60 * 1000);
    expect(fifth.locked).toBe(true);
    expect(fifth.remainingAttempts).toBe(0);
    expect(fifth.retryAfterSeconds).toBe(900);

    const status = await rateLimiter.isLockedOut(key);
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
    expect(status.retryAfterSeconds).toBeLessThanOrEqual(900);

    // The entry expires with the lockout window
    expect(fakeExpiry.get('fbuploadpro:lockout:victim@gmail.com')).toBe(900);
  });

  it('a successful verification clears the counter (clearLockout)', async () => {
    const { rateLimiter } = await importFreshModules();
    const key = 'redeemed@gmail.com';

    for (let i = 0; i < 4; i++) {
      await rateLimiter.recordFailedAttempt(key, 5, 15 * 60 * 1000);
    }
    await rateLimiter.clearLockout(key);

    expect(fakeHashes.has('fbuploadpro:lockout:redeemed@gmail.com')).toBe(false);
    expect((await rateLimiter.isLockedOut(key)).locked).toBe(false);

    // The next failure starts a fresh count — no lockout
    const after = await rateLimiter.recordFailedAttempt(key, 5, 15 * 60 * 1000);
    expect(after.locked).toBe(false);
    expect(after.attempts).toBe(1);
    expect(after.remainingAttempts).toBe(4);
  });

  it('fails closed on Redis error: checks and records both deny', async () => {
    const { rateLimiter } = await importFreshModules();
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    redisShouldFail = true;

    const status = await rateLimiter.isLockedOut('anyone@gmail.com');
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);

    const recorded = await rateLimiter.recordFailedAttempt('anyone@gmail.com', 5, 15 * 60 * 1000);
    expect(recorded.locked).toBe(true);
    expect(recorded.remainingAttempts).toBe(0);

    // Failures are logged, never silently swallowed
    expect(errorSpy).toHaveBeenCalled();
  });

  it('end-to-end via otp-service: 5 wrong codes lock, locked response is byte-identical, success clears', async () => {
    const { otpService } = await importFreshModules();
    const email = 'e2e.lockout@gmail.com';

    const { otp } = await otpService.createPendingSignup({
      name: 'E2E User',
      phone: '+14155552671',
      email,
      password: 'SecurePassword123!',
    });

    const wrong = await otpService.verifySignupOtp(email, '000000');
    expect(wrong.success).toBe(false);
    expect(wrong.error).toBe(otpService.INVALID_OTP_ERROR);

    for (let i = 0; i < 3; i++) {
      const res = await otpService.verifySignupOtp(email, '000000');
      expect(res.error).toBe(wrong.error);
    }

    // 5th wrong code engages the lockout — identical bytes
    const fifth = await otpService.verifySignupOtp(email, '000000');
    expect(fifth.success).toBe(false);
    expect(fifth.error).toBe(wrong.error);

    // Even the CORRECT code is refused while locked, with identical bytes
    // (the pending entry was consumed by the lockout; no oracle either way)
    const lockedAttempt = await otpService.verifySignupOtp(email, otp);
    expect(lockedAttempt.success).toBe(false);
    expect(lockedAttempt.error).toBe(wrong.error);

    // The lockout is in Redis, shared across instances. (Key = the
    // canonical Gmail address: dots are stripped by canonicalization.)
    expect(
      fakeHashes.get('fbuploadpro:lockout:e2elockout@gmail.com')?.attempts
    ).toBe('5');
  });

  it('end-to-end via otp-service: success after failures clears the Redis counter', async () => {
    const { otpService } = await importFreshModules();
    const email = 'e2e.clear@gmail.com';

    const { otp } = await otpService.createPendingSignup({
      name: 'E2E Clear',
      phone: '+14155552671',
      email,
      password: 'SecurePassword123!',
    });

    await otpService.verifySignupOtp(email, '000000');
    await otpService.verifySignupOtp(email, '000000');
    expect(
      fakeHashes.get('fbuploadpro:lockout:e2eclear@gmail.com')?.attempts
    ).toBe('2');

    const ok = await otpService.verifySignupOtp(email, otp);
    expect(ok.success).toBe(true);
    expect(fakeHashes.has('fbuploadpro:lockout:e2eclear@gmail.com')).toBe(
      false
    );
  });
});
