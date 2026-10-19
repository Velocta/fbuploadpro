'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  deduplicateBatchUrls,
  type DownloaderIngestResponse,
  type DownloaderSourcePlatform,
  type MediaFolder,
  type MediaItemResponse,
} from '@fbuploadpro/contracts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { formatFolderAncestryPath } from '@/components/media/media-library-explorer';
import { deriveDefaultCaption, formatBytes } from '@/lib/upload-queue-helpers';

export const DEFAULT_DOWNLOADS_FOLDER_NAME = 'Downloads';

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

/**
 * Finds an existing root-level "Downloads" folder (case-insensitive) in a folder list.
 */
export function findRootDownloadsFolder(folders: MediaFolder[]): MediaFolder | undefined {
  return folders.find(
    (f) =>
      (f.parentId ?? null) === null &&
      f.name.trim().toLowerCase() === DEFAULT_DOWNLOADS_FOLDER_NAME.toLowerCase()
  );
}

/**
 * Builds the Media Library URL for navigating directly to a target folder (or All Media root).
 */
export function buildMediaFolderHref(
  subdomain: string,
  folderId: string | null | undefined
): string {
  if (folderId) {
    return `/tenant/${subdomain}/media?folder=${encodeURIComponent(folderId)}`;
  }
  return `/tenant/${subdomain}/media`;
}

/**
 * Builds a unique ID for a failed download entry from its batch index.
 */
export function makeFailedId(idx: number): string {
  return `failed-${idx}-${Date.now()}`;
}

/**
 * Fetches existing workspace folders and selects the root-level "Downloads" folder.
 * If no root-level "Downloads" folder exists yet, automatically provisions it via POST.
 */
export async function initializeDownloaderFolders(params: {
  subdomain: string;
  fetchImpl?: typeof fetch;
}): Promise<InitializeDownloaderFoldersResult> {
  const { subdomain, fetchImpl = fetch } = params;

  const listRes = await fetchImpl(`/api/tenant/${subdomain}/media/folders`);
  let folders: MediaFolder[] = [];
  if (listRes.ok) {
    const data = (await listRes.json()) as { folders?: MediaFolder[] };
    folders = Array.isArray(data.folders) ? data.folders : [];
  }

  const existingDownloads = findRootDownloadsFolder(folders);
  if (existingDownloads) {
    return {
      folders,
      selectedFolderId: existingDownloads.id,
      createdDefaultFolder: false,
    };
  }

  const createRes = await fetchImpl(`/api/tenant/${subdomain}/media/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DEFAULT_DOWNLOADS_FOLDER_NAME,
      parentId: null,
    }),
  });

  if (createRes.ok) {
    const createdFolder = (await createRes.json()) as MediaFolder;
    const updatedFolders = [...folders, createdFolder];
    return {
      folders: updatedFolders,
      selectedFolderId: createdFolder.id,
      createdDefaultFolder: true,
    };
  }

  if (createRes.status === 409) {
    const retryListRes = await fetchImpl(`/api/tenant/${subdomain}/media/folders`);
    if (retryListRes.ok) {
      const retryData = (await retryListRes.json()) as { folders?: MediaFolder[] };
      const refreshedFolders = Array.isArray(retryData.folders) ? retryData.folders : folders;
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

/**
 * Creates a new destination folder inline from the Downloader and returns the updated folder list
 * along with the newly created folder's ID so it is immediately selected.
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
  const { subdomain, name, parentId, existingFolders, fetchImpl = fetch } = params;
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Please enter a folder name.');
  }

  const res = await fetchImpl(`/api/tenant/${subdomain}/media/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: trimmedName,
      parentId,
    }),
  });

  if (!res.ok) {
    let errorMessage = 'Could not create folder. Please try a different name.';
    try {
      const errBody = (await res.json()) as { message?: string };
      if (errBody.message) {
        errorMessage = errBody.message;
      }
    } catch (_e) {
      // Fallback to default message
    }
    throw new Error(errorMessage);
  }

  const createdFolder = (await res.json()) as MediaFolder;
  const updatedFolders = [...existingFolders, createdFolder];

  return {
    folder: createdFolder,
    folders: updatedFolders,
    selectedFolderId: createdFolder.id,
  };
}

