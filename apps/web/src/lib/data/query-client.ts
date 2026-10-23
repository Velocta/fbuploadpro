/**
 * The one QueryClient (spec 137 §3.2.2).
 *
 * Defaults, specced — deviations are named at the call site, never by
 * quietly building a second client:
 * - `staleTime` by resource class: reference data (accounts, pages,
 *   settings, credentials status) 60s; queue data 15s (plus
 *   invalidation on every queue mutation); insights 5min.
 * - `refetchOnWindowFocus: true` for tenant data.
 * - Retries: queries 1, mutations 0.
 *
 * The class staleTimes are registered per tenant via
 * `setQueryDefaults` on the factory key prefixes (queue / insights);
 * everything else inherits the reference default.
 */

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

export const STALE_TIMES = {
  reference: 60_000,
  queue: 15_000,
  insights: 300_000,
} as const;

export type ResourceClass = keyof typeof STALE_TIMES;

export function createQueryClient(subdomain?: string): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIMES.reference,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  if (subdomain) {
    const tenant = queryKeys.tenant(subdomain);
    client.setQueryDefaults(tenant.queue.all, { staleTime: STALE_TIMES.queue });
    client.setQueryDefaults(tenant.insights.all, {
      staleTime: STALE_TIMES.insights,
    });
  }

  return client;
}
