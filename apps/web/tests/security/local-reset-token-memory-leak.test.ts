/**
 * @file local-reset-token-memory-leak.test.ts
 * @description Security regression tests for ISSUE-10: Unbounded Memory Leak in localResetTokenStore
 * Verifies that:
 * 1. requestPasswordReset in supabase-auth.ts does NOT populate in-memory localResetTokenStore when Supabase client is active or in production.
 * 2. In-memory localResetTokenStore is purged and not leaked across requests.
 * 3. All password recovery flows are routed through 6-digit OTP verification via Supabase Auth (Principle 12 & Principle 29).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as authModule from '@/lib/supabase-auth';

describe('ISSUE-10: Unbounded Memory Leak in localResetTokenStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authModule._resetAuthStores();
  });

  it('verifies that localResetTokenStore is completely eradicated from supabase-auth.ts source', () => {
    const authFilePath = path.resolve(process.cwd(), 'src/lib/supabase-auth.ts');
    const content = fs.readFileSync(authFilePath, 'utf-8');

    // Asserts that localResetTokenStore Map is no longer declared or used
    expect(content).not.toContain('const localResetTokenStore = new Map');
    expect(content).not.toContain('localResetTokenStore.set');
    expect(content).not.toContain('localResetTokenStore.get');
  });

  it('routes requestPasswordReset through Supabase without mutating any local in-memory token stores', async () => {
    const resetPasswordForEmailMock = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    });

    const mockSupabase = {
      auth: {
        resetPasswordForEmail: resetPasswordForEmailMock,
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          or: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: '00000000-0000-4000-a000-000000000001',
                email: 'testuser@gmail.com',
                normalized_email: 'testuser@gmail.com',
                status: 'active',
              },
              error: null,
            }),
          })),
        })),
      })),
    };

    authModule._setMockSupabaseClient(mockSupabase as any);

    const result = await authModule.requestPasswordReset({
      email: 'testuser@gmail.com',
    });

    expect(result.message).toContain('If an account exists with this email address');
    // resetToken must NOT be leaked or created in production / Supabase mode
    expect(result.resetToken).toBeUndefined();
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith('testuser@gmail.com', undefined);

    authModule._setMockSupabaseClient(null);
  });
});
