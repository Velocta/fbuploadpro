'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  QueryClient,
  QueryObserver,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  deduplicateBatchUrls,
  type DownloaderSourcePlatform,
  type MediaFolder,
  type MediaItemResponse,
} from '@fbuploadpro/contracts';
import { apiFetch, buildTenantApiPath, isApiError } from '@/lib/api';
import {
  FolderListResponseSchema,
  MediaFolderSchema,
  MediaItemSchema,
} from '@/lib/api/schemas/media';
import {
  DownloaderIngestResponseSchema,
  DownloaderJobPollResponseSchema,
  DownloaderRecentJobsResponseSchema,
  type DownloaderJob,
  type DownloaderJobPollResponse,
} from '@/lib/api/schemas/downloader';
import { queryKeys } from '@/lib/data/query-keys';
import {
  DEFAULT_DOWNLOADS_FOLDER_NAME,
  findRootDownloadsFolder,
  makeFailedId,
} from './media-downloader-helpers';

/**
 * Downloader data module (spec 140 §5, PR-140-1).
 *
 * Owns every network flow of the downloader surface on the spec-137
 * platform: the typed API client + React Query. The batch orchestration
 * that used to live in `media-downloader-engine.ts` is re-homed here as
 * a mutation-driven flow with its behaviour preserved (§3 contract),
 * amended by OD-140-1: execution runs up to 3 item flows concurrently
 * while presentation order, per-item progress and abort/failure
 * isolation stay exactly as before. Job polling is a React Query
 * interval query (1.5s cadence, 60-poll cap, same terminal states).
 */

export interface DownloaderBatchProgressState {
  status: 'idle' | 'downloading' | 'completed' | 'cancelled';
  totalLinks: number;
  completedLinks: number;
  currentUrl: string | null;
  duplicateCount: number;
  invalidCount: number;
  stage?: 'resolving' | 'streaming' | undefined;
  stagePercent?: number | undefined;
}

export interface DownloaderFailedEntry {
  id: string;
  url: string;
  folderId: string | null;
  errorMessage: string;
}

export interface DownloaderSavedEntry {
  item: MediaItemResponse;
  sourceUrl: string;
  platform: DownloaderSourcePlatform;
}

export interface InitializeDownloaderFoldersResult {
  folders: MediaFolder[];
  selectedFolderId: string | null;
  createdDefaultFolder: boolean;
}

/** Delay between download job polls (gives the backend time to progress). */
const DOWNLOAD_POLL_INTERVAL_MS = 1500;
/** Poll cap per job before the item is surfaced as timed out. */
const DOWNLOAD_MAX_POLLS = 60;
/** OD-140-1: batch execution concurrency — never more than 3 in flight. */
const BATCH_CONCURRENCY = 3;

/**
 * The typed client surfaces the server's own message when the error body
 * carried one; when it did not, its message is the generic
 * `Request failed with status …` — in that case the surface's own
 * fallback copy applies (preserved verbatim from the legacy engine).
 */
function serverMessageOr(error: unknown, fallback: string): string {
  if (
    isApiError(error) &&
    error.kind === 'http' &&
    !error.message.startsWith('Request failed with status')
  ) {
    return error.message;
  }
  return fallback;
}

function isAbortLike(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return isApiError(error) && error.kind === 'aborted';
}

/* ------------------------------------------------------------------ */
/* Folders                                                             */
/* ------------------------------------------------------------------ */

/**
 * Fetches existing workspace folders and selects the root-level
 * "Downloads" folder. If no root-level "Downloads" folder exists yet,
 * automatically provisions it (409 race → re-list and select the
 * match). `knownFolders` lets the query-driven caller skip the initial
 * list call when it already holds the list.
 */
