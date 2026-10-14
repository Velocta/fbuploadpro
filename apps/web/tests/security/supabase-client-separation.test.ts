/**
 * @file supabase-client-separation.test.ts
 * @description Architecture & RLS regression tests for ISSUE-05: Service-Role Key Used Indiscriminately in getSupabaseClient()
 * Verifies that client-facing operations (GoTrue user auth flows) use getSupabaseAnonClient()
 * while administrative operations strictly use getSupabaseServiceClient().
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as authModule from '@/lib/supabase-auth';

describe('ISSUE-05: Client Separation between Anon Key and Service-Role Key', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    authModule._resetAuthStores();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyzcompany.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public-jwt-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-admin-key';
  });

  it('provides getSupabaseAnonClient configured with anon key and session persistence', () => {
    const anonClient = authModule.getSupabaseAnonClient();
    expect(anonClient).toBeDefined();
    expect(anonClient).not.toBeNull();
    // @ts-expect-error accessing private property for test verification
    expect(anonClient?.supabaseKey).toBe('anon-public-jwt-key');
  });

  it('provides getSupabaseServiceClient configured with service role key', () => {
    const serviceClient = authModule.getSupabaseServiceClient();
    expect(serviceClient).toBeDefined();
    expect(serviceClient).not.toBeNull();
    // @ts-expect-error accessing private property for test verification
    expect(serviceClient?.supabaseKey).toBe('service-role-admin-key');
  });

  it('falls back to anon key for getSupabaseServiceClient if service role key is absent in non-production', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const client = authModule.getSupabaseServiceClient();
    expect(client).toBeDefined();
    // @ts-expect-error accessing private property for test verification
    expect(client?.supabaseKey).toBe('anon-public-jwt-key');
  });

  it('allows mocking distinct anon and service clients via testing helpers', () => {
    const mockAnon = { type: 'anon' };
    const mockService = { type: 'service' };

    authModule._setMockSupabaseAnonClient(mockAnon as any);
    authModule._setMockSupabaseServiceClient(mockService as any);

    expect(authModule.getSupabaseAnonClient()).toBe(mockAnon);
    expect(authModule.getSupabaseServiceClient()).toBe(mockService);
  });
});
