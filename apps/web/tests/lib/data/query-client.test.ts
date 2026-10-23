import { describe, expect, it } from 'vitest';
import { createQueryClient, STALE_TIMES } from '@/lib/data/query-client';
import { queryKeys } from '@/lib/data/query-keys';

describe('createQueryClient (spec 137 §3.2.2)', () => {
  it('exposes the specced staleTime classes', () => {
    expect(STALE_TIMES).toEqual({ reference: 60_000, queue: 15_000, insights: 300_000 });
  });

  it('applies the reference defaults: staleTime 60s, focus refetch on, retries 1/0', () => {
    const client = createQueryClient('acme');
    const queries = client.getDefaultOptions().queries;
    expect(queries?.staleTime).toBe(60_000);
    expect(queries?.refetchOnWindowFocus).toBe(true);
    expect(queries?.retry).toBe(1);
    expect(client.getDefaultOptions().mutations?.retry).toBe(0);
  });

  it('registers the queue (15s) and insights (5min) staleTimes per tenant', () => {
    const client = createQueryClient('acme');
    const tenant = queryKeys.tenant('acme');
    expect(client.getQueryDefaults(tenant.queue.all).staleTime).toBe(15_000);
    expect(client.getQueryDefaults(tenant.queue.items('p1')).staleTime).toBe(15_000);
    expect(client.getQueryDefaults(tenant.insights.all).staleTime).toBe(300_000);
    expect(client.getQueryDefaults(tenant.insights.page('p1', '28d')).staleTime).toBe(300_000);
    // Reference-class keys keep the 60s default (no per-key override).
    expect(client.getQueryDefaults(tenant.pages.list).staleTime).toBeUndefined();
    expect(client.getQueryDefaults(tenant.accounts.list).staleTime).toBeUndefined();
  });

  it('does not leak one tenant’s class defaults into another tenant', () => {
    const client = createQueryClient('acme');
    const other = queryKeys.tenant('globex');
    expect(client.getQueryDefaults(other.queue.all).staleTime).toBeUndefined();
  });

  it('works without a subdomain (bare defaults) and returns a fresh client per call', () => {
    const a = createQueryClient();
    const b = createQueryClient();
    expect(a).not.toBe(b);
    expect(a.getDefaultOptions().queries?.staleTime).toBe(60_000);
    const tenant = queryKeys.tenant('acme');
    expect(a.getQueryDefaults(tenant.queue.all).staleTime).toBeUndefined();
  });
});
