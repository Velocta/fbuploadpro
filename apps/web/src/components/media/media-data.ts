'use client';

/**
 * Media Library data module (spec 133 §6.1 / PR-133-1).
 *
 * The surface's single data path: every list/folder read and every
 * mutation goes through the typed API client (`lib/api`) + React
 * Query (`lib/data`), replacing the deleted
 * `use-media-library-actions.ts` hook and its twelve raw `fetch(`
 * call sites. No component in the surface talks to the media API
 * directly any more (the import engine's app-API calls are PR-133-4).
 *
 * Invalidations are named per mutation (spec 137 §3.2 / spec 133 §6.1):
 *   - folder create / rename / delete / reparent -> folders + list
 *   - item move (reparent)                        -> folders + list
 *   - batch move / batch delete / batch caption    -> list
 *   - item caption update / item delete            -> list
 * Folder counts (itemCount / subfolderCount) live on the folders
 * query, so any mutation that can change a count invalidates both.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import {
  BatchMediaResponseSchema,
  CheckDuplicatesResponseSchema,
  DeleteFolderResponseSchema,
  DeleteMediaItemResponseSchema,
  FolderListResponseSchema,
  MediaFolderSchema,
  MediaItemSchema,
  MediaListResponseSchema,
  type BatchMediaResponse,
  type CheckDuplicatesResponse,
  type DeleteFolderResponse,
  type DeleteMediaItemResponse,
  type MediaFolder as ApiMediaFolder,
  type MediaItem as ApiMediaItem,
} from '@/lib/api/schemas/media';
import { queryKeys } from '@/lib/data/query-keys';
import type { BatchCaptionMode } from './media-types';

/** Initial-list scope (OD-133-2 default: preserve the legacy semantics). */
export const MEDIA_LIST_LIMIT = 500;

/* ------------------------------------------------------------------ */
/* Response mapping: lib/api schema types -> contracts surface types.  */
/* The two shapes are field-identical; the mapping is written out so   */
/* the surface never depends on that staying true by accident.         */
/* ------------------------------------------------------------------ */