export async function initializeDownloaderFolders(params: {
  subdomain: string;
  fetchImpl?: typeof fetch;
  knownFolders?: MediaFolder[];
}): Promise<InitializeDownloaderFoldersResult> {
  const { subdomain, fetchImpl } = params;
  const foldersPath = buildTenantApiPath(subdomain, '/media/folders');

  let folders: MediaFolder[] = params.knownFolders ?? [];
  if (params.knownFolders === undefined) {
    try {
      const data = await apiFetch(foldersPath, {
        schema: FolderListResponseSchema,
        ...(fetchImpl ? { fetchFn: fetchImpl } : {}),
      });
      folders = data.folders;
    } catch {
      // Keep All Media root fallback if the list cannot be loaded
      folders = [];
    }
  }

  const existingDownloads = findRootDownloadsFolder(folders);
  if (existingDownloads) {
    return {
      folders,
      selectedFolderId: existingDownloads.id,
      createdDefaultFolder: false,
    };
  }

  try {
    const createdFolder = await apiFetch(foldersPath, {
      method: 'POST',
      body: {
        name: DEFAULT_DOWNLOADS_FOLDER_NAME,
        parentId: null,
      },
      schema: MediaFolderSchema,
      ...(fetchImpl ? { fetchFn: fetchImpl } : {}),
    });
    return {
      folders: [...folders, createdFolder],
      selectedFolderId: createdFolder.id,
      createdDefaultFolder: true,
    };
  } catch (createError) {
    if (isApiError(createError) && createError.status === 409) {
      const retryData = await apiFetch(foldersPath, {
        schema: FolderListResponseSchema,
        ...(fetchImpl ? { fetchFn: fetchImpl } : {}),
      }).catch(() => null);
      if (retryData) {
        const refreshedFolders = retryData.folders;
        const matched = findRootDownloadsFolder(refreshedFolders);
        return {
          folders: refreshedFolders,
          selectedFolderId: matched ? matched.id : null,
          createdDefaultFolder: false,
        };
      }
    }
    return {
      folders,
      selectedFolderId: null,
      createdDefaultFolder: false,
    };
  }
}

/**
 * Creates a new destination folder inline from the Downloader and
 * returns the updated folder list along with the newly created
 * folder's ID so it is immediately selected.
 */
export async function createDownloaderFolder(params: {
  subdomain: string;
  name: string;
  parentId: string | null;
  existingFolders: MediaFolder[];
  fetchImpl?: typeof fetch;
}): Promise<{
  folder: MediaFolder;
  folders: MediaFolder[];
  selectedFolderId: string;
}> {
  const { subdomain, name, parentId, existingFolders, fetchImpl } = params;
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Please enter a folder name.');
  }

  let createdFolder: MediaFolder;
  try {
    createdFolder = await apiFetch(
      buildTenantApiPath(subdomain, '/media/folders'),
      {
        method: 'POST',
        body: {
          name: trimmedName,
          parentId,
        },
        schema: MediaFolderSchema,
        ...(fetchImpl ? { fetchFn: fetchImpl } : {}),
      }
    );
  } catch (error) {
    throw new Error(
      serverMessageOr(error, 'Could not create folder. Please try a different name.')
    );
  }

  const updatedFolders = [...existingFolders, createdFolder];
  return {
    folder: createdFolder,
    folders: updatedFolders,
    selectedFolderId: createdFolder.id,
  };
}

/* ------------------------------------------------------------------ */
/* Batch execution                                                     */
/* ------------------------------------------------------------------ */

export interface ExecuteDownloaderBatchOptions {
  subdomain: string;
  rawInput: string;
  folderId: string | null;
  onProgress?: (state: DownloaderBatchProgressState) => void;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Injected by `useDownloaderBatch`; a throwaway client is used otherwise. */
  queryClient?: QueryClient;
}

export interface ExecuteDownloaderBatchResult {
  savedEntries: DownloaderSavedEntry[];
  failedEntries: DownloaderFailedEntry[];
  duplicateCount: number;
  invalidUrls: string[];
}

