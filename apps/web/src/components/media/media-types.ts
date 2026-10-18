'use client';

import { deriveDefaultCaptionFromFilename, type MediaItemResponse } from '@fbuploadpro/contracts';

export type UploadStatus =
  | 'staged'
  | 'queued'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed';

export interface ImportQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  mediaType: 'video' | 'image';
  destinationFolderId: string | null;
  status: UploadStatus;
  progressPercent: number;
  isDuplicate: boolean;
  duplicateResolution?: 'skip' | 'upload_anyway';
  validationError?: string | null;
  abortController?: AbortController;
  retryCount: number;
  uploadedItem?: MediaItemResponse;
}

export type BatchCaptionMode = 'replace' | 'append';

export function deriveDefaultCaption(fileName: string): string {
  return deriveDefaultCaptionFromFilename(fileName);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatUploadDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const totalSec = Math.round(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatMediaDetails(
  aspectRatio: string | null | undefined,
  durationSeconds: number | null | undefined
): string {
  const parts: string[] = [];
  if (aspectRatio && aspectRatio !== 'unknown') {
    parts.push(aspectRatio);
  }
  const dur = formatDuration(durationSeconds);
  if (dur) {
    parts.push(dur);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export interface FilterAndSortOptions {
  currentFolderId: string | null;
  debouncedSearch: string;
  mediaTypeFilter: 'all' | 'video' | 'image';
  aspectRatioFilter: string;
  captionStatusFilter: 'all' | 'has_caption' | 'empty_caption';
  sortOption: 'created_at:desc' | 'created_at:asc' | 'name:asc' | 'file_size:desc';
}

function matchesSearch(item: MediaItemResponse, search: string): boolean {
  if (!search) return true;
  const matchName = item.name.toLowerCase().includes(search);
  const matchCaption = (item.captionText || '').toLowerCase().includes(search);
  return matchName || matchCaption;
}

function matchesFilters(item: MediaItemResponse, options: FilterAndSortOptions): boolean {
  if (!options.debouncedSearch) {
    if ((item.folderId ?? null) !== (options.currentFolderId ?? null)) {
      return false;
    }
  } else if (!matchesSearch(item, options.debouncedSearch)) {
    return false;
  }

  if (options.mediaTypeFilter !== 'all' && item.mediaType !== options.mediaTypeFilter) {
    return false;
  }

  if (options.aspectRatioFilter !== 'all' && item.aspectRatio !== options.aspectRatioFilter) {
    return false;
  }

  if (options.captionStatusFilter === 'has_caption') {
    if (!item.captionText || item.captionText.trim().length === 0) return false;
  } else if (options.captionStatusFilter === 'empty_caption') {
    if (item.captionText && item.captionText.trim().length > 0) return false;
  }

  return true;
}

function compareMediaItems(
  a: MediaItemResponse,
  b: MediaItemResponse,
  sortOption: FilterAndSortOptions['sortOption']
): number {
  if (sortOption === 'created_at:desc') {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }
  if (sortOption === 'created_at:asc') {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  }
  if (sortOption === 'name:asc') {
    return a.name.localeCompare(b.name);
  }
  if (sortOption === 'file_size:desc') {
    return b.fileSize - a.fileSize;
  }
  return 0;
}

export function filterAndSortMediaItems(
  items: MediaItemResponse[],
  options: FilterAndSortOptions
): MediaItemResponse[] {
  return items
    .filter((item) => matchesFilters(item, options))
    .sort((a, b) => compareMediaItems(a, b, options.sortOption));
}

