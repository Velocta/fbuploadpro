/**
 * Supabase client factories + test-double gate (spec 137 §3.2.5 split).
 *
 * Split from the former 1,314-line auth monolith
 * by spec 137 PR-A1b (audit #6 / spec §3.2.5). Function bodies are
 * verbatim; only imports/exports were re-wired to the new modules.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let mockSupabaseClientForTesting: SupabaseClient | null = null;
let mockSupabaseServiceClientForTesting: SupabaseClient | null = null;

/**
 * Single gate for every test double in this module. Mocks may only take
 * effect outside production — even if a setter is somehow called in
 * production, the mock is never honored by the getters.
 */
function isTestDoubleAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** Throws if test doubles are attempted in production. */
export function assertTestDoubleAllowed(caller: string): void {
  if (!isTestDoubleAllowed()) {
    throw new Error(`${caller} is test-only and must not be called in production.`);
  }
}

export function _setMockSupabaseClient(client: SupabaseClient | null): void {
  assertTestDoubleAllowed('_setMockSupabaseClient');
  mockSupabaseClientForTesting = client;
}

export function _setMockSupabaseServiceClient(client: SupabaseClient | null): void {
  assertTestDoubleAllowed('_setMockSupabaseServiceClient');
  mockSupabaseServiceClientForTesting = client;
}

/** Clears both mock clients. Called by `_resetAuthStores` (stores.ts). */
export function _resetMockSupabaseClients(): void {
  mockSupabaseClientForTesting = null;
  mockSupabaseServiceClientForTesting = null;
}

/**
 * Returns a Supabase client configured with the service-role key (SUPABASE_SERVICE_ROLE_KEY).
 * Exclusively for server-side administrative workflows and system jobs.
 * The name makes the elevated privilege explicit at every call site.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (isTestDoubleAllowed() && mockSupabaseServiceClientForTesting) {
    return mockSupabaseServiceClientForTesting;
  }
  if (isTestDoubleAllowed() && mockSupabaseClientForTesting) {
    return mockSupabaseClientForTesting;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key && !url.includes('placeholder') && !key.includes('placeholder')) {
    try {
      return createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch {
      return null;
    }
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are strictly required in production.');
  }
  return null;
}

export function getCookieDomain(requestHost?: string | null): string | undefined {
  const rawRoot = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const cleanRoot = rawRoot
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    ?.split(':')[0] || 'localhost';

  if (
    cleanRoot.includes('localhost') ||
    cleanRoot.includes('127.0.0.1') ||
    cleanRoot.endsWith('.vercel.app')
  ) {
    return undefined;
  }

  if (requestHost) {
    const cleanHost = requestHost.trim().toLowerCase().split(':')[0] || '';
    if (
      cleanHost.includes('localhost') ||
      cleanHost.includes('127.0.0.1') ||
      cleanHost.endsWith('.vercel.app') ||
      (cleanHost !== cleanRoot && !cleanHost.endsWith(`.${cleanRoot}`))
    ) {
      return undefined;
    }
  }

  return process.env.COOKIE_DOMAIN?.trim() || `.${cleanRoot}`;
}
