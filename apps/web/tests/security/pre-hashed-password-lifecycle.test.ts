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

  it('never passes PBKDF2 pre-hashed string into Supabase auth.signUp in registerTenantUser', async () => {
    let capturedSignUpPassword = '';
    const mockSupabase = {
      auth: {
        signUp: vi.fn((opts: { email: string; password?: string }) => {
          capturedSignUpPassword = opts.password || '';
          return Promise.resolve({
            data: { user: { id: '00000000-0000-4000-a000-000000000001' } },
            error: null,
          });
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: '00000000-0000-4000-a000-000000000001',
                    email: 'test@gmail.com',
                    name: 'Test',
                    phone: '+15555550199',
                    role: 'user',
                    status: 'active',
                  },
                  error: null,
                }),
              })),
            })),
            select: vi.fn(() => ({
              or: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }
        if (table === 'workspaces') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  })),
                })),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }
        return {};
      }),
    };

    authModule._setMockSupabaseClient(mockSupabase as any);

    const rawPassword = 'PlaintextPassword123!';
    const pbkdf2Hash = await authModule.hashPassword(rawPassword);

    // Call registerTenantUser with both password and hashedPassword
    await authModule.registerTenantUser({
      name: 'Test User',
      email: 'test@gmail.com',
      phone: '+15555550199',
      password: rawPassword,
      hashedPassword: pbkdf2Hash,
    });

    // CRITICAL: Supabase auth.signUp must receive the raw password, NOT the PBKDF2 hash!
    expect(capturedSignUpPassword).toBe(rawPassword);
    expect(capturedSignUpPassword).not.toContain(':');
    expect(capturedSignUpPassword).not.toBe(pbkdf2Hash);
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
