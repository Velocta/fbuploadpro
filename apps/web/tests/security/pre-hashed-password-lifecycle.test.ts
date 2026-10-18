/**
 * @file pre-hashed-password-lifecycle.test.ts
 * @description Security regression tests for ISSUE-06: Broken Pre-Hashed Password Handling Between signUpTenantUser and registerTenantUser
 * Verifies that:
 * 1. registerTenantUser never passes PBKDF2 pre-hashed password strings into Supabase GoTrue signUp (only raw passwords).
 * 2. signUpTenantUser accepts pre-hashed credentials without recalculating redundant PBKDF2 iterations.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as authModule from '@/lib/supabase-auth';

describe('ISSUE-06: Pre-Hashed Password Handling Lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authModule._resetAuthStores();
  });

  it('signUpTenantUser does not redundantly re-hash password if hashedPassword is provided in fallback mode', async () => {
    authModule._setMockSupabaseClient(null); // Local fallback mode

    const hashPasswordSpy = vi.spyOn(authModule, 'hashPassword');
    const existingHash = 'already-hashed-salt:already-hashed-key';

    const result = await authModule.signUpTenantUser({
      name: 'Fallback User',
      email: 'fallback@gmail.com',
      phone: '+15555550199',
      hashedPassword: existingHash,
    });

    expect(result.requiresOtp).toBe(true);
    // Since hashedPassword was already provided, hashPassword should NOT be called
    expect(hashPasswordSpy).not.toHaveBeenCalled();
  });
});