interface ItemOutcome {
  saved: DownloaderSavedEntry[];
  failed: DownloaderFailedEntry | null;
}

function createCancelledOutcome(
  idx: number,
  url: string,
  folderId: string | null
): ItemOutcome {
  return {
    saved: [],
    failed: {
      id: makeFailedId(idx),
      url,
      folderId,
      errorMessage: 'Download was cancelled.',
    },
  };
}

function createFailedOutcome(
  idx: number,
  url: string,
  folderId: string | null,
  errorMessage: string
): ItemOutcome {
  return {
    saved: [],
    failed: {
      id: makeFailedId(idx),
      url,
      folderId,
      errorMessage,
    },
  };
}

async function fetchJobMediaItem(params: {
  subdomain: string;
  job: DownloaderJob;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<DownloaderSavedEntry[]> {
  const { subdomain, job, fetchImpl, signal } = params;
  if (!job.media_id) return [];
  try {
    const body = await apiFetch(
      buildTenantApiPath(subdomain, `/media/${job.media_id}`),
      {
        ...(fetchImpl ? { fetchFn: fetchImpl } : {}),
        ...(signal ? { signal } : {}),
      }
    );
    // The media GET returns the bare item object (the legacy engine's
    // `mediaData?.item ?? mediaData` fallback existed for this) — accept
    // the bare item, tolerating an { item } envelope, and validate.
    const candidate =
      body !== null && typeof body === 'object' && 'item' in body
        ? (body as { item: unknown }).item
        : body;
    const parsed = MediaItemSchema.safeParse(candidate);
    if (!parsed.success) return [];
    return [
      {
        item: parsed.data,
        sourceUrl: job.source_url,
        platform: job.source_platform,
      },
    ];
  } catch {
    return [];
  }
}

function getPollErrorMessage(status: number): string {
  if (status === 404) {
    return 'Download job not found or expired.';
  }
  return 'Authentication error while checking download status.';
}

function isPermanentAuthOrNotFoundError(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

/**
 * Polls one accepted download job to its terminal state through a React
 * Query interval query (1.5s cadence — the engine's hand-rolled loop is
 * gone). Stage changes, terminal outcomes and the 60-poll timeout are
 * the engine's, preserved verbatim.
 */
async function pollDownloadJobCompletion(params: {
  queryClient: QueryClient;
  subdomain: string;
  jobId: string;
  url: string;
  idx: number;
  folderId: string | null;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onStageChange?: (stage: 'resolving' | 'streaming', percent?: number) => void;
}): Promise<ItemOutcome> {
  const { queryClient, subdomain, jobId, url, idx, folderId, fetchImpl, signal } =
    params;

  if (signal?.aborted) {
    return createCancelledOutcome(idx, url, folderId);
  }

  return new Promise<ItemOutcome>((resolve) => {
    let settled = false;
    let terminalStarted = false;
    let pollCount = 0;
    let lastDataUpdatedAt = 0;

    const observer = new QueryObserver<DownloaderJobPollResponse>(queryClient, {
      queryKey: queryKeys.tenant(subdomain).downloader.job(jobId),
      queryFn: async () => {
        pollCount += 1;
        return apiFetch(buildTenantApiPath(subdomain, '/downloader'), {
          schema: DownloaderJobPollResponseSchema,
          query: { jobId },
          ...(fetchImpl ? { fetchFn: fetchImpl } : {}),
        });
      },
      refetchInterval: DOWNLOAD_POLL_INTERVAL_MS,
      retry: false,
      staleTime: 0,
    });

    const finish = (outcome: ItemOutcome) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      signal?.removeEventListener('abort', handleAbort);
      resolve(outcome);
    };

    const handleAbort = () => {
      finish(createCancelledOutcome(idx, url, folderId));
    };

    const timeoutOutcome = (): ItemOutcome => ({
      saved: [],
      failed: {
        id: `timeout-${jobId}`,
        url,
        folderId,
        errorMessage:
          'Download timed out while waiting for the file. Please try again.',
      },
    });

    const unsubscribe = observer.subscribe((result) => {
      if (settled) return;
      if (signal?.aborted) {
        finish(createCancelledOutcome(idx, url, folderId));
        return;
      }

      if (result.isError) {
        const error = result.error;
        if (
          isApiError(error) &&
          error.status !== undefined &&
          isPermanentAuthOrNotFoundError(error.status)
        ) {
          finish(
            createFailedOutcome(idx, url, folderId, getPollErrorMessage(error.status))
          );
          return;
        }
        if (pollCount >= DOWNLOAD_MAX_POLLS) {
          finish(timeoutOutcome());
        }
        return;
      }

      if (!result.isSuccess || result.dataUpdatedAt === lastDataUpdatedAt) {
        return;
      }
      lastDataUpdatedAt = result.dataUpdatedAt;
      const job = result.data.job;

      if (job.status === 'processing') {
        const pct =
          typeof job.progress_percent === 'number' ? job.progress_percent : 0;
        params.onStageChange?.(pct > 0 ? 'streaming' : 'resolving', pct);
        if (pollCount >= DOWNLOAD_MAX_POLLS) {
          finish(timeoutOutcome());
        }
        return;
      }

      if (job.status === 'completed') {
        if (terminalStarted) return;
        terminalStarted = true;
        void fetchJobMediaItem({
          subdomain,
          job,
          ...(fetchImpl ? { fetchImpl } : {}),
          ...(signal ? { signal } : {}),
        }).then((saved) => finish({ saved, failed: null }));
        return;
      }

      if (job.status === 'failed') {
        finish(
          createFailedOutcome(
            idx,
            url,
            folderId,
            job.error_message || 'Could not save media from this link.'
          )
        );
        return;
      }

      if (pollCount >= DOWNLOAD_MAX_POLLS) {
        finish(timeoutOutcome());
      }
    });

    signal?.addEventListener('abort', handleAbort);
    if (signal?.aborted) {
      handleAbort();
    }
  });
}

function isJobAcceptedBody(body: unknown): body is { job: { id: string } } {
  if (body === null || typeof body !== 'object') return false;
  const job = (body as { job?: unknown }).job;
  if (job === null || typeof job !== 'object') return false;
  return typeof (job as { id?: unknown }).id === 'string';
}

async function processSingleBatchUrl(params: {
  queryClient: QueryClient;
  subdomain: string;
  url: string;
  idx: number;
  folderId: string | null;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onStageChange?: (stage: 'resolving' | 'streaming', percent?: number) => void;
}): Promise<ItemOutcome> {
  const { subdomain, url, idx, folderId, fetchImpl, signal } = params;
  try {
    const body = await apiFetch(buildTenantApiPath(subdomain, '/downloader'), {
      method: 'POST',
      body: {
        url,
        folderId,
      },
      ...(fetchImpl ? { fetchFn: fetchImpl } : {}),
      ...(signal ? { signal } : {}),
    });

    if (isJobAcceptedBody(body)) {
      return pollDownloadJobCompletion({
        queryClient: params.queryClient,
        subdomain,
        jobId: body.job.id,
        url,
        idx,
        folderId,
        ...(fetchImpl ? { fetchImpl } : {}),
        ...(signal ? { signal } : {}),
        ...(params.onStageChange ? { onStageChange: params.onStageChange } : {}),
      });
    }

    const parsed = DownloaderIngestResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error('Unexpected downloader ingest response shape.');
    }
    return {
      saved: parsed.data.items.map((item) => ({
        item,
        sourceUrl: parsed.data.sourceUrl,
        platform: parsed.data.platform,
      })),
      failed: null,
    };
  } catch (error) {
    if (isAbortLike(error, signal)) {
      return createCancelledOutcome(idx, url, folderId);
    }
    if (
      isApiError(error) &&
      (error.kind === 'http' || error.kind === 'session-expired')
    ) {
      return createFailedOutcome(
        idx,
        url,
        folderId,
        serverMessageOr(
          error,
          'Could not save media from this link. Please check that the link is public.'
        )
      );
    }
    // Convert network transport error into a structured retryable failed entry
    return createFailedOutcome(
      idx,
      url,
      folderId,
      'Network connection interrupted while saving this link. Please retry.'
    );
  }
}

/**
 * Processes a single or multi-line batch of URLs, deduplicating
 * identical URLs in the batch and emitting unified progress updates.
 * Execution runs up to 3 item flows concurrently (OD-140-1); results
 * merge into the returned lists in batch order, each item keeps its own
 * progress reporting, and one item's failure never blocks or fails the
 * others. Returns all saved media items (including multi-item
 * carousels) and failed links.
 */
export async function executeDownloaderBatch(
  options: ExecuteDownloaderBatchOptions
): Promise<ExecuteDownloaderBatchResult> {
  const { subdomain, rawInput, folderId, onProgress, fetchImpl, signal } = options;
  const queryClient = options.queryClient ?? new QueryClient();
  const deduped = deduplicateBatchUrls(rawInput);
  const { urls, duplicateCount, invalidUrls } = deduped;

  const outcomes: Array<ItemOutcome | undefined> = new Array(urls.length);

  if (urls.length === 0) {
    return {
      savedEntries: [],
      failedEntries: [],
      duplicateCount,
      invalidUrls,
    };
  }

  onProgress?.({
    status: 'downloading',
    totalLinks: urls.length,
    completedLinks: 0,
    currentUrl: urls[0] ?? null,
    duplicateCount,
    invalidCount: invalidUrls.length,
    stage: 'resolving',
  });

  let nextIndex = 0;
  let completedLinks = 0;
  let cancelledEmitted = false;

  const emitCancelled = () => {
    if (cancelledEmitted) return;
    cancelledEmitted = true;
    onProgress?.({
      status: 'cancelled',
      totalLinks: urls.length,
      completedLinks,
      currentUrl: null,
      duplicateCount,
      invalidCount: invalidUrls.length,
    });
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      if (signal?.aborted) {
        emitCancelled();
        return;
      }
      const idx = nextIndex;
      nextIndex += 1;
      if (idx >= urls.length) return;
      const url = urls[idx]!;

      onProgress?.({
        status: 'downloading',
        totalLinks: urls.length,
        completedLinks,
        currentUrl: url,
        duplicateCount,
        invalidCount: invalidUrls.length,
        stage: 'resolving',
      });

      const outcome = await processSingleBatchUrl({
        queryClient,
        subdomain,
        url,
        idx,
        folderId,
        ...(fetchImpl ? { fetchImpl } : {}),
        ...(signal ? { signal } : {}),
        onStageChange: (stage, stagePercent) => {
          onProgress?.({
            status: 'downloading',
            totalLinks: urls.length,
            completedLinks,
            currentUrl: url,
            duplicateCount,
            invalidCount: invalidUrls.length,
            stage,
            ...(stagePercent !== undefined ? { stagePercent } : {}),
          });
        },
      });

      outcomes[idx] = outcome;
      completedLinks += 1;

      onProgress?.({
        status: completedLinks === urls.length ? 'completed' : 'downloading',
        totalLinks: urls.length,
        completedLinks,
        currentUrl: null,
        duplicateCount,
        invalidCount: invalidUrls.length,
      });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(BATCH_CONCURRENCY, urls.length) }, () => worker())
  );

  const savedEntries: DownloaderSavedEntry[] = [];
  const failedEntries: DownloaderFailedEntry[] = [];
  for (const outcome of outcomes) {
    if (!outcome) continue;
    savedEntries.push(...outcome.saved);
    if (outcome.failed) {
      failedEntries.push(outcome.failed);
    }
  }

  return {
    savedEntries,
    failedEntries,
    duplicateCount,
    invalidUrls,
  };
}

