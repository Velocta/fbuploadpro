import { describe, it, expect, beforeEach } from 'vitest';
import { verifySessionToken } from '@fbuploadpro/contracts';
import {
  registerTenantUser,
  loginTenantUser,
  resetUserPassword,
  validateSessionActive,
  _resetAuthStores,
  _setResetTokenForTesting,
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

    // Ensure at least 1 second elapses so passwordUpdatedAt > initialSession.iat
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // 2. Perform password reset with valid recovery token
    const recoveryToken = 'recovery-token-for-invalidation';
    _setResetTokenForTesting(recoveryToken, {
      email: 'johninvalidation@gmail.com',
      expiresAt: Date.now() + 3600000,
    });

    await resetUserPassword({
      token: recoveryToken,
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
});
