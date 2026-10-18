/**
 * @file silent-postgrest-failures.test.ts
 * @description Security regression tests for ISSUE-07: Silent PostgREST Insert/Upsert Failures During Signup & Verification
 * Verifies that PostgREST errors during user upsert/insert and status activation throw errors instead of returning fake success.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as authModule from '@/lib/supabase-auth';

const VALID_UUID = '00000000-0000-4000-a000-000000000001';

describe('ISSUE-07: Silent PostgREST Insert/Upsert Failures During Signup & Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authModule._resetAuthStores();
    process.env.SESSION_SECRET = 'test-secret-at-least-32-chars-long-123456';
  });

  describe('signUpTenantUser', () => {
    it('throws error when user upsert returns PostgREST error', async () => {
      const mockSupabase = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: { user: { id: VALID_UUID } },
            error: null,
          }),
          admin: {
            getUserById: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          },
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
              upsert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'relation "users" does not exist', code: '42P01' },
                  }),
                })),
              })),
            };
          }
          if (table === 'workspaces') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
              insert: vi.fn().mockResolvedValue({ data: { id: 'ws-1' }, error: null }),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      await expect(
        authModule.signUpTenantUser({
          name: 'Test User',
          email: 'testuser@gmail.com',
          phone: '+15555550199',
          password: 'Password123!',
        })
      ).rejects.toThrow(/relation "users" does not exist|User profile creation failed/i);
    });

    it('throws error when unconfirmed user detail update fails in PostgREST', async () => {
      const mockSupabase = {
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              data: { user: { id: VALID_UUID, email_confirmed_at: null } },
              error: null,
            }),
          },
          resend: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: VALID_UUID, email: 'existing@gmail.com', role: 'user', status: 'pending' },
                    error: null,
                  }),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'violates foreign key constraint', code: '23503' },
                }),
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      await expect(
        authModule.signUpTenantUser({
          name: 'Updated Name',
          email: 'existing@gmail.com',
          phone: '+15555550199',
        })
      ).rejects.toThrow(/violates foreign key constraint|User detail update failed/i);
    });

    it('throws fallback error when unconfirmed user detail update error has empty message', async () => {
      const mockSupabase = {
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              data: { user: { id: VALID_UUID, email_confirmed_at: null } },
              error: null,
            }),
          },
          resend: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: VALID_UUID, email: 'existing@gmail.com', role: 'user', status: 'pending' },
                    error: null,
                  }),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: '', code: '23503' },
                }),
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      await expect(
        authModule.signUpTenantUser({
          name: 'Updated Name',
          email: 'existing@gmail.com',
          phone: '+15555550199',
        })
      ).rejects.toThrow('User detail update failed');
    });

    it('throws error when user upsert error has empty message string', async () => {
      const mockSupabase = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: { user: { id: VALID_UUID } },
            error: null,
          }),
          admin: {
            getUserById: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          },
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
              upsert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: '', code: '42P01' },
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      await expect(
        authModule.signUpTenantUser({
          name: 'Test User',
          email: 'testuser@gmail.com',
          phone: '+15555550199',
          password: 'Password123!',
        })
      ).rejects.toThrow('User profile creation failed');
    });

    it('re-throws when getUserById admin throws Email is already registered', async () => {
      const mockSupabase = {
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              data: { user: { id: VALID_UUID, email_confirmed_at: '2026-01-01T00:00:00Z' } },
              error: null,
            }),
          },
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: VALID_UUID, email: 'confirmed@gmail.com', role: 'user', status: 'active' },
                    error: null,
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      await expect(
        authModule.signUpTenantUser({
          name: 'Confirmed User',
          email: 'confirmed@gmail.com',
          phone: '+15555550199',
        })
      ).rejects.toThrow('Email is already registered');
    });

    it('handles unexpected non-registered exception from getUserById gracefully and proceeds', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockSupabase = {
        auth: {
          admin: {
            getUserById: vi.fn().mockRejectedValue(new Error('Admin network timeout')),
          },
          resend: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: VALID_UUID, email: 'existing@gmail.com', role: 'user', status: 'pending' },
                    error: null,
                  }),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: { id: VALID_UUID },
                  error: null,
                }),
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      const result = await authModule.signUpTenantUser({
        name: 'Updated Name',
        email: 'existing@gmail.com',
        phone: '+15555550199',
      });

      expect(result.requiresOtp).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Supabase Auth Admin] getUserById exception:'),
        expect.any(Error)
      );
    });
  });

  describe('registerTenantUser', () => {
    it('throws error when user insert returns PostgREST error', async () => {
      const mockSupabase = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: { user: { id: VALID_UUID } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'null value in column "id" violates not-null constraint', code: '23502' },
                  }),
                })),
              })),
              upsert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'null value in column "id" violates not-null constraint', code: '23502' },
                  }),
                })),
              })),
            };
          }
          if (table === 'workspaces') {
            return {
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
              insert: vi.fn().mockResolvedValue({ data: { id: 'ws-1' }, error: null }),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      await expect(
        authModule.signUpTenantUser({
          name: 'Test User',
          email: 'testuser@gmail.com',
          phone: '+15555550199',
          password: 'Password123!',
        })
      ).rejects.toThrow(/violates not-null constraint|User profile creation failed/i);
    });

    it('throws fallback error when user insert returns PostgREST error with empty message', async () => {
      const mockSupabase = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: { user: { id: VALID_UUID } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: '', code: '23502' },
                  }),
                })),
              })),
              upsert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: '', code: '23502' },
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      await expect(
        authModule.signUpTenantUser({
          name: 'Test User',
          email: 'testuser@gmail.com',
          phone: '+15555550199',
          password: 'Password123!',
        })
      ).rejects.toThrow('User profile creation failed');
    });
  });

  describe('verifySignupOtpViaSupabase', () => {
    it('throws error when activating user status fails in PostgREST', async () => {
      const mockSupabase = {
        auth: {
          verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } }, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: VALID_UUID, email: 'testuser@gmail.com', role: 'user', status: 'pending' },
                    error: null,
                  }),
                })),
              })),
              update: vi.fn(() => ({
                or: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'connection timeout', code: '57P01' },
                }),
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      await expect(
        authModule.verifySignupOtpViaSupabase({
          email: 'testuser@gmail.com',
          otp: '123456',
        })
      ).rejects.toThrow(/connection timeout|User status activation failed/i);
    });

    it('throws fallback error when activating user status returns PostgREST error with empty message', async () => {
      const mockSupabase = {
        auth: {
          verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: VALID_UUID } }, error: null }),
        },
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: VALID_UUID, email: 'testuser@gmail.com', role: 'user', status: 'pending' },
                    error: null,
                  }),
                })),
              })),
              update: vi.fn(() => ({
                or: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: '', code: '57P01' },
                }),
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      await expect(
        authModule.verifySignupOtpViaSupabase({
          email: 'testuser@gmail.com',
          otp: '123456',
        })
      ).rejects.toThrow('User status activation failed');
    });
  });
});