export function toMediaItemResponse(item: ApiMediaItem): MediaItemResponse {
  return {
    id: item.id,
    userId: item.userId,
    folderId: item.folderId,
    name: item.name,
    fileSize: item.fileSize,
    mimeType: item.mimeType,
    mediaType: item.mediaType,
    storageKey: item.storageKey,
    url: item.url,
    thumbnailKey: item.thumbnailKey,
    thumbnailUrl: item.thumbnailUrl,
    durationSeconds: item.durationSeconds,
    aspectRatio: item.aspectRatio,
    captionText: item.captionText,
    ...(item.width !== undefined ? { width: item.width } : {}),
    ...(item.height !== undefined ? { height: item.height } : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function toMediaFolder(folder: ApiMediaFolder): MediaFolder {
  return {
    id: folder.id,
    userId: folder.userId,
    parentId: folder.parentId,
    name: folder.name,
    itemCount: folder.itemCount,
    subfolderCount: folder.subfolderCount,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Query definitions (shared by the hooks and the server prefetch).    */
/* ------------------------------------------------------------------ */

export function mediaListQuery(subdomain: string) {
  const tenant = queryKeys.tenant(subdomain);
  return {
    queryKey: tenant.media.list,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<MediaItemResponse[]> => {
      const data = await api.get(buildTenantApiPath(subdomain, '/media'), {
        schema: MediaListResponseSchema,
        query: { limit: MEDIA_LIST_LIMIT },
        signal,
      });
      return data.items.map(toMediaItemResponse);
    },
  };
}

export function mediaFoldersQuery(subdomain: string) {
  const tenant = queryKeys.tenant(subdomain);
  return {
    queryKey: tenant.media.folders,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<MediaFolder[]> => {
      const data = await api.get(buildTenantApiPath(subdomain, '/media/folders'), {
        schema: FolderListResponseSchema,
        signal,
      });
      return data.folders.map(toMediaFolder);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Invalidation helpers — the named invalidations, in one place.       */
/* ------------------------------------------------------------------ */

/** Invalidate the media list only (batch + item mutations). */
export function invalidateMediaList(client: QueryClient, subdomain: string): Promise<void> {
  return client.invalidateQueries({
    queryKey: queryKeys.tenant(subdomain).media.list,
  });
}

/** Invalidate folders + list (folder mutations; counts may change). */
export async function invalidateMediaFoldersAndList(
  client: QueryClient,
  subdomain: string
): Promise<void> {
  const tenant = queryKeys.tenant(subdomain);
  await Promise.all([
    client.invalidateQueries({ queryKey: tenant.media.folders }),
    client.invalidateQueries({ queryKey: tenant.media.list }),
  ]);
}

/** Invalidate the whole media subtree (manual refresh / upload success). */
export function invalidateMediaAll(client: QueryClient, subdomain: string): Promise<void> {
  return client.invalidateQueries({
    queryKey: queryKeys.tenant(subdomain).media.all,
  });
}

/* ------------------------------------------------------------------ */
/* Queries.                                                            */
/* ------------------------------------------------------------------ */

export interface MediaDataOptions {
  /** Seed for the first render (tests / server props); the server
   *  route hydrates the cache instead and passes nothing. */
  initialItems?: MediaItemResponse[] | undefined;
  initialFolders?: MediaFolder[] | undefined;
}

export function useMediaItems(subdomain: string, options: MediaDataOptions = {}) {
  const definition = mediaListQuery(subdomain);
  return useQuery({
    queryKey: definition.queryKey,
    queryFn: definition.queryFn,
    ...(options.initialItems !== undefined
      ? { initialData: options.initialItems }
      : {}),
  });
}

export function useMediaFolders(subdomain: string, options: MediaDataOptions = {}) {
  const definition = mediaFoldersQuery(subdomain);
  return useQuery({
    queryKey: definition.queryKey,
    queryFn: definition.queryFn,
    ...(options.initialFolders !== undefined
      ? { initialData: options.initialFolders }
      : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Duplicate check — the library-side single call path (spec §6.1).    */
/* Both library callers go through here; the import modal's staging    */
/* caller adopts it in PR-133-4. Failures throw `ApiError` — callers    */
/* decide how to present them; nothing is swallowed here.              */
/* ------------------------------------------------------------------ */

export interface DuplicateCheckEntry {
  clientKey: string;
  name: string;
  fileSize: number;
  folderId: string | null;
}

export function checkMediaDuplicates(
  subdomain: string,
  folderId: string | null,
  entries: DuplicateCheckEntry[],
  signal?: AbortSignal
): Promise<CheckDuplicatesResponse> {
  return api.post(buildTenantApiPath(subdomain, '/media/check-duplicates'), {
    folderId,
    entries,
  }, {
    schema: CheckDuplicatesResponseSchema,
    ...(signal ? { signal } : {}),
  });
}

/* ------------------------------------------------------------------ */
/* Mutations. Each hook names its invalidation in its `onSuccess`.     */
/* ------------------------------------------------------------------ */

/** Folder create — invalidates: folders + list. Returns the folder. */
export function useCreateFolder(subdomain: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      parentId: string | null;
    }): Promise<MediaFolder> => {
      const folder = await api.post(buildTenantApiPath(subdomain, '/media/folders'), {
        name: input.name,
        parentId: input.parentId,
      }, { schema: MediaFolderSchema });
      return toMediaFolder(folder);
    },
    onSuccess: () => invalidateMediaFoldersAndList(client, subdomain),
  });
}

/** Folder rename — invalidates: folders + list. */
export function useRenameFolder(subdomain: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { folderId: string; name: string }): Promise<MediaFolder> => {
      const folder = await api.patch(
        buildTenantApiPath(subdomain, `/media/folders/${input.folderId}`),
        { name: input.name },
        { schema: MediaFolderSchema }
      );
      return toMediaFolder(folder);
    },
    onSuccess: () => invalidateMediaFoldersAndList(client, subdomain),
  });
}

/** Folder delete — invalidates: folders + list. */
export function useDeleteFolder(subdomain: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (folderId: string): Promise<DeleteFolderResponse> =>
      api.delete(buildTenantApiPath(subdomain, `/media/folders/${folderId}`), {
        schema: DeleteFolderResponseSchema,
      }),
    onSuccess: () => invalidateMediaFoldersAndList(client, subdomain),
  });
}

/** Move/reparent a single item or a folder — invalidates: folders + list. */
export function useReparentMedia(subdomain: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      targetFolderId: string | null;
      mediaId?: string | undefined;
      folderId?: string | undefined;
    }): Promise<void> => {
      if (input.mediaId) {
        await api.patch(
          buildTenantApiPath(subdomain, `/media/${input.mediaId}`),
          { folderId: input.targetFolderId },
          { schema: MediaItemSchema }
        );
        return;
      }
      if (input.folderId) {
        await api.patch(
          buildTenantApiPath(subdomain, `/media/folders/${input.folderId}`),
          { parentId: input.targetFolderId },
          { schema: MediaFolderSchema }
        );
      }
    },
    onSuccess: () => invalidateMediaFoldersAndList(client, subdomain),
  });
}

