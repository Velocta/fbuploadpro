/**
 * Workspace display-name resolver — contract + dedupe tests
 * (spec 130 §5.8 / T7, discharging spec 137 §11(b)).
 *
 * Contract: found name → the name; missing workspace → null; lookup
 * failure → null AND the failure is reported through the reportError
 * seam (the named, tested contract — never a silent swallow, never a
 * throw into render).
 *
 * Dedupe: `getWorkspaceDisplayName` is wrapped in React `cache()`, so
 * within one request the tenant layout's generateMetadata, the layout
 * body and the home page share ONE underlying lookup. React's cache
 * only memoizes inside Next's RSC request scope (it patches React for
 * that runtime); Vitest resolves the plain client React build, where
 * cache() is a pass-through (verified empirically at build time). This
 * suite therefore substitutes a faithful request-scope memo for
 * `cache` — keyed by arguments, one module instance = one simulated
 * request — and asserts the three real call sites together perform
 * the underlying session/Supabase lookup exactly once. Distinct
 * subdomains per test keep the simulated request scopes isolated.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const memo = new Map<string, unknown>();
  const cacheScope = (fn: (...args: never[]) => unknown) => {
    const wrapped = (...args: unknown[]) => {
      const key = JSON.stringify(args);
      if (!memo.has(key)) {
        memo.set(key, (fn as (...a: unknown[]) => unknown)(...args));
      }
      return memo.get(key);
    };
    return wrapped;
  };
  return { ...actual, cache: cacheScope };
});

vi.mock('@/lib/auth', () => ({
  getServerSessionContext: vi.fn(),
}));

vi.mock('@/lib/auth/clients', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { getServerSessionContext } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/auth/clients';
import {
  setReportErrorTransport,
  resetReportErrorTransport,
} from '@/lib/report-error';
import { getWorkspaceDisplayName } from '../../src/app/tenant/[subdomain]/workspace-display-name';
import TenantLayout, {
  generateMetadata as tenantGenerateMetadata,
} from '../../src/app/tenant/[subdomain]/layout';
import TenantIndexPage from '../../src/app/tenant/[subdomain]/page';

type SessionResult = Awaited<ReturnType<typeof getServerSessionContext>>;

function sessionFor(subdomain: string): SessionResult {
  return {
    userId: 'user-1',
    email: 'owner@example.com',
    subdomain,
    role: 'owner',
  } as SessionResult;
}

function fakeSupabase(data: unknown, fail?: Error) {
  const maybeSingle = vi.fn(async () => {
    if (fail) throw fail;
    return { data };
  });
  const chain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: typeof maybeSingle;
  } = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle,
  };
  const from = vi.fn(() => chain);
  return { client: { from } as unknown as ReturnType<typeof getSupabaseAdminClient>, chain, maybeSingle };
}

const mockSession = vi.mocked(getServerSessionContext);
const mockAdminClient = vi.mocked(getSupabaseAdminClient);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  resetReportErrorTransport();
});

describe('getWorkspaceDisplayName contract', () => {
  it('returns the display name when the workspace is found', async () => {
    const fake = fakeSupabase({ name: 'Acme Media' });
    mockAdminClient.mockReturnValue(fake.client);
    mockSession.mockResolvedValue(sessionFor('found-co'));

    await expect(getWorkspaceDisplayName('found-co')).resolves.toBe('Acme Media');
    // The lookup is scoped to the signed-in owner.
    expect(fake.chain.eq).toHaveBeenCalledWith('subdomain', 'found-co');
    expect(fake.chain.eq).toHaveBeenCalledWith('owner_id', 'user-1');
  });

  it('returns null when the workspace does not exist', async () => {
    const fake = fakeSupabase(null);
    mockAdminClient.mockReturnValue(fake.client);
    mockSession.mockResolvedValue(sessionFor('missing-co'));

    await expect(getWorkspaceDisplayName('missing-co')).resolves.toBeNull();
  });

  it('returns null and reports the failure when the lookup throws', async () => {
    const failure = new Error('lookup exploded');
    const fake = fakeSupabase(null, failure);
    mockAdminClient.mockReturnValue(fake.client);
    mockSession.mockResolvedValue(sessionFor('broken-co'));
    const reported: Array<{ error: unknown; source: string | undefined }> = [];
    setReportErrorTransport((error, context) => {
      reported.push({ error, source: context?.source });
    });

    await expect(getWorkspaceDisplayName('broken-co')).resolves.toBeNull();
    expect(reported).toHaveLength(1);
    expect(reported[0]?.error).toBe(failure);
    expect(reported[0]?.source).toBe('workspace-display-name');
  });

  it('returns null when no admin client is configured', async () => {
    mockAdminClient.mockReturnValue(null as ReturnType<typeof getSupabaseAdminClient>);
    mockSession.mockResolvedValue(sessionFor('noclient-co'));

    await expect(getWorkspaceDisplayName('noclient-co')).resolves.toBeNull();
  });
});

describe('getWorkspaceDisplayName dedupe (one lookup per request)', () => {
  it('repeated calls with the same subdomain perform the lookup once', async () => {
    const fake = fakeSupabase({ name: 'Dedupe Co' });
    mockAdminClient.mockReturnValue(fake.client);
    mockSession.mockResolvedValue(sessionFor('dedupe-co'));

    await getWorkspaceDisplayName('dedupe-co');
    await getWorkspaceDisplayName('dedupe-co');
    await getWorkspaceDisplayName('dedupe-co');

    expect(fake.maybeSingle).toHaveBeenCalledTimes(1);
    expect(mockSession).toHaveBeenCalledTimes(1);
  });

  it('layout generateMetadata + layout body + home page share one lookup', async () => {
    const fake = fakeSupabase({ name: 'One Request Co' });
    mockAdminClient.mockReturnValue(fake.client);
    mockSession.mockResolvedValue(sessionFor('one-req-co'));
    const params = Promise.resolve({ subdomain: 'one-req-co' });

    const meta = await tenantGenerateMetadata({ params });
    expect(meta.title).toMatchObject({ default: 'One Request Co' });

    const layoutJsx = await TenantLayout({
      params,
      children: React.createElement('div', null, 'content'),
    });
    expect(React.isValidElement(layoutJsx)).toBe(true);

    const pageJsx = await TenantIndexPage({ params });
    expect(React.isValidElement(pageJsx)).toBe(true);

    // Three resolver call sites, one underlying Supabase lookup.
    expect(fake.maybeSingle).toHaveBeenCalledTimes(1);
  });
});
