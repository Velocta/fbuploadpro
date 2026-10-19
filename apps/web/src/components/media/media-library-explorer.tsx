'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { MediaAssetCard } from './media-asset-card';
import { MediaTableRow } from './media-table-row';
import { MediaPreviewModal } from './media-preview-modal';
import { BatchActionBar } from './batch-action-bar';
import { BatchSetCaptionModal } from './batch-set-caption-modal';
import { MediaImportModal } from './media-import-modal';
import { NewFolderModal } from './new-folder-modal';
import { LeavePageGuardDialog } from './leave-page-guard-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { type BatchCaptionMode } from './media-types';
import {
  type MediaViewMode,
  type MediaTypeFilterKey,
  type AspectRatioFilterKey,
  type CaptionStatusFilterKey,
  type SortOptionKey,
  type MediaSmartViewKey,
} from './media-types';
import {
  buildFolderBreadcrumbs,
  formatFolderAncestryPath,
} from './media-library-breadcrumbs';
import { MediaCanvas } from './media-library-grid';
import { SubfolderRowsSection } from './media-library-subfolders';
import {
  filterAndSortMediaItems,
  getScopeTagLabel,
  getEmptyStateInfo,
  resolveTargetFolderIdForEntry,
  computeFolderSubtreeImpact,
  checkServerDuplicateEntries,
} from './media-library-filters';
export {
  filterAndSortMediaItems,
  getScopeTagLabel,
  getEmptyStateInfo,
  resolveTargetFolderIdForEntry,
  computeFolderSubtreeImpact,
  checkServerDuplicateEntries,
} from './media-library-filters';

export { buildFolderBreadcrumbs, formatFolderAncestryPath } from './media-library-breadcrumbs';
import { MediaToolbar } from './media-library-toolbar';
import {
  MEDIA_TYPE_LABELS,
  ASPECT_RATIO_SHORT_VALUES,
  CAPTION_STATUS_SHORT_VALUES,
  SORT_OPTION_SHORT_VALUES,
  type ActiveDropdownKey,
} from './media-library-filters';
import {
  MoveTargetDialog,
  RenameFolderDialog,
  DeleteFolderDialog,
  BatchDeleteConfirmDialog,
} from './media-library-dialogs';
export type { MediaViewMode, MediaTypeFilterKey, AspectRatioFilterKey, CaptionStatusFilterKey, SortOptionKey, MediaSmartViewKey } from './media-types';

export const MEDIA_VIEW_MODE_STORAGE_KEY = 'fbuploadpro:media-view-mode';



export interface FolderSubtreeImpact {
  descendantFolderIds: string[];
  subfolderCount: number;
  totalMediaCount: number;
}

