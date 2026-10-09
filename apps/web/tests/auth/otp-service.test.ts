import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSecureOtp,
  constantTimeEquals,
  createPendingSignup,
  verifySignupOtp,
  resendSignupOtp,
  findPendingSignup,
  verifyPendingSignupPassword,
  refreshPendingSignupOtp,
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

  it('returns friendly error when verifying nonexistent or expired registration', () => {
    const result = verifySignupOtp('nonexistent@gmail.com', '123456');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No pending registration found');
  });

  it('correctly finds pending signup and verifies password against pre-hashed staged record', () => {
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
    const isCorrect = verifyPendingSignupPassword('elenafisher@gmail.com', 'StrongPassword123!');
    expect(isCorrect).toBe(true);

    // Invalid password check
    const isIncorrect = verifyPendingSignupPassword('elenafisher@gmail.com', 'WrongPassword123!');
    expect(isIncorrect).toBe(false);

    // Non-existent email check
    const nonExistent = verifyPendingSignupPassword('nonexistent@gmail.com', 'Password123!');
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
});
