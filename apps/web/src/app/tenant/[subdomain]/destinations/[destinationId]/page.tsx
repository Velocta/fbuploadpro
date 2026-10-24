/**
 * Dedicated-section landing for a destination (Spec 123, Part C) —
 * rebuilt as the unified destination frame (spec 131 PR-131-4, §1.3).
 *
 * Routing contract: /tenant/[subdomain]/destinations/[destinationId]
 * loads the destination + its owning account from
 *   GET /api/tenant/[subdomain]/accounts/social/[destinationId]
 *
 * Server-first (spec §8.1): the destination is prefetched here in the
 * server component through the cookie-forwarding typed client and
 * dehydrated into the React Query cache the frame shell reads — the
 * former client fetch-on-mount and its `loadDestinationDetail` helper
 * are deleted; the helper's two error strings live on in the frame's
 * error path, verbatim (spec §6.3). `prefetchServerQueries` never
 * throws — a failed prefetch leaves the key out and the shell's query
 * fetches on mount, where its error state renders.
 */
import * as React from 'react';

import { buildTenantApiPath } from '@/lib/api/client';
import { DestinationDetailResponseSchema } from '@/lib/api/schemas/connect';
import { DataHydration, queryKeys } from '@/lib/data';
import {
  createServerQueryClient,
  prefetchServerQueries,
  serverApiFetch,
} from '@/lib/data/server';

import DestinationLoading from './loading';
import { DestinationFrame } from './destination-frame';

export { DestinationSummary } from './destination-frame';

interface DestinationSectionPageProps {
  params: Promise<{ subdomain: string; destinationId: string }>;
}

export default async function DestinationSectionPage({
  params,
}: Readonly<DestinationSectionPageProps>) {
  const { subdomain, destinationId } = await params;
  const tenant = queryKeys.tenant(subdomain);

  const queryClient = createServerQueryClient(subdomain);
  const state = await prefetchServerQueries(queryClient, [
    {
      queryKey: tenant.destinations.detail(destinationId),
      queryFn: () =>
        serverApiFetch(
          buildTenantApiPath(subdomain, `/accounts/social/${destinationId}`),
          { schema: DestinationDetailResponseSchema }
        ),
    },
  ]);

  return (
    <DataHydration state={state}>
      <React.Suspense fallback={<DestinationLoading />}>
        <DestinationFrame subdomain={subdomain} destinationId={destinationId} />
      </React.Suspense>
    </DataHydration>
  );
}
