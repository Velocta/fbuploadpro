import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSecureOtp,
  constantTimeEquals,
  createPasswordResetOtp,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  getPendingPasswordReset,
  _resetOtpStore,
} from '../../src/lib/otp-service';
import {
  resetUserPasswordWithOtp,
  loginTenantUser,
  registerTenantUser,
  validateSessionActive,
  _resetAuthStores,
} from '../../src/lib/supabase-auth';
import { _resetRateLimiter } from '../../src/lib/rate-limiter';
import { verifySessionToken } from '@fbuploadpro/contracts';

const SESSION_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Password Reset OTP Flow (Spec 018)', () => {
  beforeEach(() => {
    _resetOtpStore();
    _resetAuthStores();
    _resetRateLimiter();
  });

  describe('OTP Generation & Delivery (US1)', () => {
    it('generates a cryptographically secure 6-digit numeric OTP with 10-minute TTL', () => {
      const { otp, expiresAt } = createPasswordResetOtp('John.Doe+security@gmail.com');

      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      expect(parseInt(otp, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(otp, 10)).toBeLessThanOrEqual(999999);

      const ttlMs = expiresAt.getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(9 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);

      // Verify stored under canonical email
      const entry = getPendingPasswordReset('johndoe@gmail.com');
      expect(entry).not.toBeNull();
      expect(entry?.otp).toBe(otp);
      expect(entry?.email).toBe('johndoe@gmail.com');
    });

    it('enforces 60-second resend cooldown', () => {
      const email = 'speedy@gmail.com';
      createPasswordResetOtp(email);

      // Attempt immediate resend
      const earlyResend = resendPasswordResetOtp(email);
      expect(earlyResend.success).toBe(false);
      expect(earlyResend.cooldownSecondsRemaining).toBeGreaterThan(0);
      expect(earlyResend.error).toContain('Please wait');

      // Manipulate lastSentAt to simulate 61 seconds passing
      const entry = getPendingPasswordReset(email);
      expect(entry).not.toBeNull();
      if (entry) {
        entry.lastSentAt = Date.now() - 65 * 1000;
      }

      const validResend = resendPasswordResetOtp(email);
      expect(validResend.success).toBe(true);
      expect(validResend.otp).toHaveLength(6);
    });
  });

  describe('OTP Verification, Lockout & Password Mutation (US2)', () => {
    it('verifies correct OTP and consumes it (single-use)', () => {
      const email = 'alex.reset@gmail.com';
      const { otp } = createPasswordResetOtp(email);

      const result = verifyPasswordResetOtp('alexreset@gmail.com', otp);
      expect(result.success).toBe(true);

      // Immediate reuse must fail
      const reuse = verifyPasswordResetOtp('alexreset@gmail.com', otp);
      expect(reuse.success).toBe(false);
      expect(reuse.error).toContain('No active password reset request found');
    });

    it('decrements remaining attempts on incorrect code and locks out after 5 failures', () => {
      const email = 'lockout.target@gmail.com';
      createPasswordResetOtp(email);

      for (let i = 0; i < 4; i++) {
        const attempt = verifyPasswordResetOtp(email, '000000');
        expect(attempt.success).toBe(false);
        expect(attempt.error).toContain('Invalid verification code');
        expect(attempt.error).toContain(`${4 - i} attempt${4 - i === 1 ? '' : 's'} remaining`);
      }

      // 5th attempt locks out
      const finalAttempt = verifyPasswordResetOtp(email, '000000');
      expect(finalAttempt.success).toBe(false);
      expect(finalAttempt.error).toContain('temporarily locked');

      // Subsequent attempt blocked even with valid code
      const lockedAttempt = verifyPasswordResetOtp(email, '123456');
      expect(lockedAttempt.success).toBe(false);
      expect(lockedAttempt.error).toContain('temporarily locked');
    });

    it('updates password and invalidates prior sessions', async () => {
      // 1. Register a user
      const userResult = await registerTenantUser({
        name: 'Target User',
        phone: '+14155551234',
        email: 'target.user@gmail.com',
        password: 'OriginalPassword123!',
      });
      const originalToken = userResult.token;
      const initialSession = await verifySessionToken(originalToken, SESSION_SECRET);

      // Original session is initially valid
      const initialActive = await validateSessionActive(initialSession);
      expect(initialActive).toBe(true);

      // 2. Request password reset OTP
      const { otp } = createPasswordResetOtp('target.user@gmail.com');

      // 3. Reset password with OTP
      // Advance clock slightly so session.iat is strictly less than passwordUpdatedAt
      await new Promise((r) => setTimeout(r, 1100));

      const resetResult = await resetUserPasswordWithOtp({
        email: 'targetuser@gmail.com',
        otp,
        password: 'NewStrongPassword456!',
      });
      expect(resetResult.message).toContain('successfully updated');

      // 4. Verify previous session token is now INVALID
      const postResetActive = await validateSessionActive(initialSession);
      expect(postResetActive).toBe(false);

      // 5. Verify old password fails and new password succeeds
      await expect(
        loginTenantUser({
          email: 'target.user@gmail.com',
          password: 'OriginalPassword123!',
        })
      ).rejects.toThrow('Invalid email or password');

      const loginResult = await loginTenantUser({
        email: 'target.user@gmail.com',
        password: 'NewStrongPassword456!',
      });
      expect(loginResult.user.email).toBe('targetuser@gmail.com');
      expect(loginResult.token).toBeDefined();

      // 6. Verify new session is valid
      const newSession = await verifySessionToken(loginResult.token, SESSION_SECRET);
      const newActive = await validateSessionActive(newSession);
      expect(newActive).toBe(true);
    });
  });
});
