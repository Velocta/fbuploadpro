import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSecureOtp,
  createPendingSignup,
  verifySignupOtp,
  resendSignupOtp,
  _resetOtpStore,
} from '../../src/lib/otp-service';

describe('OTP Service (Spec 013 - 6-Digit Email Confirmation)', () => {
  beforeEach(() => {
    _resetOtpStore();
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

  it('creates and verifies pending signup successfully with correct OTP', () => {
    const signupData = {
      name: 'Sarah Connor',
      phone: '+15551234567',
      email: 'sarah@resistance.org',
      password: 'SecurePassword123!',
    };

    const { otp, expiresAt } = createPendingSignup(signupData);
    expect(otp).toHaveLength(6);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const result = verifySignupOtp('sarah@resistance.org', otp);
    expect(result.success).toBe(true);
    expect(result.signupData).toBeDefined();
    expect(result.signupData?.name).toBe('Sarah Connor');
    expect(result.signupData?.email).toBe('sarah@resistance.org');
  });

  it('rejects incorrect OTP and counts attempts', () => {
    const signupData = {
      name: 'John Connor',
      phone: '+15559876543',
      email: 'john@resistance.org',
      password: 'SecurePassword123!',
    };

    createPendingSignup(signupData);

    const badResult = verifySignupOtp('john@resistance.org', '000000');
    expect(badResult.success).toBe(false);
    expect(badResult.error).toContain('Invalid verification code');
    expect(badResult.error).toContain('4 attempts remaining');
  });

  it('enforces 60-second cooldown on resend', () => {
    const signupData = {
      name: 'Kyle Reese',
      phone: '+15553334444',
      email: 'kyle@resistance.org',
      password: 'SecurePassword123!',
    };

    createPendingSignup(signupData);

    // Immediate resend should fail due to cooldown
    const earlyResend = resendSignupOtp('kyle@resistance.org');
    expect(earlyResend.success).toBe(false);
    expect(earlyResend.cooldownSecondsRemaining).toBeGreaterThan(0);
    expect(earlyResend.error).toContain('Please wait');
  });

  it('returns friendly error when verifying nonexistent or expired registration', () => {
    const result = verifySignupOtp('nonexistent@example.com', '123456');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No pending registration found');
  });
});
