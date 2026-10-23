'use client';

import React, { useEffect } from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import type {
  MediaTypeFilterKey,
  AspectRatioFilterKey,
  CaptionStatusFilterKey,
  MediaViewMode,
  MediaSmartViewKey,
  SortOptionKey,
} from './media-types';
import type { ActiveDropdownKey } from './media-library-filters';
import { getPreference, preferences } from '@/lib/storage/preferences';

/**
 * The pre-137 storage key for the view-mode preference, kept as a
 * named constant because the parity suite pins its value. Runtime
 * reads/writes go through the typed preferences helper
 * (`preferences.mediaViewMode`, spec 137 §3.9) — whose reader accepts
 * the legacy plain-string form — never through this literal.
 */
export const MEDIA_VIEW_MODE_STORAGE_KEY = 'fbuploadpro:media-view-mode';

/** Shape of the staged duplicate-upload test fixture prop. */
export interface PendingDuplicateUpload {
  duplicates?: unknown[];
}

export interface MoveTargetState {
  type: 'single_media' | 'batch_media' | 'folder';
  mediaItem?: MediaItemResponse;
  folder?: MediaFolder;
}

export interface MediaLibraryExplorerProps {
  subdomain: string;
  initialFolders?: MediaFolder[];
  initialMediaItems?: MediaItemResponse[];
  initialCurrentFolderId?: string | null;
  initialActiveSmartView?: MediaSmartViewKey | null;
  initialViewMode?: MediaViewMode;
  initialSearchQuery?: string;
  initialMediaTypeFilter?: MediaTypeFilterKey;
  initialAspectRatioFilter?: AspectRatioFilterKey;
  initialCaptionStatusFilter?: CaptionStatusFilterKey;
  initialSortOption?: SortOptionKey;
  initialTotalMediaCount?: number;
  initialPendingDuplicateUpload?: PendingDuplicateUpload;
  initialDeleteFolderTarget?: MediaFolder | null;
}

/**
 * Pure helper functions extracted from media-library-explorer.tsx.
 * No behavior changes — moved verbatim.
 */

export function computeNextSelection(
  prev: string[],
  mediaId: string,
  allDisplayedIds: string[],
  shiftKey?: boolean
): string[] {
  if (shiftKey && prev.length > 0) {
    const lastId = prev.at(-1)!;
    const lastIdx = allDisplayedIds.indexOf(lastId);
    const currIdx = allDisplayedIds.indexOf(mediaId);
    if (lastIdx !== -1 && currIdx !== -1) {
      const start = Math.min(lastIdx, currIdx);
      const end = Math.max(lastIdx, currIdx);
      const slice = allDisplayedIds.slice(start, end + 1);
      return Array.from(new Set([...prev, ...slice]));
    }
  }
  return prev.includes(mediaId)
    ? prev.filter((id) => id !== mediaId)
    : [...prev, mediaId];
}

export function isPointerInsideDropdown(
  activeDropdown: ActiveDropdownKey,
  target: Node | null,
  refs: Record<'type' | 'ratio' | 'caption' | 'sort', React.RefObject<HTMLDivElement | null>>
): boolean {
  if (!activeDropdown || !target) return false;
  return Boolean(refs[activeDropdown]?.current?.contains(target));
}

export function useUploadNavigationGuard(
  activeUploadsCount: number,
  onInterceptNavigation: (href: string) => void
) {
  useEffect(() => {
    if (activeUploadsCount <= 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeUploadsCount]);

  useEffect(() => {
    if (activeUploadsCount <= 0) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        e.preventDefault();
        e.stopPropagation();
        onInterceptNavigation(href);
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [activeUploadsCount, onInterceptNavigation]);
}

export function getInitialViewMode(initialMode?: MediaViewMode): MediaViewMode {
  if (initialMode) return initialMode;
  // Typed preferences helper (spec 137 §3.9): validated read, the
  // definition's default ('grid') on missing/corrupt/unavailable.
  return getPreference(preferences.mediaViewMode);
}

export function computeActiveFilterCount(
  mediaType: MediaTypeFilterKey,
  ratio: AspectRatioFilterKey,
  captionStatus: CaptionStatusFilterKey
): number {
  return (
    (mediaType !== 'all' ? 1 : 0) +
    (ratio !== 'all' ? 1 : 0) +
    (captionStatus !== 'all' ? 1 : 0)
  );
}

/**
 * Parse one internal drag payload. A malformed payload is not an
 * error the user can act on: it degrades to "no internal payload"
 * (null) and the drop falls through to the external-files path —
 * that fallback IS the handling, so the parse failure is consumed
 * here deliberately rather than surfaced.
 */
function parseInternalDropPayload<TKey extends 'mediaId' | 'folderId'>(
  raw: string,
  key: TKey
): { [K in TKey]?: string } | null {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    parsed = null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  const value = (parsed as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0
    ? ({ [key]: value } as { [K in TKey]?: string })
    : null;
}

export function readInternalDropPayload(
  e: React.DragEvent
): { mediaId?: string; folderId?: string } | null {
  const mediaRaw = e.dataTransfer.getData('application/x-fbuploadpro-media');
  if (mediaRaw) {
    return parseInternalDropPayload(mediaRaw, 'mediaId');
  }
  const folderRaw = e.dataTransfer.getData('application/x-fbuploadpro-folder');
  if (folderRaw) {
    return parseInternalDropPayload(folderRaw, 'folderId');
  }
  return null;
}