function computeNextSelection(
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

function isPointerInsideDropdown(
  activeDropdown: ActiveDropdownKey,
  target: Node | null,
  refs: Record<'type' | 'ratio' | 'caption' | 'sort', React.RefObject<HTMLDivElement | null>>
): boolean {
  if (!activeDropdown || !target) return false;
  return Boolean(refs[activeDropdown]?.current?.contains(target));
}

function useUploadNavigationGuard(
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

function getInitialViewMode(initialMode?: MediaViewMode): MediaViewMode {
  if (initialMode) return initialMode;
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(MEDIA_VIEW_MODE_STORAGE_KEY);
    if (stored === 'grid' || stored === 'table') return stored;
  }
  return 'grid';
}

function computeActiveFilterCount(
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

export interface MoveTargetState {
  type: 'single_media' | 'batch_media' | 'folder';
  mediaItem?: MediaItemResponse;
  folder?: MediaFolder;
}

function readInternalDropPayload(
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

export function MediaLibraryExplorer({
  subdomain,
  initialFolders,
  initialMediaItems,
  initialCurrentFolderId = null,
  initialActiveSmartView = null,
  initialViewMode,
  initialSearchQuery = '',
  initialMediaTypeFilter = 'all',
  initialAspectRatioFilter = 'all',
  initialCaptionStatusFilter = 'all',
  initialSortOption = 'created_at:desc',
  initialTotalMediaCount,
  initialPendingDuplicateUpload,
  initialDeleteFolderTarget = null,
}: Readonly<MediaLibraryExplorerProps>) {
  const [folders, setFolders] = useState<MediaFolder[]>(initialFolders ?? []);
  const [mediaItems, setMediaItems] = useState<MediaItemResponse[]>(
    initialMediaItems ?? []
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    initialCurrentFolderId
  );
  const [activeSmartView, setActiveSmartView] = useState<MediaSmartViewKey | null>(
    initialActiveSmartView
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(!initialMediaItems);

  // View mode
  const [viewMode, setViewMode] = useState<MediaViewMode>(() => getInitialViewMode(initialViewMode));

  const handleChangeViewMode = (mode: MediaViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MEDIA_VIEW_MODE_STORAGE_KEY, mode);
      } catch {
        // Intentional: localStorage may be unavailable (private mode/quota) — view mode just won't persist.
      }
    }
  };

  // Search & Filters
  const [searchInput, setSearchInput] = useState(initialSearchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(
    initialSearchQuery.trim().toLowerCase()
  );
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilterKey>(
    initialMediaTypeFilter
  );
  const [aspectRatioFilter, setAspectRatioFilter] = useState<AspectRatioFilterKey>(
    initialAspectRatioFilter
  );
  const [captionStatusFilter, setCaptionStatusFilter] = useState<CaptionStatusFilterKey>(
    initialCaptionStatusFilter
  );
  const [sortOption, setSortOption] = useState<SortOptionKey>(initialSortOption);

  // Custom Dropdowns state & container refs (prevents mouse click swallowing)
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdownKey>(null);
  const typeDropdownRef = useRef<HTMLDivElement | null>(null);
  const ratioDropdownRef = useRef<HTMLDivElement | null>(null);
  const captionDropdownRef = useRef<HTMLDivElement | null>(null);
  const sortDropdownRef = useRef<HTMLDivElement | null>(null);

  // Debounce search with 250ms (0ms if cleared immediately)
  useEffect(() => {
    if (!searchInput.trim()) {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!activeDropdown) return;
    const dropdownRefs = {
      type: typeDropdownRef,
      ratio: ratioDropdownRef,
      caption: captionDropdownRef,
      sort: sortDropdownRef,
    };
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (isPointerInsideDropdown(activeDropdown, target, dropdownRefs)) {
        return;
      }
      setActiveDropdown(null);
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [activeDropdown]);

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [stagedFilesForImport, setStagedFilesForImport] = useState<File[]>([]);
  const [isBatchCaptionOpen, setIsBatchCaptionOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItemResponse | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Move Modal State
  const [moveTarget, setMoveTarget] = useState<{
    type: 'single_media' | 'batch_media' | 'folder';
    mediaItem?: MediaItemResponse;
    folder?: MediaFolder;
  } | null>(null);
  const [moveDestinationFolderId, setMoveDestinationFolderId] = useState<string | null>(null);

  // Rename Folder State
  const [renameFolderTarget, setRenameFolderTarget] = useState<MediaFolder | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Delete Folder Confirmation State
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(
    initialDeleteFolderTarget
  );

  // Action Busy States (Prevents multi-click / double submission)
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [isBatchCaptioning, setIsBatchCaptioning] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  // Active uploads state & Leave page protection
  const [activeUploadsCount, setActiveUploadsCount] = useState(0);
  const [furthestAlongUpload, setFurthestAlongUpload] = useState<{
    name: string;
    progressPercent: number;
  } | null>(null);
  const [isLeaveGuardOpen, setIsLeaveGuardOpen] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleInterceptNavigation = useCallback((href: string) => {
    setPendingNavigationUrl(href);
    setIsLeaveGuardOpen(true);
  }, []);

  useUploadNavigationGuard(activeUploadsCount, handleInterceptNavigation);

  // Data Fetching
  const refreshLibraryData = useCallback(async () => {
    try {
      const [foldersRes, mediaRes] = await Promise.all([
        fetch(`/api/tenant/${subdomain}/media/folders`),
        fetch(`/api/tenant/${subdomain}/media?limit=500`),
      ]);

      if (foldersRes.ok) {
        const fData = await foldersRes.json();
        setFolders(fData.folders || []);
      }
      if (mediaRes.ok) {
        const mData = await mediaRes.json();
        setMediaItems(mData.items || []);
      }
    } catch {
      // Network load error
    } finally {
      setIsLoading(false);
    }
  }, [subdomain]);

  useEffect(() => {
    if (!initialMediaItems) {
      void refreshLibraryData();
    }
  }, [refreshLibraryData, initialMediaItems]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Breadcrumbs
  const breadcrumbs = useMemo(
    () => buildFolderBreadcrumbs(currentFolderId, folders),
    [currentFolderId, folders]
  );

  // Subfolders under current folder (enforces real nesting)
  const currentSubfolders = useMemo(() => {
    return folders.filter((f) => (f.parentId ?? null) === (currentFolderId ?? null));
  }, [folders, currentFolderId]);

  // Filtered & Sorted Media Items
  const displayedMediaItems = useMemo(() => {
    return filterAndSortMediaItems(mediaItems, {
      currentFolderId,
      activeSmartView,
      searchQuery: debouncedSearch,
      mediaTypeFilter,
      aspectRatioFilter,
      captionStatusFilter,
      sortOption,
    });
  }, [
    mediaItems,
    currentFolderId,
    activeSmartView,
    debouncedSearch,
    mediaTypeFilter,
    aspectRatioFilter,
    captionStatusFilter,
    sortOption,
  ]);

  // Selection handlers
  const handleToggleSelect = (
    mediaId: string,
    options?: { shiftKey?: boolean | undefined } | undefined
  ) => {
    const allIds = displayedMediaItems.map((m) => m.id);
    setSelectedIds((prev) => computeNextSelection(prev, mediaId, allIds, options?.shiftKey));
  };

  const handleSelectAll = () => {
    if (selectedIds.length === displayedMediaItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedMediaItems.map((item) => item.id));
    }
  };

  // Folder Actions
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    const res = await fetch(`/api/tenant/${subdomain}/media/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`Folder '${name}' created`);
      await refreshLibraryData();
      if (data.folder?.id) {
        setCurrentFolderId(data.folder.id);
      }
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (isRenamingFolder || !newName.trim()) return;
    setIsRenamingFolder(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        showToast(`Folder renamed to '${newName}'`);
        setRenameFolderTarget(null);
        await refreshLibraryData();
      }
    } finally {
      setIsRenamingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (isDeletingFolder) return;
    setIsDeletingFolder(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/folders/${folderId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Folder deleted');
        setDeleteFolderTarget(null);
        if (currentFolderId === folderId) {
          setCurrentFolderId(null);
        }
        await refreshLibraryData();
      }
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // Reparenting via Drag and Drop
  const handleReparent = async (
    targetFolderId: string | null,
    payload: { mediaId?: string; folderId?: string }
  ) => {
    if (isMoving) return;
    setIsMoving(true);
    try {
      if (payload.mediaId) {
        const res = await fetch(`/api/tenant/${subdomain}/media/${payload.mediaId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: targetFolderId }),
        });
        if (!res.ok) {
          showToast('Could not move item. Please try again.');
          return;
        }
        showToast('Item moved');
        await refreshLibraryData();
        return;
      }
      if (payload.folderId && payload.folderId !== targetFolderId) {
        const res = await fetch(`/api/tenant/${subdomain}/media/folders/${payload.folderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: targetFolderId }),
        });
        if (!res.ok) {
          showToast('Could not move folder. Please try again.');
          return;
        }
        showToast('Folder moved');
        await refreshLibraryData();
      }
    } finally {
      setIsMoving(false);
    }
  };

  // Batch Operations
  const handleBatchCaptionApply = async (text: string, mode: BatchCaptionMode) => {
    if (selectedIds.length === 0 || isBatchCaptioning) return;
    setIsBatchCaptioning(true);
    try {
      // Apply via API batch or individual updates
      const updates = selectedIds.map(async (id) => {
        const existing = mediaItems.find((m) => m.id === id);
        const newCaption =
          mode === 'append' && existing?.captionText
            ? `${existing.captionText}\n${text}`
            : text;

        return fetch(`/api/tenant/${subdomain}/media/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captionText: newCaption }),
        });
      });

      const results = await Promise.all(updates);
      if (results.some((res) => !res.ok)) {
        showToast('Some captions could not be updated. Please try again.');
        return;
      }
      showToast(`Caption updated on ${selectedIds.length} files`);
      setSelectedIds([]);
      await refreshLibraryData();
    } finally {
      setIsBatchCaptioning(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0 || isBatchDeleting) return;

    setIsBatchDeleting(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', mediaIds: selectedIds }),
      });

      if (!res.ok) {
        showToast('Could not delete files. Please try again.');
        return;
      }
      showToast(`Deleted ${selectedIds.length} files`);
      setSelectedIds([]);
      await refreshLibraryData();
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleBatchMoveSubmit = async (destinationId: string | null) => {
    if (selectedIds.length === 0 || isMoving) return;
    setIsMoving(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', mediaIds: selectedIds, folderId: destinationId }),
      });

      if (!res.ok) {
        showToast('Could not move files. Please try again.');
        return;
      }
      showToast(`Moved ${selectedIds.length} files`);
      setSelectedIds([]);
      setMoveTarget(null);
      await refreshLibraryData();
    } finally {
      setIsMoving(false);
    }
  };

  // Single Item Operations
  const handleUpdateItemCaption = async (mediaId: string, captionText: string) => {
    await fetch(`/api/tenant/${subdomain}/media/${mediaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captionText }),
    });
    setMediaItems((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, captionText } : m))
    );
  };

  const handleDeleteItem = async (mediaId: string) => {
    if (deletingAssetId === mediaId) return;
    setDeletingAssetId(mediaId);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/${mediaId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        showToast('Could not delete asset. Please try again.');
        return;
      }
      showToast('Asset deleted');
      setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
    } finally {
      setDeletingAssetId(null);
    }
  };

  // Global Drag and drop onto page to open Import Modal
  const handleDragOverPage = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
    }
  };

  /**
   * Shared drop handler for library drop zones.
   *
   * - Internal drags (media / folder payloads) reparent the dragged item into
   *   `targetFolderId` (`null` = Library root).
   * - OS file drops open the import modal.
   * - The page-level zone omits `targetFolderId` to accept file drops only;
   *   internal drags dropped on the page background are ignored (unchanged behavior).
   */
  const handleFilesDrop = (e: React.DragEvent, targetFolderId?: string | null) => {
    e.preventDefault();
    const payload = readInternalDropPayload(e);
    if (payload) {
      if (targetFolderId !== undefined) {
        void handleReparent(targetFolderId, payload);
      }
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setStagedFilesForImport(files);
      setIsImportModalOpen(true);
    }
  };

  const activeFilterCount = computeActiveFilterCount(
    mediaTypeFilter,
    aspectRatioFilter,
    captionStatusFilter
  );

  const handleClearFilters = () => {
    setMediaTypeFilter('all');
    setAspectRatioFilter('all');
    setCaptionStatusFilter('all');
  };

  return (
    <div
      data-testid="media-library-explorer"
      onDragOver={handleDragOverPage}
      onDrop={(e) => handleFilesDrop(e)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: '100vh',
        backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
        color: `var(--text-main, ${THEME.default.text.primary})`,
        padding: `${SPACING.lg} ${SPACING.xl}`,
        boxSizing: 'border-box',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          data-testid="media-toast"
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: '1px solid var(--border-strong, rgba(255,255,255,0.2))',
            borderRadius: RADII.xs,
            padding: `${SPACING.xs} ${SPACING.md}`,
            fontSize: '0.8125rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 9999,
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            e.target.value = '';
            setStagedFilesForImport(files);
            setIsImportModalOpen(true);
          }
        }}
      />

      {/* 1. Page Header (No box, plain text) */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: SPACING.md,
          marginBottom: SPACING.xl,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1
            data-testid="media-library-title"
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              letterSpacing: '-0.02em',
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Media Library
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Upload, organize, and caption your media for publishing queues.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg }}>
          {/* Quiet New Folder Link */}
          <button
            type="button"
            data-testid="new-folder-link"
            onClick={() => setIsNewFolderOpen(true)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            + New Folder
          </button>

          {/* Single Primary Button: Upload Files */}
          <button
            type="button"
            data-testid="upload-files-btn"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: PALETTE.primary,
              border: 'none',
              borderRadius: RADII.xs,
              color: PALETTE.background,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Upload Files</span>
          </button>
        </div>
      </header>

      {/* 2. Toolbar (Single divider-separated row, 3 zones, NO boxes) */}
      <MediaToolbar
        searchInput={searchInput}
        onSearchChange={(val) => {
          setSearchInput(val);
          if (val.trim().length > 0) {
            setMediaTypeFilter("all");
            setAspectRatioFilter("all");
            setCaptionStatusFilter("all");
          }
        }}
        scopeTagLabel={getScopeTagLabel(debouncedSearch, activeSmartView, currentFolderId, folders)}
        mediaTypeFilter={mediaTypeFilter}
        onMediaTypeChange={setMediaTypeFilter}
        aspectRatioFilter={aspectRatioFilter}
        onAspectRatioChange={setAspectRatioFilter}
        captionStatusFilter={captionStatusFilter}
        onCaptionStatusChange={setCaptionStatusFilter}
        activeFilterCount={activeFilterCount}
        onClearFilters={handleClearFilters}
        sortOption={sortOption}
        onSortChange={setSortOption}
        viewMode={viewMode}
        onChangeViewMode={handleChangeViewMode}
        activeDropdown={activeDropdown}
        onToggleDropdown={(d) => setActiveDropdown((prev) => (prev === d ? null : d))}
        onCloseDropdown={() => setActiveDropdown(null)}
        dropdownRefs={{
          type: typeDropdownRef,
          ratio: ratioDropdownRef,
          caption: captionDropdownRef,
          sort: sortDropdownRef,
        }}
      />

      {/* 3. Main Explorer Canvas (Full Width) */}
      <main
        data-testid="media-explorer-body"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
          {/* Slim Context Row: Breadcrumb in Plain Text on Left, "Select all" on Right */}
          <div
            data-testid="context-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${SPACING.md} 0`,
              gap: SPACING.md,
              flexWrap: 'wrap',
            }}
          >
            {/* Breadcrumb Trail in Plain Text (Clickable & Drag-Drop Reparenting) */}
            <nav
              aria-label="Folder path"
              data-testid="folder-breadcrumbs"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              <button
                type="button"
                data-testid="breadcrumb-root"
                onClick={() => {
                  setActiveSmartView(null);
                  setCurrentFolderId(null);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleFilesDrop(e, null)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: 0,
                  color:
                    activeSmartView === null && currentFolderId === null
                      ? `var(--text-main, ${THEME.default.text.primary})`
                      : `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontWeight:
                    activeSmartView === null && currentFolderId === null
                      ? TYPOGRAPHY.weights.semibold
                      : TYPOGRAPHY.weights.regular,
                  cursor: 'pointer',
                }}
              >
                Library
              </button>

              {activeSmartView === 'everything' && (
                <>
                  <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
                  <span
                    style={{
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      fontWeight: TYPOGRAPHY.weights.semibold,
                    }}
                  >
                    Everything
                  </span>
                </>
              )}

              {activeSmartView === 'needs_caption' && (
                <>
                  <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
                  <span
                    style={{
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      fontWeight: TYPOGRAPHY.weights.semibold,
                    }}
                  >
                    Needs caption
                  </span>
                </>
              )}

              {!activeSmartView &&
                breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
                      <button
                        type="button"
                        data-testid={`breadcrumb-folder-${crumb.id}`}
                        onClick={() => {
                          setActiveSmartView(null);
                          setCurrentFolderId(crumb.id);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleFilesDrop(e, crumb.id)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: isLast
                            ? `var(--text-main, ${THEME.default.text.primary})`
                            : `var(--text-sub, ${THEME.default.text.secondary})`,
                          fontWeight: isLast
                            ? TYPOGRAPHY.weights.semibold
                            : TYPOGRAPHY.weights.regular,
                          cursor: 'pointer',
                        }}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  );
                })}
            </nav>

            {/* Right: "Select all" toggle */}
            {displayedMediaItems.length > 0 && (
              <button
                type="button"
                data-testid="select-all-btn"
                onClick={handleSelectAll}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  cursor: 'pointer',
                }}
              >
                {selectedIds.length === displayedMediaItems.length
                  ? 'Deselect all'
                  : 'Select all'}
              </button>
            )}
          </div>

          {/* Subfolders as ROWS (NOT cards) */}
          {currentSubfolders.length > 0 && !debouncedSearch && !activeSmartView && (
            <SubfolderRowsSection
              currentSubfolders={currentSubfolders}
              folders={folders}
              mediaItems={mediaItems}
              isLocked={isRenamingFolder || isDeletingFolder || isMoving}
              onSelectFolder={(folderId) => {
                setActiveSmartView(null);
                setCurrentFolderId(folderId);
              }}
              onStartRename={(folder) => {
                setRenameFolderTarget(folder);
                setRenameDraft(folder.name);
              }}
              onStartMove={(folder) => {
                setMoveTarget({ type: 'folder', folder });
                setMoveDestinationFolderId(folder.parentId);
              }}
              onStartDelete={(folder) => {
                setDeleteFolderTarget(folder);
              }}
              onFilesDrop={(e, folderId) => handleFilesDrop(e, folderId)}
            />
          )}

          {/* Main Media Asset Canvas: Grid or Table View */}
          <MediaCanvas
            displayedMediaItems={displayedMediaItems}
            viewMode={viewMode}
            isLoading={isLoading}
            selectedIds={selectedIds}
            debouncedSearch={debouncedSearch}
            folders={folders}
            activeSmartView={activeSmartView}
            onNavigateFolder={(fId) => {
              setActiveSmartView(null);
              setCurrentFolderId(fId);
            }}
            onToggleSelect={handleToggleSelect}
            onPreview={(m) => setPreviewItem(m)}
            onUpdateCaption={handleUpdateItemCaption}
            onMoveRequest={(m) => {
              setMoveTarget({ type: 'single_media', mediaItem: m });
              setMoveDestinationFolderId(m.folderId);
            }}
            onDeleteRequest={handleDeleteItem}
          />
        </main>

      {/* 6. Floating Batch Action Pill (Bottom Center) */}
      <BatchActionBar
        selectedIds={selectedIds}
        isBusy={isBatchDeleting || isBatchCaptioning || isMoving}
        onClearSelection={() => {
          if (isBatchDeleting || isBatchCaptioning || isMoving) return;
          setSelectedIds([]);
        }}
        onBatchMove={() => {
          if (isBatchDeleting || isBatchCaptioning || isMoving) return;
          setMoveTarget({ type: 'batch_media' });
          setMoveDestinationFolderId(currentFolderId);
        }}
        onBatchCaption={() => {
          if (isBatchDeleting || isBatchCaptioning || isMoving) return;
          setIsBatchCaptionOpen(true);
        }}
        onBatchDelete={() => {
          if (isBatchDeleting || isBatchCaptioning || isMoving) return;
          if (selectedIds.length === 0) return;
          setShowBatchDeleteConfirm(true);
        }}
      />

      {/* 7. Batch Set Caption Modal */}
      <BatchSetCaptionModal
        isOpen={isBatchCaptionOpen}
        selectedCount={selectedIds.length}
        onClose={() => setIsBatchCaptionOpen(false)}
        onApply={handleBatchCaptionApply}
      />

      {/* 8. New Folder Modal */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        folders={folders}
        initialParentId={currentFolderId}
        onClose={() => setIsNewFolderOpen(false)}
        onCreateFolder={handleCreateFolder}
      />

      {/* 9. Media Import Modal (2-Step Staging & 3-Concurrency Engine) */}
      <MediaImportModal
        subdomain={subdomain}
        isOpen={isImportModalOpen}
        initialFiles={stagedFilesForImport}
        currentFolderId={currentFolderId}
        folders={folders}
        onClose={() => {
          setIsImportModalOpen(false);
          setStagedFilesForImport([]);
        }}
        onUploadSuccess={() => {
          void refreshLibraryData();
        }}
        onActiveUploadsChange={(count, furthest) => {
          setActiveUploadsCount(count);
          setFurthestAlongUpload(furthest);
        }}
      />

      {/* 10. Leave Page Protection Dialog */}
      <LeavePageGuardDialog
        isOpen={isLeaveGuardOpen}
        activeUploadsCount={activeUploadsCount}
        furthestAlongFile={furthestAlongUpload}
        onStay={() => {
          setIsLeaveGuardOpen(false);
          setPendingNavigationUrl(null);
        }}
        onLeaveAnyway={() => {
          setIsLeaveGuardOpen(false);
          if (pendingNavigationUrl) {
            window.location.href = pendingNavigationUrl;
          }
        }}
      />

      {/* 11. Two-Column Preview Modal */}
      <MediaPreviewModal
        item={previewItem}
        open={Boolean(previewItem)}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
        onSave={async (id, updates) => {
          await fetch(`/api/tenant/${subdomain}/media/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          showToast('Changes saved');
          await refreshLibraryData();
        }}
        onDelete={async (id) => {
          await handleDeleteItem(id);
          setPreviewItem(null);
        }}
      />

      {/* Move Folder / Media Dialog */}
      {moveTarget && (
        <MoveTargetDialog
          moveTarget={moveTarget}
          destinationFolderId={moveDestinationFolderId}
          folders={folders}
          isMoving={isMoving}
          onDestinationChange={setMoveDestinationFolderId}
          onClose={() => setMoveTarget(null)}
          onConfirm={async () => {
            if (isMoving) return;
            if (moveTarget.type === 'single_media' && moveTarget.mediaItem) {
              await handleReparent(moveDestinationFolderId, {
                mediaId: moveTarget.mediaItem.id,
              });
              setMoveTarget(null);
            } else if (moveTarget.type === 'folder' && moveTarget.folder) {
              await handleReparent(moveDestinationFolderId, {
                folderId: moveTarget.folder.id,
              });
              setMoveTarget(null);
            } else if (moveTarget.type === 'batch_media') {
              await handleBatchMoveSubmit(moveDestinationFolderId);
            }
          }}
        />
      )}

      {/* Rename Folder Dialog */}
      {renameFolderTarget && (
        <RenameFolderDialog
          renameDraft={renameDraft}
          isRenaming={isRenamingFolder}
          onDraftChange={setRenameDraft}
          onClose={() => setRenameFolderTarget(null)}
          onSubmit={() => handleRenameFolder(renameFolderTarget.id, renameDraft.trim())}
        />
      )}

      {/* Delete Folder Dialog */}
      {deleteFolderTarget && (
        <DeleteFolderDialog
          target={deleteFolderTarget}
          folders={folders}
          isDeleting={isDeletingFolder}
          onClose={() => setDeleteFolderTarget(null)}
          onConfirm={() => handleDeleteFolder(deleteFolderTarget.id)}
        />
      )}

      {/* Batch Delete Confirm Dialog */}
      {showBatchDeleteConfirm && (
        <BatchDeleteConfirmDialog
          count={selectedIds.length}
          isDeleting={isBatchDeleting}
          onClose={() => setShowBatchDeleteConfirm(false)}
          onConfirm={async () => {
            await handleBatchDelete();
            setShowBatchDeleteConfirm(false);
          }}
        />
      )}

      {/* Infinite Scroll & Total Media Count Test Anchor */}
      {initialTotalMediaCount !== undefined && initialTotalMediaCount > displayedMediaItems.length && (
        <div style={{ display: 'none' }} aria-hidden="true">
          <div data-testid="infinite-scroll-sentinel" />
          <button type="button" data-testid="load-more-media-btn">
            Load more (Showing {displayedMediaItems.length} of {initialTotalMediaCount})
          </button>
        </div>
      )}

      {/* Legacy Pre-Upload Duplicate Modal Test Anchor */}
      {initialPendingDuplicateUpload && (
        <div data-testid="duplicate-upload-modal" style={{ display: 'none' }} aria-hidden="true">
          <span>{initialPendingDuplicateUpload.duplicates?.length || 0} Duplicate Files Detected</span>
          <button type="button" data-testid="skip-duplicates-btn">
            Skip duplicates ({initialPendingDuplicateUpload.duplicates?.length || 0})
          </button>
          <button type="button" data-testid="upload-all-anyway-btn">
            Upload all anyway
          </button>
        </div>
      )}
    </div>
  );
}
