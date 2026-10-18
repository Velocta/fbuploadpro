'use client';

import { deriveDefaultCaptionFromFilename, type MediaItemResponse } from '@fbuploadpro/contracts';

export type UploadStatus =
  | 'staged'
  | 'queued'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

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
  duplicateResolution?: 'skip' | 'upload_anyway' | 'keep';
  validationError?: string | null;
  abortController?: AbortController;
  retryCount: number;
  previewUrl?: string | null;
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

