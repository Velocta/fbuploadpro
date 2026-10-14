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
  refreshPendingSignupOtp,
  createPasswordResetOtp,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  getPendingSignup,
  getPendingPasswordReset,
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

  it('creates and verifies pending signup successfully with Gmail canonicalization', () => {
    const signupData = {
      name: 'Sarah Connor',
      phone: '+14155552671',
      email: 'Sarah.Connor+resistance@gmail.com',
      password: 'SecurePassword123!',
    };

    const { otp, expiresAt } = createPendingSignup(signupData);
    expect(otp).toHaveLength(6);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Verify using unaliased canonical email
    const result = verifySignupOtp('sarahconnor@gmail.com', otp);
    expect(result.success).toBe(true);
    expect(result.signupData).toBeDefined();
    expect(result.signupData?.name).toBe('Sarah Connor');
    expect(result.signupData?.email).toBe('sarahconnor@gmail.com');

    // Immediate second attempt with same OTP must fail (single-use consumption)
    const secondAttempt = verifySignupOtp('sarahconnor@gmail.com', otp);
    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.error).toContain('No pending registration found');
  });

  it('rejects incorrect OTP and counts attempts', () => {
    const signupData = {
      name: 'John Connor',
      phone: '+14155552671',
      email: 'john.connor@gmail.com',
      password: 'SecurePassword123!',
    };

    createPendingSignup(signupData);

    const badResult = verifySignupOtp('johnconnor@gmail.com', '000000');
    expect(badResult.success).toBe(false);
    expect(badResult.error).toContain('Invalid verification code');
    expect(badResult.error).toContain('4 attempts remaining');
  });

  it('locks out verification after 5 failed attempts', () => {
    const signupData = {
      name: 'John Connor',
      phone: '+14155552671',
      email: 'john.lockout@gmail.com',
      password: 'SecurePassword123!',
    };

    createPendingSignup(signupData);

    for (let i = 0; i < 4; i++) {
      const res = verifySignupOtp('johnlockout@gmail.com', '000000');
      expect(res.success).toBe(false);
    }

    // 5th attempt triggers lockout
    const finalRes = verifySignupOtp('johnlockout@gmail.com', '000000');
    expect(finalRes.success).toBe(false);
    expect(finalRes.error).toContain('temporarily locked');

    // Subsequent attempt should still be locked out
    const lockedRes = verifySignupOtp('johnlockout@gmail.com', '123456');
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.error).toContain('temporarily locked');
  });

  it('enforces 60-second cooldown on resend', () => {
    const signupData = {
      name: 'Kyle Reese',
      phone: '+14155552671',
      email: 'kyle.reese@gmail.com',
      password: 'SecurePassword123!',
    };

    createPendingSignup(signupData);

    // Immediate resend should fail due to cooldown
    const earlyResend = resendSignupOtp('kylereese@gmail.com');
    expect(earlyResend.success).toBe(false);
    expect(earlyResend.cooldownSecondsRemaining).toBeGreaterThan(0);
    expect(earlyResend.error).toContain('Please wait');
  });

  it('resets rate-limiter failure attempts upon legitimate OTP resend (ISSUE-36)', () => {
    const signupData = {
      name: 'Resend Sync User',
      phone: '+14155552671',
      email: 'resend.sync@gmail.com',
      password: 'SecurePassword123!',
    };

    createPendingSignup(signupData);

    // Fail 4 times (1 attempt remaining before lockout)
    for (let i = 0; i < 4; i++) {
      const res = verifySignupOtp('resendsync@gmail.com', '000000');
      expect(res.success).toBe(false);
      expect(res.error).toContain(`${4 - i} attempt${4 - i === 1 ? '' : 's'} remaining`);
    }

    // Fast-forward cooldown to allow resend
    const entry = getPendingSignup('resendsync@gmail.com');
    expect(entry).not.toBeNull();
    if (entry) {
      entry.lastSentAt = Date.now() - 65 * 1000;
    }

    // Legitimate user requests fresh OTP
    const resendResult = resendSignupOtp('resendsync@gmail.com');
    expect(resendResult.success).toBe(true);
    expect(resendResult.otp).toBeDefined();

    // Now, a single typo on the newly issued OTP must NOT trigger immediate lockout;
    // user must have a full clean slate of attempts (4 remaining after this 1st typo on new code)
    const typoResult = verifySignupOtp('resendsync@gmail.com', '999999');
    expect(typoResult.success).toBe(false);
    expect(typoResult.error).toContain('4 attempts remaining');
    expect(typoResult.error).not.toContain('temporarily locked');
  });

  it('resets rate-limiter failure attempts upon legitimate password reset OTP resend (ISSUE-36)', () => {
    const email = 'reset.sync@gmail.com';
    createPasswordResetOtp(email);

    // Fail 4 times
    for (let i = 0; i < 4; i++) {
      const res = verifyPasswordResetOtp(email, '000000');
      expect(res.success).toBe(false);
      expect(res.error).toContain(`${4 - i} attempt${4 - i === 1 ? '' : 's'} remaining`);
    }

    // Fast-forward cooldown
    const resetEntry = getPendingPasswordReset(email);
    expect(resetEntry).not.toBeNull();
    if (resetEntry) {
      resetEntry.lastSentAt = Date.now() - 65 * 1000;
    }

    // Resend password reset OTP
    const resendResult = resendPasswordResetOtp(email);
    expect(resendResult.success).toBe(true);
    expect(resendResult.otp).toBeDefined();

    // Typo on new code should have 4 attempts remaining, NOT immediate lockout
    const typoResult = verifyPasswordResetOtp(email, '999999');
    expect(typoResult.success).toBe(false);
    expect(typoResult.error).toContain('4 attempts remaining');
    expect(typoResult.error).not.toContain('temporarily locked');
  });

  it('returns friendly error when verifying nonexistent or expired registration', () => {
    const result = verifySignupOtp('nonexistent@gmail.com', '123456');
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

    createPendingSignup(signupData);

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

  it('refreshes pending signup OTP and resets lockout counters', () => {
    const signupData = {
      name: 'Nathan Drake',
      phone: '+14155552671',
      email: 'nathan.drake@gmail.com',
      password: 'AdventureTime123!',
    };

    const initial = createPendingSignup(signupData);
    const refresh = refreshPendingSignupOtp('nathandrake@gmail.com');
    expect(refresh.success).toBe(true);
    expect(refresh.otp).toBeDefined();
    expect(refresh.otp).toHaveLength(6);

    // New OTP can be verified successfully
    const verifyResult = verifySignupOtp('nathandrake@gmail.com', refresh.otp!);
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.signupData?.name).toBe('Nathan Drake');
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
    ])('blocks new OTP generation when $type email is locked out', ({ email, init, verifyBad, attemptRecreate }) => {
      init(email);

      for (let i = 0; i < 5; i++) {
        verifyBad(email);
      }

      expect(() => attemptRecreate(email)).toThrow(/locked/i);
    });

    it('refuses to refreshPendingSignupOtp and does not clear lockout when locked out', () => {
      const email = 'locked.refresh@gmail.com';
      createPendingSignup({
        name: 'Locked Refresh',
        phone: '+14155552671',
        email,
        password: 'Password123!',
      });

      for (let i = 0; i < 5; i++) {
        verifySignupOtp(email, '000000');
      }

      const res = refreshPendingSignupOtp(email);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/locked/i);

      // Verify lockout remains intact
      const verifyAfter = verifySignupOtp(email, '123456');
      expect(verifyAfter.success).toBe(false);
      expect(verifyAfter.error).toMatch(/locked/i);
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

    it('strictly rejects non-6-digit or malformed OTP inputs for signup verification without silent coercion', () => {
      const email = 'strict.otp@gmail.com';
      createPendingSignup({
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
        const res = verifySignupOtp(email, input);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/must be exactly 6 digits/i);
      }
    });

    it('strictly rejects non-6-digit or malformed OTP inputs for password reset verification without silent coercion', () => {
      const email = 'strict.reset@gmail.com';
      createPasswordResetOtp(email);

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
        const res = verifyPasswordResetOtp(email, input);
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/must be exactly 6 digits/i);
      }
    });
  });
});




