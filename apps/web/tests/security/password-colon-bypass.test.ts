/**
 * @file password-colon-bypass.test.ts
 * @description Security regression tests for ISSUE-34: Plaintext Password Storage & Universal Auth Bypass via Colon in Password
 * Verifies that:
 * 1. Passwords containing colons (e.g. 'Secret:123') are never stored in plaintext in pending signups.
 * 2. Pre-hashed passwords are strictly validated using /^[0-9a-f]{32}:[0-9a-f]{64}$/i.
 * 3. Malformed hashes (e.g. non-hex, short keys, zero-length keys) never cause authentication bypass in verifyHashedPasswordSync.
 * 4. TimingSafeEqual is never called with key lengths < 32.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  createPendingSignup,
  findPendingSignup,
  verifyPendingSignupPassword,
  verifyHashedPasswordSync,
  hashPasswordSync,
  _resetOtpStore,
} from '@/lib/otp-service';

describe('ISSUE-34: Plaintext Password Storage & Universal Auth Bypass via Colon in Password', () => {
  beforeEach(() => {
    _resetOtpStore();
  });

  it('hashes passwords containing colons instead of storing them as plaintext', async () => {
    const rawPassword = 'MySecret:Password123!';
    const email = 'colon-user@gmail.com';

    await createPendingSignup({
      name: 'Colon User',
      phone: '+15555550123',
      email,
      password: rawPassword,
    });

    const pending = findPendingSignup(email);
    expect(pending).not.toBeNull();
    // Must NOT be stored as plaintext
    expect(pending?.data.hashedPassword).not.toBe(rawPassword);
    // Must match PBKDF2 hash format: 32 hex chars salt : 64 hex chars key
    expect(pending?.data.hashedPassword).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/i);

    // Verifying with the correct password must succeed
    expect(await verifyPendingSignupPassword(email, rawPassword)).toBe(true);
    // Verifying with an incorrect password must fail
    expect(await verifyPendingSignupPassword(email, 'WrongPassword123!')).toBe(false);
  });

  it('rejects malformed hashes that would produce zero-byte keys in verifyHashedPasswordSync', () => {
    // Malformed hashes with non-hex characters where Buffer.from(..., 'hex') would yield 0 bytes
    const malformedHashes = [
      'zzz:yyy',
      'Secret:123',
      'invalid:hash',
      ':',
      '00:00',
      '0123456789abcdef:0123456789abcdef',
      '',
    ];

    for (const badHash of malformedHashes) {
      expect(verifyHashedPasswordSync('AnyPassword123!', badHash)).toBe(false);
      expect(verifyHashedPasswordSync('', badHash)).toBe(false);
    }
  });

  it('preserves valid PBKDF2 pre-hashed passwords without double-hashing', async () => {
    const rawPassword = 'ValidPassword123!';
    const legitimateHash = hashPasswordSync(rawPassword);
    const email = 'prehashed-user@gmail.com';

    await createPendingSignup({
      name: 'Prehashed User',
      phone: '+15555550124',
      email,
      password: legitimateHash,
    });

    const pending = findPendingSignup(email);
    expect(pending).not.toBeNull();
    // Must preserve the already-hashed password
    expect(pending?.data.hashedPassword).toBe(legitimateHash);
    // Password verification with raw password succeeds
    expect(await verifyPendingSignupPassword(email, rawPassword)).toBe(true);
  });

  it('strictly enforces key length >= 32 before timingSafeEqual', () => {
    // 32 hex salt (16 bytes), but only 16 hex key (8 bytes) -> should fail validation
    const shortKeyHash = '0123456789abcdef0123456789abcdef:0123456789abcdef';
    expect(verifyHashedPasswordSync('Password123!', shortKeyHash)).toBe(false);
  });
});
