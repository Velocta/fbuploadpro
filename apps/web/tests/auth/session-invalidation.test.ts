import { describe, it, expect, beforeEach } from 'vitest';
import { verifySessionToken } from '@fbuploadpro/contracts';
import {
  registerTenantUser,
  loginTenantUser,
  resetUserPasswordWithOtp,
  validateSessionActive,
  _resetAuthStores,
} from '../../src/lib/supabase-auth';

const SESSION_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Session Lifetime Synchronization & Invalidation (AUTH-05 / AUTH-07 / Spec 017 US4)', () => {
  beforeEach(() => {
    _resetAuthStores();
  });

  it('signs session tokens with exactly 30 days (2,592,000s) lifetime', async () => {
    const { token } = await registerTenantUser({
      name: 'Sarah Connor',
      phone: '+14155552671',
      email: 'sarah.session@gmail.com',
      password: 'SecurePassword123!',
    });

    const payload = await verifySessionToken(token, SESSION_SECRET);
    expect(payload.exp - payload.iat).toBe(86400 * 30); // 30 days in seconds
  });

  it('validates active session and invalidates previous sessions upon password reset', async () => {
    const email = 'john.invalidation@gmail.com';
    const originalPassword = 'InitialSecurePassword123!';
    const newPassword = 'UpdatedSecurePassword456!';

    // 1. Provision account and capture initial session
    const { token: initialToken } = await registerTenantUser({
      name: 'John Connor',
      phone: '+14155552671',
      email,
      password: originalPassword,
    });

    const initialSession = await verifySessionToken(initialToken, SESSION_SECRET);
    const isValidInitially = await validateSessionActive(initialSession);
    expect(isValidInitially).toBe(true);

    // 2. Perform password reset with OTP
    const { createPasswordResetOtp } = await import('../../src/lib/otp-service');
    const { otp } = createPasswordResetOtp(email);

    await resetUserPasswordWithOtp({
      email,
      otp,
      password: newPassword,
    });

    // 3. Old session MUST now be invalid (passwordUpdatedAt > iat)
    const isOldSessionValid = await validateSessionActive(initialSession);
    expect(isOldSessionValid).toBe(false);

    // 4. New login after password change succeeds and new session is valid
    const { token: newToken } = await loginTenantUser({
      email: 'johninvalidation@gmail.com',
      password: newPassword,
    });

    const newSession = await verifySessionToken(newToken, SESSION_SECRET);
    const isNewSessionValid = await validateSessionActive(newSession);
    expect(isNewSessionValid).toBe(true);
  });

  it('immediately invalidates session issued in the exact same second as password reset without artificial delays', async () => {
    const email = 'samesecond@gmail.com';
    const password = 'Password123!';
    const newPassword = 'NewPassword456!';

    // Register user
    const { token: initialToken } = await registerTenantUser({
      name: 'Same Second User',
      phone: '+14155552672',
      email,
      password,
    });

    const initialSession = await verifySessionToken(initialToken, SESSION_SECRET);
    expect(await validateSessionActive(initialSession)).toBe(true);

    // Reset password in the same second (NO artificial sleep/delay)
    const { createPasswordResetOtp } = await import('../../src/lib/otp-service');
    const { otp } = createPasswordResetOtp(email);

    await resetUserPasswordWithOtp({
      email,
      otp,
      password: newPassword,
    });

    // Old session MUST be invalid even if session.iat === passwordUpdatedAt
    const isOldValid = await validateSessionActive(initialSession);
    expect(isOldValid).toBe(false);

    // New login immediately in the same second MUST succeed and be active
    const { token: newToken } = await loginTenantUser({
      email,
      password: newPassword,
    });

    const newSession = await verifySessionToken(newToken, SESSION_SECRET);
    const isNewValid = await validateSessionActive(newSession);
    expect(isNewValid).toBe(true);
  });
});

