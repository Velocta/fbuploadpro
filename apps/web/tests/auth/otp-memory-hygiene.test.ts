import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPendingSignup,
  getPendingSignup,
  verifySignupOtp,
  _resetOtpStore,
} from '../../src/lib/otp-service';
import {
  registerTenantUser,
  loginTenantUser,
  _resetAuthStores,
} from '../../src/lib/supabase-auth';

describe('Credential Zero-Retention in OTP Staging (AUTH-02 / Spec 017 US3)', () => {
  beforeEach(() => {
    _resetOtpStore();
    _resetAuthStores();
  });

  it('stages credentials with PBKDF2 pre-hashing and never retains plaintext password', () => {
    const rawPassword = 'SuperSecretPlaintextPassword!99';
    const email = 'zero.retention@gmail.com';

    const { otp } = createPendingSignup({
      name: 'Ellen Ripley',
      phone: '+14155552671',
      email,
      password: rawPassword,
    });

    // 1. Inspect in-memory staged record directly
    const stagedEntry = getPendingSignup(email);
    expect(stagedEntry).toBeDefined();
    expect(stagedEntry).not.toBeNull();

    // 2. Ensure plaintext password property is NOT defined on staged data
    const stagedData = stagedEntry!.data as unknown as Record<string, unknown>;
    expect(stagedData['password']).toBeUndefined();

    // 3. Ensure hashedPassword exists and conforms to saltHex:hashHex structure
    expect(typeof stagedData['hashedPassword']).toBe('string');
    const hash = stagedData['hashedPassword'] as string;
    const parts = hash.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(32); // 16 bytes = 32 hex chars salt
    expect(parts[1]).toHaveLength(64); // 32 bytes = 64 hex chars hash

    // 4. Assert plaintext password string does not appear anywhere in serialized JSON
    const serialized = JSON.stringify(stagedEntry);
    expect(serialized).not.toContain(rawPassword);

    // 5. Verify OTP and ensure verification payload delivers pre-hashed credential
    const verification = verifySignupOtp(email, otp);
    expect(verification.success).toBe(true);
    expect(verification.signupData).toBeDefined();

    const verifiedData = verification.signupData as unknown as Record<string, unknown>;
    expect(verifiedData['password']).toBeUndefined();
    expect(verifiedData['hashedPassword']).toBe(hash);
  });

  it('provisions user from pre-hashed staged data and enables seamless subsequent login', async () => {
    const rawPassword = 'AnotherSecretPassword!42';
    const email = 'ripley.login@gmail.com';

    const { otp } = createPendingSignup({
      name: 'Ellen Ripley',
      phone: '+14155552671',
      email,
      password: rawPassword,
    });

    const verification = verifySignupOtp(email, otp);
    expect(verification.success).toBe(true);
    expect(verification.signupData).toBeDefined();

    // Provision account using staged pre-hashed credential
    const { user, token } = await registerTenantUser(verification.signupData!);
    expect(user).toBeDefined();
    expect(user.email).toBe('ripleylogin@gmail.com');
    expect(token).toBeDefined();

    // Authenticate with the original plaintext password to ensure derivation compatibility
    const loginResult = await loginTenantUser({
      email: 'ripleylogin@gmail.com',
      password: rawPassword,
    });

    expect(loginResult.user.id).toBe(user.id);
    expect(loginResult.token).toBeDefined();
  });
});
