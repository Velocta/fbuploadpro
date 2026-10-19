'use client';

import {
  deduplicateBatchUrls,
  type DownloaderIngestResponse,
} from '@fbuploadpro/contracts';
import type {
  DownloaderBatchProgressState,
  DownloaderFailedEntry,
  DownloaderSavedEntry,
} from './media-downloader';
import { makeFailedId } from './media-downloader-helpers';

/**
 * Async download engine for the media downloader, extracted from
 * media-downloader.tsx. No behavior changes — moved verbatim.
 */
export interface ExecuteDownloaderBatchOptions {
  subdomain: string;
  rawInput: string;
  folderId: string | null;
  onProgress?: (state: DownloaderBatchProgressState) => void;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface ExecuteDownloaderBatchResult {
  savedEntries: DownloaderSavedEntry[];
  failedEntries: DownloaderFailedEntry[];
  duplicateCount: number;
  invalidUrls: string[];
}

async function extractApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const errJson = (await res.json()) as { message?: string };
    return errJson.message ? errJson.message : fallback;
  } catch {
    // Response was not valid JSON; return human-friendly fallback message
    return fallback;
  }
}

function createCancelledOutcome(idx: number, url: string, folderId: string | null) {
  return {
    saved: [] as DownloaderSavedEntry[],
    failed: {
      id: makeFailedId(idx),
      url,
      folderId,
      errorMessage: 'Download was cancelled.',
    },
  };
}

