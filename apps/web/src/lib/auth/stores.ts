/**
 * In-memory fallback stores + test seeding helpers (spec 137 §3.2.5 split).
 *
 * Split from the former 1,314-line auth monolith
 * by spec 137 PR-A1b (audit #6 / spec §3.2.5). Function bodies are
 * verbatim; only imports/exports were re-wired to the new modules.
 */

import { canonicalizeGmailAddress } from '@fbuploadpro/contracts';
import { assertTestDoubleAllowed, _resetMockSupabaseClients } from './clients';
import { hashPassword } from './passwords';
import type { AuthUser } from './users';

// In-memory credential store for test/CI fallback when Supabase external cluster is not configured
export const localPasswordStore = new Map<string, string>();
export const localUserStore = new Map<string, AuthUser>();

export function _resetAuthStores(): void {
  localPasswordStore.clear();
  localUserStore.clear();
  _resetMockSupabaseClients();
}

export async function _seedTestUser(user: AuthUser, password?: string): Promise<void> {
  assertTestDoubleAllowed('_seedTestUser');
  let canonical: string;
  try {
    canonical = canonicalizeGmailAddress(user.email);
  } catch {
    canonical = user.email.trim().toLowerCase();
  }
  localUserStore.set(canonical, user);
  localUserStore.set(user.email.trim().toLowerCase(), user);
  if (password) {
    const hash = await hashPassword(password);
    localPasswordStore.set(canonical, hash);
    localPasswordStore.set(user.email.trim().toLowerCase(), hash);
  }
}

export function _setResetTokenForTesting(
  _token: string,
  _data: { email: string; expiresAt: number }
): void {
  // Deprecated: localResetTokenStore has been eradicated per Principle 12 & Principle 29 (ISSUE-10)
}
