import type { Metadata } from 'next';
import { buildTenantApiPath } from '@/lib/api';
import { PromptListResponseSchema } from '@/lib/api/schemas/prompts';
import { DataHydration } from '@/lib/data/provider';
import { queryKeys } from '@/lib/data/query-keys';
import {
  createServerQueryClient,
  prefetchServerQueries,
  serverApiFetch,
} from '@/lib/data/server';
import { PromptLibrarySurface } from '@/components/prompts/prompt-library-surface';

export const metadata: Metadata = { title: 'Prompt Library' };

export default async function TenantPromptLibraryPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;

  // Server-first (spec 137 §3.2.4): prefetch the prompt list into a
  // throwaway server QueryClient and dehydrate it; the surface island
  // reads from the cache — no fetch-on-mount.
  const queryClient = createServerQueryClient(subdomain);
  const state = await prefetchServerQueries(queryClient, [
    {
      queryKey: queryKeys.tenant(subdomain).prompts.list,
      queryFn: () =>
        serverApiFetch(buildTenantApiPath(subdomain, '/prompts'), {
          schema: PromptListResponseSchema,
        }),
    },
  ]);

  return (
    <DataHydration state={state}>
      <PromptLibrarySurface subdomain={subdomain} />
    </DataHydration>
  );
}
