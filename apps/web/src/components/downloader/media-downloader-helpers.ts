'use client';

import type { MediaFolder } from '@fbuploadpro/contracts';
import { deduplicateBatchUrls } from '@fbuploadpro/contracts';
import { formatFolderAncestryPath } from '@/components/media/media-library-explorer';
import { PALETTE } from '@/lib/theme';

/**
 * Pure helper functions for the media downloader, extracted from
 * media-downloader.tsx. No behavior changes — moved verbatim.
 */

export const DEFAULT_DOWNLOADS_FOLDER_NAME = 'Downloads';

export function findRootDownloadsFolder(folders: MediaFolder[]): MediaFolder | undefined {
  return folders.find(
    (f) =>
      (f.parentId ?? null) === null &&
      f.name.trim().toLowerCase() === DEFAULT_DOWNLOADS_FOLDER_NAME.toLowerCase()
  );
}

export function buildMediaFolderHref(
  subdomain: string,
  folderId: string | null | undefined
): string {
  if (folderId) {
    return `/tenant/${subdomain}/media?folder=${encodeURIComponent(folderId)}`;
  }
  return `/tenant/${subdomain}/media`;
}

export function makeFailedId(idx: number): string {
  return `failed-${idx}-${Date.now()}`;
}

export interface BatchInputValidationResult {
  valid: boolean;
  errorMessage: string | null;
  urls: string[];
  duplicateCount: number;
  invalidUrls: string[];
}

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

export function resolveInitialDownloaderFolderId(
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

export function sortFoldersForDownloader(
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

export function getProgressTextColor(status?: string): string {
  if (status === 'completed') return PALETTE.accent4;
  if (status === 'cancelled') return PALETTE.accent3;
  return PALETTE.primary;
}

