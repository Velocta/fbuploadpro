import type { Metadata } from 'next';
import { buildTenantApiPath } from '@/lib/api';
import { FolderListResponseSchema } from '@/lib/api/schemas/media';
import { DataHydration } from '@/lib/data/provider';
import { queryKeys } from '@/lib/data/query-keys';
import {
  createServerQueryClient,
  prefetchServerQueries,
  serverApiFetch,
} from '@/lib/data/server';
import { DownloaderSurface } from '@/components/downloader/downloader-surface';

export const metadata: Metadata = { title: 'Media Downloader' };

export default async function TenantMediaDownloaderPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;

  // Server-first (spec 137 §3.2.4): prefetch the folder list into a
  // throwaway server QueryClient and dehydrate it; the surface island
  // reads the folders from the cache — no mount fetch-on-mount.
  const queryClient = createServerQueryClient(subdomain);
  const state = await prefetchServerQueries(queryClient, [
    {
      queryKey: queryKeys.tenant(subdomain).media.folders,
      queryFn: () =>
        serverApiFetch(buildTenantApiPath(subdomain, '/media/folders'), {
          schema: FolderListResponseSchema,
        }),
    },
  ]);

  return (
    <DataHydration state={state}>
      <DownloaderSurface subdomain={subdomain} />
    </DataHydration>
  );
}
