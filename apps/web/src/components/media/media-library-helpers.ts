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

export const MEDIA_VIEW_MODE_STORAGE_KEY = 'fbuploadpro:media-view-mode';

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
  initialPendingDuplicateUpload?: any;
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
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(MEDIA_VIEW_MODE_STORAGE_KEY);
    if (stored === 'grid' || stored === 'table') return stored;
  }
  return 'grid';
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

export function readInternalDropPayload(
  e: React.DragEvent
): { mediaId?: string; folderId?: string } | null {
  const mediaRaw = e.dataTransfer.getData('application/x-fbuploadpro-media');
  if (mediaRaw) {
    try {
      const parsed = JSON.parse(mediaRaw) as { mediaId?: string };
      return parsed.mediaId ? { mediaId: parsed.mediaId } : null;
    } catch {
      return null;
    }
  }
  const folderRaw = e.dataTransfer.getData('application/x-fbuploadpro-folder');
  if (folderRaw) {
    try {
      const parsed = JSON.parse(folderRaw) as { folderId?: string };
      return parsed.folderId ? { folderId: parsed.folderId } : null;
    } catch {
      return null;
    }
  }
  return null;
}
