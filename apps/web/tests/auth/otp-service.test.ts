import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  generateSecureOtp,
  constantTimeEquals,
  createPendingSignup,
  verifySignupOtp,
  resendSignupOtp,
  findPendingSignup,
  verifyPendingSignupPassword,
  createPasswordResetOtp,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  getPendingSignup,
  INVALID_OTP_ERROR,
  _resetOtpStore,
} from '../../src/lib/otp-service';
import { _resetRateLimiter } from '../../src/lib/rate-limiter';

describe('OTP Service (Spec 014 Hardened)', () => {
  beforeEach(() => {
    _resetOtpStore();
    _resetRateLimiter();
  });

  it('generates a 6-digit numeric OTP', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateSecureOtp();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });

  it('evaluates string equality in constant time', () => {
    expect(constantTimeEquals('123456', '123456')).toBe(true);
    expect(constantTimeEquals('123456', '654321')).toBe(false);
    expect(constantTimeEquals('123456', '12345')).toBe(false);
  });

  it('creates and verifies pending signup successfully with Gmail canonicalization', async () => {
    const signupData = {
      name: 'Sarah Connor',
      phone: '+14155552671',
      email: 'Sarah.Connor+resistance@gmail.com',
      password: 'SecurePassword123!',
    };

    const { otp, expiresAt } = await createPendingSignup(signupData);
    expect(otp).toHaveLength(6);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Verify using unaliased canonical email
    const result = await verifySignupOtp('sarahconnor@gmail.com', otp);
    expect(result.success).toBe(true);
    expect(result.signupData).toBeDefined();
    expect(result.signupData?.name).toBe('Sarah Connor');
    expect(result.signupData?.email).toBe('sarahconnor@gmail.com');

    // Immediate second attempt with same OTP must fail (single-use consumption)
    const secondAttempt = await verifySignupOtp('sarahconnor@gmail.com', otp);
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.error).toContain('No pending registration found');
  });

  it('rejects incorrect OTP with the unified error (no attempt-count oracle)', async () => {
    const signupData = {
      name: 'John Connor',
      phone: '+14155552671',
      email: 'john.connor@gmail.com',
      password: 'SecurePassword123!',
    };

    await createPendingSignup(signupData);

    const badResult = await verifySignupOtp('johnconnor@gmail.com', '000000');
    expect(badResult.success).toBe(false);
    // Byte-identical to every other failed code check (spec 139 B2): the
    // response must not leak how many attempts remain.
    expect(badResult.error).toBe(INVALID_OTP_ERROR);
    expect(badResult.error).not.toContain('remaining');
    expect(badResult.error).not.toContain('locked');
  });

  it('locks out verification after 5 failed attempts, with responses identical to a wrong code', async () => {
    const signupData = {
      name: 'John Connor',
      phone: '+14155552671',
      email: 'john.lockout@gmail.com',
      password: 'SecurePassword123!',
    };

    await createPendingSignup(signupData);

    let firstError: string | undefined;
    for (let i = 0; i < 4; i++) {
      const res = await verifySignupOtp('johnlockout@gmail.com', '000000');
      expect(res.success).toBe(false);
      firstError ??= res.error;
    }

    // 5th attempt triggers lockout — same bytes as any wrong code
    const finalRes = await verifySignupOtp('johnlockout@gmail.com', '000000');
    expect(finalRes.success).toBe(false);
    expect(finalRes.error).toBe(INVALID_OTP_ERROR);
    expect(finalRes.error).toBe(firstError);

    // Subsequent attempt while locked — still the identical bytes, even
    // though this submits a (different) well-formed code
    const lockedRes = await verifySignupOtp('johnlockout@gmail.com', '123456');
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.error).toBe(INVALID_OTP_ERROR);
    expect(lockedRes.error).toBe(finalRes.error);
  });

  it('enforces 60-second cooldown on resend', async () => {
    const signupData = {
      name: 'Kyle Reese',
      phone: '+14155552671',
      email: 'kyle.reese@gmail.com',
      password: 'SecurePassword123!',
    };

    await createPendingSignup(signupData);

    // Immediate resend should fail due to cooldown
    const earlyResend = await resendSignupOtp('kylereese@gmail.com');
    expect(earlyResend.success).toBe(false);
    expect(earlyResend.cooldownSecondsRemaining).toBeGreaterThan(0);
    expect(earlyResend.error).toContain('Please wait');
  });

  it('resets rate-limiter failure attempts upon legitimate OTP resend (ISSUE-36)', async () => {
    const signupData = {
      name: 'Resend Sync User',
      phone: '+14155552671',
      email: 'resend.sync@gmail.com',
      password: 'SecurePassword123!',
    };

    await createPendingSignup(signupData);

    // Fail 4 times (1 attempt remaining before lockout)
    for (let i = 0; i < 4; i++) {
      const res = await verifySignupOtp('resendsync@gmail.com', '000000');
      expect(res.success).toBe(false);
      expect(res.error).toBe(INVALID_OTP_ERROR);
    }

    // Fast-forward cooldown to allow resend
    const entry = getPendingSignup('resendsync@gmail.com');
    expect(entry).not.toBeNull();
    if (entry) {
      entry.lastSentAt = Date.now() - 65 * 1000;
    }

    // Legitimate user requests fresh OTP
    const resendResult = await resendSignupOtp('resendsync@gmail.com');
    expect(resendResult.success).toBe(true);
    expect(resendResult.otp).toBeDefined();

    // Now, a single typo on the newly issued OTP must NOT trigger immediate
    // lockout: the resend cleared the failure counter, so the user has a
    // full clean slate of attempts on the new code.
    const typoResult = await verifySignupOtp('resendsync@gmail.com', '999999');
    expect(typoResult.success).toBe(false);
    expect(typoResult.error).toBe(INVALID_OTP_ERROR);

    // Proof the typo did not lock: the fresh code still verifies.
    const okResult = await verifySignupOtp('resendsync@gmail.com', resendResult.otp as string);
    expect(okResult.success).toBe(true);
  });

  it('returns friendly error when verifying nonexistent or expired registration', async () => {
    const result = await verifySignupOtp('nonexistent@gmail.com', '123456');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No pending registration found');
  });

  it('correctly finds pending signup and verifies password against pre-hashed staged record', async () => {
    const signupData = {
      name: 'Elena Fisher',
      phone: '+14155552671',
      email: 'elena.fisher+uncharted@gmail.com',
      password: 'StrongPassword123!',
    };

    await createPendingSignup(signupData);

    const pending = findPendingSignup('elenafisher@gmail.com');
    expect(pending).not.toBeNull();
    expect(pending?.data.name).toBe('Elena Fisher');

    // Valid password check
    const isCorrect = await verifyPendingSignupPassword('elenafisher@gmail.com', 'StrongPassword123!');
    expect(isCorrect).toBe(true);

    // Invalid password check
    const isIncorrect = await verifyPendingSignupPassword('elenafisher@gmail.com', 'WrongPassword123!');
    expect(isIncorrect).toBe(false);

    // Non-existent email check
    const nonExistent = await verifyPendingSignupPassword('nonexistent@gmail.com', 'Password123!');
    expect(nonExistent).toBe(false);
  });


  describe('Lockout Enforcement on Creation & Refresh (ISSUE-35)', () => {
    it.each([
      {
        type: 'signup',
        email: 'locked.signup@gmail.com',
        init: (email: string) =>
          createPendingSignup({
            name: 'Locked User',
            phone: '+14155552671',
            email,
            password: 'Password123!',
          }),
        verifyBad: (email: string) => verifySignupOtp(email, '000000'),
        attemptRecreate: (email: string) =>
          createPendingSignup({
            name: 'Locked User',
            phone: '+14155552671',
            email,
            password: 'Password123!',
          }),
      },
      {
        type: 'reset',
        email: 'locked.resettester@gmail.com',
        init: (email: string) => createPasswordResetOtp(email),
        verifyBad: (email: string) => verifyPasswordResetOtp(email, '000000'),
        attemptRecreate: (email: string) => createPasswordResetOtp(email),
      },
    ])('blocks new OTP generation when $type email is locked out', async ({ email, init, verifyBad, attemptRecreate }) => {
      await init(email);

      for (let i = 0; i < 5; i++) {
        await verifyBad(email);
      }

      await expect(attemptRecreate(email)).rejects.toThrow(/locked/i);
    });

  });

  describe('Cryptographic Uniformity & Strict OTP Format Validation (ISSUE-38)', () => {
    it('generates OTPs using crypto.randomInt without modulo bias', () => {
      const spy = vi.spyOn(crypto, 'randomInt');
      const otp = generateSecureOtp();
      expect(spy).toHaveBeenCalledWith(100000, 1000000);
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      spy.mockRestore();
    });

    it('strictly rejects non-6-digit or malformed OTP inputs for signup verification without silent coercion', async () => {
      const email = 'strict.otp@gmail.com';
      await createPendingSignup({
        name: 'Strict User',
        phone: '+14155552671',
        email,
        password: 'Password123!',
      });

      // Characters interspersed, letters, spaces, wrong length
      const malformedInputs = [
        '12 34 56',
        '12345a',
        '12-34-56',
        '12345',
        '1234567',
        'abc123',
        '',
      ];

      for (const input of malformedInputs) {
        const res = await verifySignupOtp(email, input);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/must be exactly 6 digits/i);
      }
    });

    it('strictly rejects non-6-digit or malformed OTP inputs for password reset verification without silent coercion', async () => {
      const email = 'strict.reset@gmail.com';
      await createPasswordResetOtp(email);

      const malformedInputs = [
        '12 34 56',
        '12345a',
        '12-34-56',
        '12345',
        '1234567',
        'abc123',
        '',
      ];

      for (const input of malformedInputs) {
        const res = await verifyPasswordResetOtp(email, input);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/must be exactly 6 digits/i);
      }
    });
  });
});