export interface BatchInputValidationResult {
  valid: boolean;
  errorMessage: string | null;
  urls: string[];
  duplicateCount: number;
  invalidUrls: string[];
}

/**
 * Validates raw multi-line URL input and deduplicates identical links within the batch.
 */
export function validateDownloaderBatchInput(rawInput: string): BatchInputValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      errorMessage: 'Please paste at least one link to save to your Media Library.',
      urls: [],
      duplicateCount: 0,
      invalidUrls: [],
    };
  }

  const deduped = deduplicateBatchUrls(trimmed);
  if (deduped.urls.length === 0) {
    return {
      valid: false,
      errorMessage:
        'Please enter at least one valid public link.',
      urls: [],
      duplicateCount: deduped.duplicateCount,
      invalidUrls: deduped.invalidUrls,
    };
  }

  return {
    valid: true,
    errorMessage: null,
    urls: deduped.urls,
    duplicateCount: deduped.duplicateCount,
    invalidUrls: deduped.invalidUrls,
  };
}

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

function formatPlatformLabel(platform: DownloaderSourcePlatform): string {
  switch (platform) {
    case 'tiktok':
      return 'TikTok';
    case 'facebook':
      return 'Facebook';
    case 'instagram':
      return 'Instagram';
    case 'x':
      return 'X';
    case 'youtube':
      return 'YouTube';
    case 'google_drive':
      return 'Google Drive';
    case 'dropbox':
      return 'Dropbox';
    case 'direct':
      return 'Direct Media';
    default:
      return 'Web Link';
  }
}

function renderSavedItemPreview(item: MediaItemResponse, previewSrc: string | null) {
  if (!previewSrc) {
    return (
      <span
        style={{
          fontSize: '0.6875rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
          color: `var(--text-dim, ${THEME.default.text.muted})`,
          textTransform: 'uppercase',
        }}
      >
        {item.mediaType}
      </span>
    );
  }

  if (item.mediaType === 'video' && !item.thumbnailUrl) {
    return (
      <video
        src={previewSrc}
        muted
        playsInline
        preload="metadata"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    );
  }

  return (
    <img
      src={previewSrc}
      alt={item.name}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );
}

export interface MediaDownloaderProps {
  subdomain: string;
  initialFolders?: MediaFolder[];
  initialSelectedFolderId?: string | null;
  initialUrlInput?: string;
  initialUrlError?: string | null;
  initialBatchProgress?: DownloaderBatchProgressState | null;
  initialSavedEntries?: DownloaderSavedEntry[];
  initialFailedEntries?: DownloaderFailedEntry[];
  initialNewFolderDialogOpen?: boolean;
  initialNewFolderName?: string;
  initialDeduplicationCount?: number;
}

function resolveInitialDownloaderFolderId(
  initialId?: string | null,
  folders?: MediaFolder[]
): string | null {
  if (initialId !== undefined) {
    return initialId;
  }
  if (folders) {
    const existingDownloads = findRootDownloadsFolder(folders);
    if (existingDownloads) {
      return existingDownloads.id;
    }
  }
  return null;
}

function sortFoldersForDownloader(
  folders: MediaFolder[]
): Array<{ folder: MediaFolder; pathLabel: string }> {
  const withPaths = folders.map((folder) => ({
    folder,
    pathLabel: formatFolderAncestryPath(folder.id, folders),
  }));
  withPaths.sort((a, b) => {
    const aIsDownloads =
      (a.folder.parentId ?? null) === null &&
      a.folder.name.trim().toLowerCase() === DEFAULT_DOWNLOADS_FOLDER_NAME.toLowerCase();
    const bIsDownloads =
      (b.folder.parentId ?? null) === null &&
      b.folder.name.trim().toLowerCase() === DEFAULT_DOWNLOADS_FOLDER_NAME.toLowerCase();
    if (aIsDownloads && !bIsDownloads) return -1;
    if (!aIsDownloads && bIsDownloads) return 1;
    return a.pathLabel.toLowerCase().localeCompare(b.pathLabel.toLowerCase());
  });
  return withPaths;
}