/**
 * Retries a previously failed download entry against
 * `POST /api/tenant/[subdomain]/downloader`.
 */
export async function retryFailedDownloadEntry(params: {
  subdomain: string;
  entry: DownloaderFailedEntry;
  targetFolderId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<{
  ok: boolean;
  savedEntries: DownloaderSavedEntry[];
  errorMessage?: string;
}> {
  const { subdomain, entry, targetFolderId, fetchImpl } = params;
  const folderId = targetFolderId !== undefined ? targetFolderId : entry.folderId;

  try {
    const body = await apiFetch(buildTenantApiPath(subdomain, '/downloader'), {
      method: 'POST',
      body: {
        url: entry.url,
        folderId,
      },
      ...(fetchImpl ? { fetchFn: fetchImpl } : {}),
    });

    const parsed = DownloaderIngestResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error('Unexpected downloader ingest response shape.');
    }
    return {
      ok: true,
      savedEntries: parsed.data.items.map((item) => ({
        item,
        sourceUrl: parsed.data.sourceUrl,
        platform: parsed.data.platform,
      })),
    };
  } catch (error) {
    if (
      isApiError(error) &&
      (error.kind === 'http' || error.kind === 'session-expired')
    ) {
      return {
        ok: false,
        savedEntries: [],
        errorMessage: serverMessageOr(
          error,
          'Could not save media from this link. Please try again.'
        ),
      };
    }
    // Convert network error into a user-safe retry failure result
    return {
      ok: false,
      savedEntries: [],
      errorMessage: 'Network connection interrupted while retrying this link.',
    };
  }
}

/* ------------------------------------------------------------------ */
/* Recent downloads (OD-140-2: hydrate from stored jobs on mount)      */
/* ------------------------------------------------------------------ */

export async function fetchRecentDownloaderEntries(params: {
  subdomain: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<{
  savedEntries: DownloaderSavedEntry[];
  failedEntries: DownloaderFailedEntry[];
}> {
  const { subdomain, fetchImpl, signal } = params;
  const data = await apiFetch(buildTenantApiPath(subdomain, '/downloader'), {
    schema: DownloaderRecentJobsResponseSchema,
    ...(fetchImpl ? { fetchFn: fetchImpl } : {}),
    ...(signal ? { signal } : {}),
  });

  const savedEntries: DownloaderSavedEntry[] = [];
  const failedEntries: DownloaderFailedEntry[] = [];

  for (const job of data.jobs) {
    if (job.status === 'completed' && job.media_id) {
      const saved = await fetchJobMediaItem({
        subdomain,
        job,
        ...(fetchImpl ? { fetchImpl } : {}),
        ...(signal ? { signal } : {}),
      });
      savedEntries.push(...saved);
    } else if (job.status === 'failed') {
      failedEntries.push({
        id: `job-${job.id}`,
        url: job.source_url,
        folderId: job.folder_id ?? null,
        errorMessage: job.error_message || 'Could not save media from this link.',
      });
    }
  }

  return { savedEntries, failedEntries };
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Folder list for the surface, backed by the shared media folders
 * query (server-prefetched by the route). When the list was not
 * supplied up front, the first successful load also performs the
 * §3.5 auto-provisioning: an existing root "Downloads" folder is
 * reported through `autoSelectedFolderId`; a missing one is created
 * and selected. Load failures fall back silently to All Media root.
 */
export function useDownloaderFolders(
  subdomain: string,
  options?: { initialFolders?: MediaFolder[] | undefined }
) {
  const queryClient = useQueryClient();
  const initialFolders = options?.initialFolders;
  const hasInitialFolders = initialFolders !== undefined;

  const foldersQuery = useQuery({
    queryKey: queryKeys.tenant(subdomain).media.folders,
    queryFn: async ({ signal }) =>
      apiFetch(buildTenantApiPath(subdomain, '/media/folders'), {
        schema: FolderListResponseSchema,
        signal,
      }),
    ...(hasInitialFolders
      ? {
          initialData: {
            folders: initialFolders,
            unorganizedCount: 0,
          },
        }
      : {}),
  });

  const [autoSelectedFolderId, setAutoSelectedFolderId] = useState<string | null>(
    null
  );
  const provisionStartedRef = useRef(false);

  useEffect(() => {
    if (hasInitialFolders) return;
    if (!foldersQuery.isSuccess || provisionStartedRef.current) return;
    const loadedFolders = foldersQuery.data.folders;
    const existing = findRootDownloadsFolder(loadedFolders);
    provisionStartedRef.current = true;
    if (existing) {
      setAutoSelectedFolderId(existing.id);
      return;
    }
    void initializeDownloaderFolders({
      subdomain,
      knownFolders: loadedFolders,
    })
      .then((result) => {
        if (result.createdDefaultFolder) {
          queryClient.setQueryData(queryKeys.tenant(subdomain).media.folders, {
            folders: result.folders,
            unorganizedCount: 0,
          });
        }
        if (result.selectedFolderId !== null) {
          setAutoSelectedFolderId(result.selectedFolderId);
        }
      })
      .catch(() => undefined);
  }, [
    hasInitialFolders,
    foldersQuery.isSuccess,
    foldersQuery.data,
    subdomain,
    queryClient,
  ]);

  return {
    folders: foldersQuery.data?.folders ?? [],
    autoSelectedFolderId,
  };
}

/** Folder creation as a mutation; refreshes the shared folders query. */
export function useCreateDownloaderFolder(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      parentId: string | null;
      existingFolders: MediaFolder[];
    }) =>
      createDownloaderFolder({
        subdomain,
        name: vars.name,
        parentId: vars.parentId,
        existingFolders: vars.existingFolders,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.tenant(subdomain).media.folders, {
        folders: result.folders,
        unorganizedCount: 0,
      });
    },
  });
}