async function fetchJobMediaItem(
  subdomain: string,
  job: any,
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<DownloaderSavedEntry[]> {
  if (!job?.media_id) return [];
  try {
    const mediaRes = await fetchImpl(
      `/api/tenant/${subdomain}/media/${job.media_id}`,
      signal ? { signal } : {}
    );
    if (!mediaRes.ok) return [];
    const mediaData = await mediaRes.json();
    return [
      {
        item: mediaData?.item ?? mediaData,
        sourceUrl: job.source_url,
        platform: job.source_platform,
      },
    ];
  } catch {
    return [];
  }
}

async function evaluatePollJobStatus(
  job: any,
  params: {
    subdomain: string;
    url: string;
    idx: number;
    folderId: string | null;
    fetchImpl: typeof fetch;
    signal?: AbortSignal;
    onStageChange?: (stage: 'resolving' | 'streaming', percent?: number) => void;
  }
): Promise<{ finished: boolean; outcome?: { saved: DownloaderSavedEntry[]; failed: DownloaderFailedEntry | null } }> {
  if (job?.status === 'processing') {
    const pct = typeof job.progress_percent === 'number' ? job.progress_percent : 0;
    params.onStageChange?.(pct > 0 ? 'streaming' : 'resolving', pct);
    return { finished: false };
  }

  if (job?.status === 'completed') {
    const saved = await fetchJobMediaItem(params.subdomain, job, params.fetchImpl, params.signal);
    return { finished: true, outcome: { saved, failed: null } };
  }

  if (job?.status === 'failed') {
    return {
      finished: true,
      outcome: {
        saved: [],
        failed: {
          id: makeFailedId(params.idx),
          url: params.url,
          folderId: params.folderId,
          errorMessage: job.error_message || 'Could not save media from this link.',
        },
      },
    };
  }

  return { finished: false };
}

function isPermanentAuthOrNotFoundError(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

async function executeSinglePoll(
  subdomain: string,
  jobId: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<{ status: number; ok: boolean; data?: any } | 'aborted'> {
  try {
    const pollRes = await fetchImpl(
      `/api/tenant/${subdomain}/downloader?jobId=${jobId}`,
      signal ? { signal } : {}
    );
    if (isPermanentAuthOrNotFoundError(pollRes.status)) {
      return { status: pollRes.status, ok: false };
    }
    if (!pollRes.ok) {
      return { status: pollRes.status, ok: false };
    }
    const data = await pollRes.json();
    return { status: pollRes.status, ok: true, data };
  } catch (err: any) {
    if (signal?.aborted || err?.name === 'AbortError') {
      return 'aborted';
    }
    return { status: 0, ok: false };
  }
}

function getPollErrorMessage(status: number): string {
  if (status === 404) {
    return 'Download job not found or expired.';
  }
  return 'Authentication error while checking download status.';
}

interface PollIterationOutcome {
  done: boolean;
  outcome?: { saved: DownloaderSavedEntry[]; failed: DownloaderFailedEntry | null };
}

async function handlePollIteration(params: {
  subdomain: string;
  jobId: string;
  url: string;
  idx: number;
  folderId: string | null;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  onStageChange?: (stage: 'resolving' | 'streaming', percent?: number) => void;
}): Promise<PollIterationOutcome> {
  const { subdomain, jobId, url, idx, folderId, fetchImpl, signal } = params;

  if (signal?.aborted) {
    return { done: true, outcome: createCancelledOutcome(idx, url, folderId) };
  }

  await new Promise((r) => setTimeout(r, 1500));

  if (signal?.aborted) {
    return { done: true, outcome: createCancelledOutcome(idx, url, folderId) };
  }

  const pollResult = await executeSinglePoll(subdomain, jobId, fetchImpl, signal);
  if (pollResult === 'aborted') {
    return { done: true, outcome: createCancelledOutcome(idx, url, folderId) };
  }

  if (isPermanentAuthOrNotFoundError(pollResult.status)) {
    return {
      done: true,
      outcome: {
        saved: [],
        failed: {
          id: makeFailedId(idx),
          url,
          folderId,
          errorMessage: getPollErrorMessage(pollResult.status),
        },
      },
    };
  }

  if (!pollResult.ok || !pollResult.data?.job) {
    return { done: false };
  }

  const evaluation = await evaluatePollJobStatus(pollResult.data.job, params);
  if (evaluation.finished && evaluation.outcome) {
    return { done: true, outcome: evaluation.outcome };
  }

  return { done: false };
}

async function pollDownloadJobCompletion(params: {
  subdomain: string;
  jobId: string;
  url: string;
  idx: number;
  folderId: string | null;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  onStageChange?: (stage: 'resolving' | 'streaming', percent?: number) => void;
}): Promise<{ saved: DownloaderSavedEntry[]; failed: DownloaderFailedEntry | null }> {
  const maxPolls = 60;
  for (let p = 0; p < maxPolls; p++) {
    const iteration = await handlePollIteration(params);
    if (iteration.done && iteration.outcome) {
      return iteration.outcome;
    }
  }
  // Poll timeout: surface as a failed entry instead of silently dropping the URL
  const { jobId, url, folderId } = params;
  return {
    saved: [],
    failed: {
      id: `timeout-${jobId}`,
      url,
      folderId,
      errorMessage: 'Download timed out while waiting for the file. Please try again.',
    },
  };
}

async function processSingleBatchUrl(params: {
  subdomain: string;
  url: string;
  idx: number;
  folderId: string | null;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  onStageChange?: (stage: 'resolving' | 'streaming', percent?: number) => void;
}): Promise<{
  saved: DownloaderSavedEntry[];
  failed: DownloaderFailedEntry | null;
}> {
  const { subdomain, url, idx, folderId, fetchImpl, signal, onStageChange } = params;
  try {
    const res = await fetchImpl(`/api/tenant/${subdomain}/downloader`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        folderId,
      }),
      ...(signal ? { signal } : {}),
    });

    if (res.status === 202) {
      const data = (await res.json()) as { job?: { id: string } };
      const jobId = data?.job?.id;
      if (jobId) {
        return pollDownloadJobCompletion({
          subdomain,
          jobId,
          url,
          idx,
          folderId,
          fetchImpl,
          ...(signal ? { signal } : {}),
          ...(onStageChange ? { onStageChange } : {}),
        });
      }
    }

    if (res.ok) {
      const data = (await res.json()) as DownloaderIngestResponse;
      return {
        saved: data.items.map((item) => ({
          item,
          sourceUrl: data.sourceUrl,
          platform: data.platform,
        })),
        failed: null,
      };
    }

    const message = await extractApiErrorMessage(
      res,
      'Could not save media from this link. Please check that the link is public.'
    );
    return {
      saved: [],
      failed: {
        id: makeFailedId(idx),
        url,
        folderId,
        errorMessage: message,
      },
    };
  } catch (err: any) {
    if (signal?.aborted || err?.name === 'AbortError') {
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
    // Convert network transport error into a structured retryable failed entry
    return {
      saved: [],
      failed: {
        id: makeFailedId(idx),
        url,
        folderId,
        errorMessage: 'Network connection interrupted while saving this link. Please retry.',
      },
    };
  }
}

/**
 * Processes a single or multi-line batch of URLs sequentially in order,
 * deduplicating identical URLs in the batch, emitting unified progress updates,
 * and returning all saved media items (including multi-item carousels) and failed links.
 */
export async function executeDownloaderBatch(
  options: ExecuteDownloaderBatchOptions
): Promise<ExecuteDownloaderBatchResult> {
  const { subdomain, rawInput, folderId, onProgress, fetchImpl = fetch, signal } = options;
  const deduped = deduplicateBatchUrls(rawInput);
  const { urls, duplicateCount, invalidUrls } = deduped;

  const savedEntries: DownloaderSavedEntry[] = [];
  const failedEntries: DownloaderFailedEntry[] = [];

  if (urls.length === 0) {
    return {
      savedEntries,
      failedEntries,
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

  const runSequential = async (idx: number): Promise<void> => {
    if (signal?.aborted) {
      onProgress?.({
        status: 'cancelled',
        totalLinks: urls.length,
        completedLinks: idx,
        currentUrl: null,
        duplicateCount,
        invalidCount: invalidUrls.length,
      });
      return;
    }

    if (idx >= urls.length) {
      return;
    }
    const url = urls[idx]!;
    onProgress?.({
      status: 'downloading',
      totalLinks: urls.length,
      completedLinks: idx,
      currentUrl: url,
      duplicateCount,
      invalidCount: invalidUrls.length,
      stage: 'resolving',
    });

    const outcome = await processSingleBatchUrl({
      subdomain,
      url,
      idx,
      folderId,
      fetchImpl,
      ...(signal ? { signal } : {}),
      onStageChange: (stage, stagePercent) => {
        onProgress?.({
          status: 'downloading',
          totalLinks: urls.length,
          completedLinks: idx,
          currentUrl: url,
          duplicateCount,
          invalidCount: invalidUrls.length,
          stage,
          ...(stagePercent !== undefined ? { stagePercent } : {}),
        });
      },
    });

    savedEntries.push(...outcome.saved);
    if (outcome.failed) {
      failedEntries.push(outcome.failed);
    }

    const nextUrl = urls[idx + 1] ?? null;
    onProgress?.({
      status: idx + 1 === urls.length ? 'completed' : 'downloading',
      totalLinks: urls.length,
      completedLinks: idx + 1,
      currentUrl: nextUrl,
      duplicateCount,
      invalidCount: invalidUrls.length,
    });

    await runSequential(idx + 1);
  };

  await runSequential(0);

  return {
    savedEntries,
    failedEntries,
    duplicateCount,
    invalidUrls,
  };
}

/**
 * Retries a previously failed download entry against `POST /api/tenant/[subdomain]/downloader`.
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
  const { subdomain, entry, targetFolderId, fetchImpl = fetch } = params;
  const folderId = targetFolderId !== undefined ? targetFolderId : entry.folderId;

  try {
    const res = await fetchImpl(`/api/tenant/${subdomain}/downloader`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: entry.url,
        folderId,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as DownloaderIngestResponse;
      const savedEntries: DownloaderSavedEntry[] = data.items.map((item) => ({
        item,
        sourceUrl: data.sourceUrl,
        platform: data.platform,
      }));
      return {
        ok: true,
        savedEntries,
      };
    }

    const message = await extractApiErrorMessage(
      res,
      'Could not save media from this link. Please try again.'
    );
    return {
      ok: false,
      savedEntries: [],
      errorMessage: message,
    };
  } catch {
    // Convert network error into a user-safe retry failure result
    return {
      ok: false,
      savedEntries: [],
      errorMessage: 'Network connection interrupted while retrying this link.',
    };
  }
}