function getProgressTextColor(status?: string): string {
  if (status === 'completed') return PALETTE.accent4;
  if (status === 'cancelled') return PALETTE.accent3;
  return PALETTE.primary;
}

function DownloaderSavedItemRow({
  entry,
  folders,
  onOpenInFolder,
}: Readonly<{
  entry: DownloaderSavedEntry;
  folders: MediaFolder[];
  onOpenInFolder: (folderId: string | null) => void;
}>) {
  const { item, platform } = entry;
  const resolvedCaption =
    item.captionText && item.captionText.trim().length > 0
      ? item.captionText
      : deriveDefaultCaption(item.name);
  const folderPathLabel = formatFolderAncestryPath(item.folderId, folders);
  const previewSrc = item.thumbnailUrl || item.url;

  return (
    <article
      data-testid={`downloader-saved-item-${item.id}`}
      style={{
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        padding: SPACING.md,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          minWidth: 0,
          flex: 1,
        }}
      >
        {/* Thumbnail / Video Preview */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: RADII.sm,
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderSavedItemPreview(item, previewSrc)}
        </div>

        {/* Asset Details & Auto-Populated Caption */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.xs,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.sm,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.name}
            </span>

            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
              }}
            >
              {formatBytes(item.fileSize)}
            </span>

            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                padding: `2px ${SPACING.xs}`,
              }}
            >
              {formatPlatformLabel(platform)}
            </span>

            <span
              data-testid={`downloader-item-folder-${item.id}`}
              style={{
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.xs,
                padding: `2px ${SPACING.xs}`,
              }}
            >
              {folderPathLabel}
            </span>
          </div>

          <p
            data-testid={`downloader-item-caption-${item.id}`}
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {resolvedCaption}
          </p>
        </div>
      </div>

      {/* Open in Folder Action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.xs }}>
        <button
          type="button"
          data-testid={`downloader-open-folder-${item.id}`}
          data-slot="downloader-open-folder-btn"
          onClick={() => onOpenInFolder(item.folderId)}
          style={{
            ...COMPONENT_STYLES.secondaryButton(THEME.default),
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            height: '34px',
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
          }}
        >
          Open in Folder
        </button>
      </div>
    </article>
  );
}

function DownloaderNewFolderDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  folderName,
  onFolderNameChange,
  folderParentId,
  onFolderParentIdChange,
  folderError,
  sortedFolderOptions,
  isCreatingFolder,
}: Readonly<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  folderName: string;
  onFolderNameChange: (name: string) => void;
  folderParentId: string | null;
  onFolderParentIdChange: (parentId: string | null) => void;
  folderError: string | null;
  sortedFolderOptions: Array<{ folder: MediaFolder; pathLabel: string }>;
  isCreatingFolder: boolean;
}>) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent data-testid="downloader-new-folder-dialog">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>
            Create a destination folder in your Media Library and select it for upcoming downloads.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACING.md,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACING.xs,
                }}
              >
                <label
                  htmlFor="downloader-new-folder-input"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                  }}
                >
                  Folder name
                </label>
                <input
                  id="downloader-new-folder-input"
                  data-testid="downloader-new-folder-input"
                  type="text"
                  value={folderName}
                  onChange={(e) => onFolderNameChange(e.target.value)}
                  placeholder="e.g. Viral Hooks Q4"
                  maxLength={100}
                  style={{
                    ...COMPONENT_STYLES.input(THEME.default),
                    backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    width: '100%',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACING.xs,
                }}
              >
                <label
                  htmlFor="downloader-new-folder-parent-select"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                  }}
                >
                  Parent location
                </label>
                <select
                  id="downloader-new-folder-parent-select"
                  data-testid="downloader-new-folder-parent-select"
                  value={folderParentId ?? ''}
                  onChange={(e) =>
                    onFolderParentIdChange(e.target.value ? e.target.value : null)
                  }
                  style={{
                    ...COMPONENT_STYLES.input(THEME.default),
                    backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    width: '100%',
                  }}
                >
                  <option value="">All Media (Root)</option>
                  {sortedFolderOptions.map(({ folder, pathLabel }) => (
                    <option key={folder.id} value={folder.id}>
                      {pathLabel}
                    </option>
                  ))}
                </select>
              </div>

              {folderError && (
                <div
                  role="alert"
                  data-testid="downloader-new-folder-error"
                  style={{
                    color: PALETTE.accent3,
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                  }}
                >
                  {folderError}
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              style={COMPONENT_STYLES.secondaryButton(THEME.default)}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="downloader-new-folder-submit"
              disabled={isCreatingFolder}
              style={COMPONENT_STYLES.primaryButton}
            >
              {isCreatingFolder ? 'Creating...' : 'Create folder'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MediaDownloader({
  subdomain,
  initialFolders,
  initialSelectedFolderId,
  initialUrlInput = '',
  initialUrlError = null,
  initialBatchProgress = null,
  initialSavedEntries = [],
  initialFailedEntries = [],
  initialNewFolderDialogOpen = false,
  initialNewFolderName = '',
  initialDeduplicationCount = 0,
}: Readonly<MediaDownloaderProps>) {
  const router = useRouter();

  const [folders, setFolders] = useState<MediaFolder[]>(initialFolders ?? []);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() =>
    resolveInitialDownloaderFolderId(initialSelectedFolderId, initialFolders)
  );

  const [urlInput, setUrlInput] = useState(initialUrlInput);
  const [urlError, setUrlError] = useState<string | null>(initialUrlError);
  const [batchProgress, setBatchProgress] = useState<DownloaderBatchProgressState | null>(
    initialBatchProgress
  );
  const [deduplicationCount, setDeduplicationCount] = useState<number>(
    initialDeduplicationCount
  );

  const [savedEntries, setSavedEntries] = useState<DownloaderSavedEntry[]>(
    initialSavedEntries
  );
  const [failedEntries, setFailedEntries] = useState<DownloaderFailedEntry[]>(
    initialFailedEntries
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAbortDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setBatchProgress((prev) =>
      prev ? { ...prev, status: 'cancelled' } : null
    );
  };

  // Inline New Folder Modal state
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(
    initialNewFolderDialogOpen
  );
  const [newFolderName, setNewFolderName] = useState(initialNewFolderName);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Auto-provision or select root-level "Downloads" folder on mount when not pre-populated
  useEffect(() => {
    if (initialFolders !== undefined) {
      return;
    }
    let cancelled = false;

    const loadFolders = async () => {
      try {
        const result = await initializeDownloaderFolders({ subdomain });
        if (!cancelled) {
          setFolders(result.folders);
          if (result.selectedFolderId !== null) {
            setSelectedFolderId(result.selectedFolderId);
          }
        }
      } catch (_err) {
        // Keep All Media root fallback if offline
      }
    };

    void loadFolders();
    return () => {
      cancelled = true;
    };
  }, [subdomain, initialFolders]);

  const isDownloading = batchProgress?.status === 'downloading';

  const sortedFolderOptions = React.useMemo(() => sortFoldersForDownloader(folders), [folders]);

  const handleOpenNewFolderDialog = useCallback(() => {
    setNewFolderName('');
    setNewFolderParentId(selectedFolderId);
    setNewFolderError(null);
    setIsNewFolderDialogOpen(true);
  }, [selectedFolderId]);

  const handleCreateNewFolder = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setNewFolderError('Please enter a folder name.');
      return;
    }

    setIsCreatingFolder(true);
    setNewFolderError(null);
    try {
      const created = await createDownloaderFolder({
        subdomain,
        name: trimmed,
        parentId: newFolderParentId,
        existingFolders: folders,
      });
      setFolders(created.folders);
      setSelectedFolderId(created.selectedFolderId);
      setIsNewFolderDialogOpen(false);
      setNewFolderName('');
    } catch (err) {
      setNewFolderError(
        err instanceof Error ? err.message : 'Could not create folder.'
      );
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setUrlInput(nextValue);
    if (urlError) {
      setUrlError(null);
    }
  };

  const handleSubmitDownload = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isDownloading) return;

    const validation = validateDownloaderBatchInput(urlInput);
    if (!validation.valid) {
      setUrlError(validation.errorMessage);
      return;
    }

    setUrlError(null);
    setDeduplicationCount(validation.duplicateCount);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await executeDownloaderBatch({
        subdomain,
        rawInput: urlInput,
        folderId: selectedFolderId,
        signal: controller.signal,
        onProgress: (state) => {
          setBatchProgress(state);
        },
      });

      if (result.savedEntries.length > 0) {
        setSavedEntries((prev) => [...result.savedEntries, ...prev]);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('fbuploadpro:download-completed'));
        }
      }
      if (result.failedEntries.length > 0) {
        setFailedEntries((prev) => [...result.failedEntries, ...prev]);
      }
      if (result.failedEntries.length === 0) {
        setUrlInput('');
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleRetryFailedEntry = async (entry: DownloaderFailedEntry) => {
    setRetryingId(entry.id);
    const retryResult = await retryFailedDownloadEntry({
      subdomain,
      entry,
      targetFolderId: entry.folderId ?? selectedFolderId,
    });
    setRetryingId(null);

    if (retryResult.ok) {
      setFailedEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setSavedEntries((prev) => [...retryResult.savedEntries, ...prev]);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fbuploadpro:download-completed'));
      }
    } else if (retryResult.errorMessage) {
      setFailedEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? { ...item, errorMessage: retryResult.errorMessage! }
            : item
        )
      );
    }
  };

  const handleOpenInFolder = (folderId: string | null) => {
    router.push(buildMediaFolderHref(subdomain, folderId));
  };

  const progressPercent =
    batchProgress && batchProgress.totalLinks > 0
      ? Math.min(
          100,
          Math.round((batchProgress.completedLinks / batchProgress.totalLinks) * 100)
        )
      : 0;

  const activeDuplicateNoticeCount =
    batchProgress && batchProgress.duplicateCount > 0
      ? batchProgress.duplicateCount
      : deduplicationCount;

  const hasRecentActivity = savedEntries.length > 0 || failedEntries.length > 0;

  return (
    <div
      data-testid="media-downloader-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xl,
        padding: SPACING.xl,
        maxWidth: '1040px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Page Header */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.xs,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            letterSpacing: TYPOGRAPHY.tracking.h1,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Media Downloader
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            maxWidth: '68ch',
          }}
        >
          Paste video or image links from social platforms, cloud drives, or direct web links to save them directly into your Media Library.
        </p>
      </header>

      {/* Main Downloader Input Card */}
      <section
        data-testid="downloader-input-card"
        style={{
          ...COMPONENT_STYLES.card(THEME.default),
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          padding: SPACING.xl,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.lg,
        }}
      >
        <form
          onSubmit={handleSubmitDownload}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.lg,
          }}
        >
          {/* Destination Folder Selector Row */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.xs,
            }}
          >
            <label
              htmlFor="downloader-folder-select"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Destination folder
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                flexWrap: 'wrap',
              }}
            >
              <select
                id="downloader-folder-select"
                data-testid="downloader-folder-select"
                value={selectedFolderId ?? ''}
                onChange={(e) =>
                  setSelectedFolderId(e.target.value ? e.target.value : null)
                }
                disabled={isDownloading}
                style={{
                  ...COMPONENT_STYLES.input(THEME.default),
                  backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  flex: '1 1 260px',
                  minWidth: '220px',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Media (Root)</option>
                {sortedFolderOptions.map(({ folder, pathLabel }) => (
                  <option key={folder.id} value={folder.id}>
                    {pathLabel}
                  </option>
                ))}
              </select>

              <button
                type="button"
                data-testid="downloader-new-folder-button"
                onClick={handleOpenNewFolderDialog}
                disabled={isDownloading}
                style={{
                  ...COMPONENT_STYLES.secondaryButton(THEME.default),
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: SPACING.xs,
                  whiteSpace: 'nowrap',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                New Folder
              </button>
            </div>
          </div>

          {/* Single & Multi-Line URL Input */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.xs,
            }}
          >
            <label
              htmlFor="downloader-url-input"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Media links
            </label>
            <textarea
              id="downloader-url-input"
              data-testid="downloader-url-input"
              rows={5}
              value={urlInput}
              onChange={handleUrlInputChange}
              disabled={isDownloading}
              placeholder={
                'https://www.tiktok.com/@creator/video/1234567890\nhttps://www.instagram.com/reel/ABC123xyz/\nhttps://drive.google.com/file/d/1A2B3C/view'
              }
              style={{
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                border: `1px solid ${
                  urlError
                    ? PALETTE.accent3
                    : `var(--border-subtle, ${THEME.default.borders.hairline})`
                }`,
                borderRadius: RADII.sm,
                padding: SPACING.md,
                fontSize: '0.875rem',
                fontFamily: TYPOGRAPHY.fontFamily,
                lineHeight: 1.5,
                resize: 'vertical',
                outline: 'none',
              }}
            />
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              Paste one link or multiple links (one per line). Original post captions are automatically saved with each video or image.
            </span>

            {urlError && (
              <div
                role="alert"
                data-testid="downloader-url-error"
                style={{
                  marginTop: SPACING.xs,
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  border: `1px solid ${PALETTE.accent3}`,
                  borderRadius: RADII.sm,
                  color: PALETTE.accent3,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                }}
              >
                {urlError}
              </div>
            )}
          </div>

          {/* Submit Row & Deduplication Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: SPACING.md,
              flexWrap: 'wrap',
            }}
          >
            <div>
              {activeDuplicateNoticeCount > 0 && (
                <span
                  data-testid="downloader-dedup-notice"
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    fontVariantNumeric: TYPOGRAPHY.tabularNums,
                  }}
                >
                  Skipped {activeDuplicateNoticeCount} duplicate{' '}
                  {activeDuplicateNoticeCount === 1 ? 'link' : 'links'} in batch
                </span>
              )}
            </div>

            <button
              type="submit"
              data-testid="downloader-submit-button"
              disabled={isDownloading}
              style={{
                ...COMPONENT_STYLES.primaryButton,
                opacity: isDownloading ? 0.75 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: SPACING.sm,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              {isDownloading ? 'Saving to Media Library...' : 'Save to Media Library'}
            </button>
          </div>
        </form>
      </section>

      {/* Unified Windows Copy-Style Batch Progress Banner */}
      {batchProgress && batchProgress.status !== 'idle' && (
        <section
          data-testid="downloader-batch-progress"
          aria-label="Batch download progress"
          style={{
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid ${
              batchProgress.status === 'completed'
                ? PALETTE.accent4
                : `var(--border-subtle, ${THEME.default.borders.hairline})`
            }`,
            borderRadius: RADII.md,
            boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
            padding: SPACING.md,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.sm,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: SPACING.md,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                minWidth: 0,
              }}
            >
              <span
                data-testid="downloader-progress-label"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                Saving {batchProgress.completedLinks} of {batchProgress.totalLinks}{' '}
                {batchProgress.totalLinks === 1 ? 'link' : 'links'} to Media Library...
              </span>
              {batchProgress.stage && isDownloading && (
                <span
                  data-testid="downloader-stage-label"
                  style={{
                    fontSize: '0.75rem',
                    color: PALETTE.primary,
                    fontWeight: TYPOGRAPHY.weights.medium,
                  }}
                >
                  [{batchProgress.stage === 'streaming' ? 'Streaming media bytes...' : 'Resolving media link...'}]
                </span>
              )}
              {batchProgress.currentUrl && isDownloading && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '280px',
                  }}
                >
                  {batchProgress.currentUrl}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
              <span
                data-testid="downloader-progress-percent"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  color: getProgressTextColor(batchProgress.status),
                  fontVariantNumeric: TYPOGRAPHY.tabularNums,
                }}
              >
                {batchProgress.status === 'cancelled' ? 'Cancelled' : `${progressPercent}%`}
              </span>

              {isDownloading && (
                <button
                  type="button"
                  data-testid="abort-download-btn"
                  onClick={handleAbortDownload}
                  style={{
                    height: '28px',
                    padding: `0 ${SPACING.sm}`,
                    backgroundColor: 'transparent',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    borderRadius: RADII.xs,
                    fontSize: '0.75rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    cursor: 'pointer',
                  }}
                >
                  Abort Download
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '8px',
              backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              borderRadius: RADII.xs,
              overflow: 'hidden',
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            <progress
              value={progressPercent}
              max={100}
              aria-label="Overall batch download progress"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                pointerEvents: 'none',
              }}
            />
            <div
              data-testid="downloader-progress-bar-fill"
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor:
                  batchProgress.status === 'completed'
                    ? PALETTE.accent4
                    : PALETTE.primary,
                transition: 'width 0.15s ease',
              }}
            />
          </div>
        </section>
      )}

      {/* Recent Downloads List */}
      <section
        data-testid="downloader-recent-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              letterSpacing: TYPOGRAPHY.tracking.h2,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Recent Downloads
          </h2>
          {hasRecentActivity && (
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
              }}
            >
              {savedEntries.length} saved
              {failedEntries.length > 0 ? ` · ${failedEntries.length} failed` : ''}
            </span>
          )}
        </div>

        {!hasRecentActivity ? (
          <div
            data-testid="downloader-empty-state"
            style={{
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.md,
              padding: SPACING.xxl,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <span
              style={{
                fontSize: '0.9375rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Nothing downloaded yet
            </span>
            <span
              style={{
                fontSize: '0.8125rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                maxWidth: '48ch',
              }}
            >
              Paste a link above and it will appear here, ready for your library.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.sm,
            }}
          >
            {/* Failed Links (with Retry button) */}
            {failedEntries.map((entry) => {
              const isRetrying = retryingId === entry.id;
              return (
                <article
                  key={entry.id}
                  data-testid="downloader-failed-item"
                  style={{
                    backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                    border: `1px solid ${PALETTE.accent3}`,
                    borderRadius: RADII.md,
                    padding: SPACING.md,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACING.md,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACING.xs,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: TYPOGRAPHY.weights.semibold,
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.url}
                    </span>
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        color: PALETTE.accent3,
                      }}
                    >
                      {entry.errorMessage}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid="downloader-retry-btn"
                    disabled={isRetrying}
                    onClick={() => handleRetryFailedEntry(entry)}
                    style={{
                      ...COMPONENT_STYLES.secondaryButton(THEME.default),
                      border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      height: '34px',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {isRetrying ? 'Retrying...' : 'Retry'}
                  </button>
                </article>
              );
            })}

            {/* Saved Media Items */}
            {savedEntries.map((entry) => (
              <DownloaderSavedItemRow
                key={entry.item.id}
                entry={entry}
                folders={folders}
                onOpenInFolder={handleOpenInFolder}
              />
            ))}
          </div>
        )}
      </section>

      {/* Inline New Folder Creation Modal */}
      <DownloaderNewFolderDialog
        isOpen={isNewFolderDialogOpen}
        onOpenChange={setIsNewFolderDialogOpen}
        onSubmit={handleCreateNewFolder}
        folderName={newFolderName}
        onFolderNameChange={(val) => {
          setNewFolderName(val);
          if (newFolderError) setNewFolderError(null);
        }}
        folderParentId={newFolderParentId}
        onFolderParentIdChange={setNewFolderParentId}
        folderError={newFolderError}
        sortedFolderOptions={sortedFolderOptions}
        isCreatingFolder={isCreatingFolder}
      />
    </div>
  );
}