/** Item caption update — invalidates: list. Optimistic: the legacy
 *  surface updated the caption in place without a refetch; the cache
 *  update + rollback below preserves exactly that behaviour. */
export function useUpdateItemCaption(subdomain: string) {
  const client = useQueryClient();
  const listKey = queryKeys.tenant(subdomain).media.list;
  return useMutation({
    mutationFn: async (input: {
      mediaId: string;
      captionText: string;
    }): Promise<MediaItemResponse> => {
      const item = await api.patch(
        buildTenantApiPath(subdomain, `/media/${input.mediaId}`),
        { captionText: input.captionText },
        { schema: MediaItemSchema }
      );
      return toMediaItemResponse(item);
    },
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: listKey });
      const previous = client.getQueryData<MediaItemResponse[]>(listKey);
      client.setQueryData<MediaItemResponse[]>(listKey, (prev) =>
        (prev ?? []).map((m) =>
          m.id === input.mediaId ? { ...m, captionText: input.captionText } : m
        )
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        client.setQueryData(listKey, context.previous);
      }
    },
    onSuccess: () => invalidateMediaList(client, subdomain),
  });
}

/** Item delete — invalidates: list. */
export function useDeleteMediaItem(subdomain: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: string): Promise<DeleteMediaItemResponse> =>
      api.delete(buildTenantApiPath(subdomain, `/media/${mediaId}`), {
        schema: DeleteMediaItemResponseSchema,
      }),
    onSuccess: () => invalidateMediaList(client, subdomain),
  });
}

/** Batch delete — invalidates: list. */
export function useBatchDeleteMedia(subdomain: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (mediaIds: string[]): Promise<BatchMediaResponse> =>
      api.post(buildTenantApiPath(subdomain, '/media/batch'), {
        action: 'delete',
        mediaIds,
      }, { schema: BatchMediaResponseSchema }),
    onSuccess: () => invalidateMediaList(client, subdomain),
  });
}

/** Batch move — invalidates: folders + list (destination counts change). */
export function useBatchMoveMedia(subdomain: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mediaIds: string[];
      folderId: string | null;
    }): Promise<BatchMediaResponse> =>
      api.post(buildTenantApiPath(subdomain, '/media/batch'), {
        action: 'move',
        mediaIds: input.mediaIds,
        folderId: input.folderId,
      }, { schema: BatchMediaResponseSchema }),
    onSuccess: () => invalidateMediaFoldersAndList(client, subdomain),
  });
}

/** Batch caption — the legacy surface PATCHed each item individually
 *  (append needs the existing caption per item); semantics preserved.
 *  Invalidates: list. Throws when any item fails, after all settle. */
export function useBatchCaptionMedia(subdomain: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      mediaIds: string[];
      items: MediaItemResponse[];
      text: string;
      mode: BatchCaptionMode;
    }): Promise<void> => {
      const results = await Promise.allSettled(
        input.mediaIds.map(async (id) => {
          const existing = input.items.find((m) => m.id === id);
          const newCaption =
            input.mode === 'append' && existing?.captionText
              ? `${existing.captionText}\n${input.text}`
              : input.text;
          await api.patch(
            buildTenantApiPath(subdomain, `/media/${id}`),
            { captionText: newCaption },
            { schema: MediaItemSchema }
          );
        })
      );
      const failed = results.find((r) => r.status === 'rejected');
      if (failed) {
        throw failed.reason;
      }
    },
    onSuccess: () => invalidateMediaList(client, subdomain),
  });
}