/**
 * Batch + retry flows bound to the surface's QueryClient. On every
 * save, the media queries are invalidated (OD-140-3: this replaces the
 * legacy `fbuploadpro:download-completed` window event — no event is
 * dispatched) and the stored-jobs query is refreshed so the Recent
 * list stays coherent.
 */
export function useDownloaderBatch(subdomain: string) {
  const queryClient = useQueryClient();

  const invalidateAfterSave = useCallback(
    (savedCount: number) => {
      if (savedCount === 0) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(subdomain).media.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(subdomain).downloader.all,
      });
    },
    [queryClient, subdomain]
  );

  const execute = useCallback(
    async (
      options: Omit<ExecuteDownloaderBatchOptions, 'subdomain' | 'queryClient'>
    ) => {
      const result = await executeDownloaderBatch({
        ...options,
        subdomain,
        queryClient,
      });
      invalidateAfterSave(result.savedEntries.length);
      return result;
    },
    [queryClient, subdomain, invalidateAfterSave]
  );

  const retry = useCallback(
    async (params: {
      entry: DownloaderFailedEntry;
      targetFolderId?: string | null;
    }) => {
      const result = await retryFailedDownloadEntry({
        subdomain,
        entry: params.entry,
        ...(params.targetFolderId !== undefined
          ? { targetFolderId: params.targetFolderId }
          : {}),
      });
      if (result.ok) {
        invalidateAfterSave(result.savedEntries.length);
      }
      return result;
    },
    [subdomain, invalidateAfterSave]
  );

  return { execute, retry };
}

/** Stored jobs (latest 50) for the Recent Downloads hydration (OD-140-2). */
export function useRecentDownloaderJobs(subdomain: string) {
  return useQuery({
    queryKey: queryKeys.tenant(subdomain).downloader.jobs,
    queryFn: ({ signal }) => fetchRecentDownloaderEntries({ subdomain, signal }),
  });
}
