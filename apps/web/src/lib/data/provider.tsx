'use client';

/**
 * Data-layer provider (spec 137 §3.2.5) — mounts the one QueryClient
 * in the tenant layout and registers the global 401 handler there:
 * on `session-expired` the query cache is cleared and the browser is
 * sent to login exactly once (the handler + latch live in
 * `lib/api/session-expired`, PR-A1a; this provider is its one
 * registration site).
 *
 * `DataHydration` is the client half of the server-first hand-off
 * (spec §3.2.4): a route's server component prefetches with
 * `lib/data/server` and renders its client islands inside
 * `<DataHydration state={dehydrated}>` so they read the server data
 * from the cache instead of refetching on mount.
 */

import * as React from 'react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  HydrationBoundary,
  QueryClientProvider,
  type DehydratedState,
} from '@tanstack/react-query';
import {
  createSessionExpiredHandler,
  registerSessionExpiredHandler,
  resetSessionExpiredGuard,
} from '../api/session-expired';
import { createQueryClient } from './query-client';

export interface DataProviderProps {
  subdomain?: string | undefined;
  children: ReactNode;
}

export function DataProvider({ subdomain, children }: DataProviderProps) {
  const [queryClient] = useState(() => createQueryClient(subdomain));

  useEffect(() => {
    resetSessionExpiredGuard();
    const unregister = registerSessionExpiredHandler(
      createSessionExpiredHandler({
        clearCache: () => {
          queryClient.clear();
        },
      })
    );
    return unregister;
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export interface DataHydrationProps {
  state: DehydratedState;
  children: ReactNode;
}

export function DataHydration({ state, children }: DataHydrationProps) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
