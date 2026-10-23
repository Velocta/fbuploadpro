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
import { toMediaFolder } from '@/components/media/media-data';
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
  // reads the folders from the cache — no mount fetch-on-mount. The
  // cached shape is the canonical `MediaFolder[]` array (the same
  // mapping the Media Library's prefetch applies) — never the folders
  // envelope, which collided with the library's shape on the shared
  // key (PR-140-5, bug #2).
  const queryClient = createServerQueryClient(subdomain);
  const state = await prefetchServerQueries(queryClient, [
    {
      queryKey: queryKeys.tenant(subdomain).media.folders,
      queryFn: async () => {
        const data = await serverApiFetch(
          buildTenantApiPath(subdomain, '/media/folders'),
          {
            schema: FolderListResponseSchema,
          }
        );
        return data.folders.map(toMediaFolder);
      },
    },
  ]);

  return (
    <DataHydration state={state}>
      <DownloaderSurface subdomain={subdomain} />
    </DataHydration>
  );
}
