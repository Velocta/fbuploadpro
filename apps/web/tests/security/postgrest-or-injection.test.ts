/**
 * @file postgrest-or-injection.test.ts
 * @description Security regression tests for ISSUE-03: PostgREST .or() Filter Injection via Unvalidated Email Fallback
 * Verifies that findUserByEmail, verifySignupOtpViaSupabase, and resetUserPassword validate email inputs,
 * reject PostgREST query delimiter injection attacks, and quote operands in .or() filters.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as authModule from '@/lib/supabase-auth';

describe('ISSUE-03: PostgREST .or() Filter Injection Defense', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authModule._resetAuthStores();
  });

  describe('PostgREST query delimiter injection rejection', () => {
    it('returns null and does not query Supabase with raw injected predicates in findUserByEmail', async () => {
      const orSpy = vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: orSpy,
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      // Malicious payload trying to inject extra filter predicate:
      // "victim@target.com,id.eq.00000000-0000-0000-0000-000000000000"
      const injectedEmail = 'victim@target.com,id.eq.00000000-0000-0000-0000-000000000000';
      const result = await authModule.findUserByEmail(injectedEmail);

      expect(result).toBeNull();
      // Should either not call orSpy at all, or if called, must quote and neutralize delimiters
      if (orSpy.mock.calls.length > 0) {
        const filterArg = (orSpy.mock.calls[0] as unknown as [string])[0];
        expect(filterArg).not.toContain(',id.eq.');
      }
    });

    it('rejects characters used for PostgREST filter injection in verifySignupOtpViaSupabase', async () => {
      const mockSupabase = {
        auth: {
          verifyOtp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            or: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      const maliciousEmail = 'victim@gmail.com(status.eq.active)';
      await expect(
        authModule.verifySignupOtpViaSupabase({
          email: maliciousEmail,
          otp: '123456',
        })
      ).rejects.toThrow();
    });

    it('rejects unvalidated email with injection delimiters in resetUserPassword', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
          updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
        },
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            or: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      const maliciousEmail = 'test@example.com,role.eq.admin';
      await expect(
        authModule.resetUserPassword({
          email: maliciousEmail,
          password: 'NewValidPassword123!',
          token: 'valid-token-string',
        })
      ).rejects.toThrow();
    });

    it('quotes operands safely in PostgREST .or() filter for valid non-gmail addresses', async () => {
      let capturedFilter = '';
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                or: vi.fn((filter: string) => {
                  capturedFilter = filter;
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'test-user-id',
                        email: 'usercorp@gmail.com',
                        name: 'Corporate User',
                        role: 'user',
                        status: 'active',
                      },
                      error: null,
                    }),
                  };
                }),
              })),
            };
          }
          if (table === 'workspaces') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { subdomain: 'corporate-ws' },
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      };

      authModule._setMockSupabaseClient(mockSupabase as any);

      const result = await authModule.findUserByEmail('usercorp@gmail.com');
      expect(result).not.toBeNull();
      expect(result?.email).toBe('usercorp@gmail.com');

      // Verify that PostgREST .or() filter properly quotes strings:
      // normalized_email.eq."usercorp@gmail.com",email.ilike."usercorp@gmail.com"
      expect(capturedFilter).toBe(
        'normalized_email.eq."usercorp@gmail.com",email.ilike."usercorp@gmail.com"'
      );
    });
  });
});
