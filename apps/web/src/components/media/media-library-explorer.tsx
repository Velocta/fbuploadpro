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
import { type BatchCaptionMode } from './media-types';

export const MEDIA_VIEW_MODE_STORAGE_KEY = 'fbuploadpro:media-view-mode';

export type MediaViewMode = 'grid' | 'table';
export type AspectRatioFilterKey = 'all' | '9:16' | '16:9' | '1:1' | '4:5';
export type CaptionStatusFilterKey = 'all' | 'has_caption' | 'empty_caption';
export type SortOptionKey =
  | 'created_at:desc'
  | 'created_at:asc'
  | 'name:asc'
  | 'file_size:desc';

const ASPECT_RATIO_LABELS: Record<AspectRatioFilterKey, string> = {
  all: 'All ratios',
  '9:16': '9:16 Vertical',
  '16:9': '16:9 Landscape',
  '1:1': '1:1 Square',
  '4:5': '4:5 Portrait',
};

const CAPTION_STATUS_LABELS: Record<CaptionStatusFilterKey, string> = {
  all: 'All captions',
  has_caption: 'Has caption',
  empty_caption: 'Missing caption',
};

const SORT_OPTION_LABELS: Record<SortOptionKey, string> = {
  'created_at:desc': 'Newest first',
  'created_at:asc': 'Oldest first',
  'name:asc': 'Name (A–Z)',
  'file_size:desc': 'Largest size',
};


export interface FolderSubtreeImpact {
  descendantFolderIds: string[];
  subfolderCount: number;
  totalMediaCount: number;
}

export function buildFolderBreadcrumbs(
  currentFolderId: string | null,
  folders: MediaFolder[]
): MediaFolder[] {
  if (!currentFolderId) return [];
  const folderMap = new Map<string, MediaFolder>();
  for (const f of folders) {
    folderMap.set(f.id, f);
  }

  const trail: MediaFolder[] = [];
  const visited = new Set<string>();
  let cursorId: string | null = currentFolderId;

  while (cursorId && !visited.has(cursorId)) {
    visited.add(cursorId);
    const folder = folderMap.get(cursorId);
    if (!folder) break;
    trail.unshift(folder);
    cursorId = folder.parentId ?? null;
  }

  return trail;
}

export function formatFolderAncestryPath(
  folderId: string | null,
  folders: MediaFolder[]
): string {
  if (!folderId) return 'All Media';
  const trail = buildFolderBreadcrumbs(folderId, folders);
  if (trail.length === 0) return 'All Media';
  return trail.map((f) => f.name).join(' / ');
}

export function computeFolderSubtreeImpact(
  folderId: string,
  folders: MediaFolder[]
): FolderSubtreeImpact {
  const childrenByParent = new Map<string, MediaFolder[]>();
  const folderById = new Map<string, MediaFolder>();

  for (const f of folders) {
    folderById.set(f.id, f);
    if (f.parentId) {
      const list = childrenByParent.get(f.parentId) ?? [];
      list.push(f);
      childrenByParent.set(f.parentId, list);
    }
  }

  const rootFolder = folderById.get(folderId);
  const descendantFolderIds: string[] = [];
  let totalMediaCount = rootFolder ? rootFolder.itemCount || 0 : 0;

  const queue: string[] = [folderId];
  const visited = new Set<string>([folderId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenByParent.get(currentId) ?? [];
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        descendantFolderIds.push(child.id);
        totalMediaCount += child.itemCount || 0;
        queue.push(child.id);
      }
    }
  }

  return {
    descendantFolderIds,
    subfolderCount: descendantFolderIds.length,
    totalMediaCount,
  };
}

export function computeRangeSelection(
  allIds: string[],
  currentSelection: string[],
  targetId: string,
  anchorId: string | null,
  shiftKey: boolean
): string[] {
  if (shiftKey && anchorId && allIds.includes(anchorId) && allIds.includes(targetId)) {
    const start = Math.min(allIds.indexOf(anchorId), allIds.indexOf(targetId));
    const end = Math.max(allIds.indexOf(anchorId), allIds.indexOf(targetId));
    const range = allIds.slice(start, end + 1);
    return Array.from(new Set([...currentSelection, ...range]));
  }
  return currentSelection.includes(targetId)
    ? currentSelection.filter((id) => id !== targetId)
    : [...currentSelection, targetId];
}

function matchesMediaFilters(
  item: MediaItemResponse,
  currentFolderId: string | null,
  mediaTypeFilter: 'all' | 'video' | 'image',
  aspectRatioFilter: AspectRatioFilterKey,
  captionStatusFilter: CaptionStatusFilterKey,
  trimmedSearch: string
): boolean {
  if (trimmedSearch.length === 0 && (item.folderId ?? null) !== currentFolderId) {
    return false;
  }
  if (mediaTypeFilter !== 'all' && item.mediaType !== mediaTypeFilter) {
    return false;
  }
  if (aspectRatioFilter !== 'all' && item.aspectRatio !== aspectRatioFilter) {
    return false;
  }
  if (captionStatusFilter === 'has_caption' && (!item.captionText || item.captionText.trim().length === 0)) {
    return false;
  }
  if (captionStatusFilter === 'empty_caption' && item.captionText && item.captionText.trim().length > 0) {
    return false;
  }
  if (trimmedSearch.length > 0) {
    const matchName = item.name.toLowerCase().includes(trimmedSearch);
    const matchCaption = (item.captionText || '').toLowerCase().includes(trimmedSearch);
    if (!matchName && !matchCaption) {
      return false;
    }
  }
  return true;
}

function sortMediaItems(a: MediaItemResponse, b: MediaItemResponse, sortOption: SortOptionKey): number {
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
  options: {
    currentFolderId: string | null;
    mediaTypeFilter: 'all' | 'video' | 'image';
    aspectRatioFilter?: AspectRatioFilterKey | undefined;
    captionStatusFilter?: CaptionStatusFilterKey | undefined;
    searchQuery: string;
    sortOption: SortOptionKey;
  }
): MediaItemResponse[] {
  const {
    currentFolderId,
    mediaTypeFilter,
    aspectRatioFilter = 'all',
    captionStatusFilter = 'all',
    searchQuery,
    sortOption,
  } = options;
  const trimmedSearch = searchQuery.trim().toLowerCase();

  return items
    .filter((item) =>
      matchesMediaFilters(
        item,
        currentFolderId,
        mediaTypeFilter,
        aspectRatioFilter,
        captionStatusFilter,
        trimmedSearch
      )
    )
    .sort((a, b) => sortMediaItems(a, b, sortOption));
}

export function resolveTargetFolderIdForEntry(
  entry: any,
  existingFolders: MediaFolder[],
  baseFolderId: string | null
): string | null | undefined {
  const segments: string[] = entry.relativeSubfolderPath ?? (entry.relativePath
    ? entry.relativePath
        .replace(/\\/g, '/')
        .trim()
        .split('/')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0 && p !== '.')
        .slice(0, -1)
    : []);

  if (segments.length === 0) {
    return baseFolderId ?? null;
  }

  let currentParentId: string | null = baseFolderId ?? null;
  for (const rawSegment of segments) {
    const segmentLower = rawSegment.trim().toLowerCase();
    const matched = existingFolders.find(
      (f) =>
        (f.parentId ?? null) === currentParentId &&
        f.name.trim().toLowerCase() === segmentLower
    );
    if (!matched) {
      return undefined;
    }
    currentParentId = matched.id;
  }
  return currentParentId;
}

export async function checkServerDuplicateEntries(
  subdomain: string,
  folderId: string | null | undefined,
  entries: any[],
  existingFolders: MediaFolder[] = []
): Promise<{ duplicates: any[]; uniqueEntries: any[] } | null> {
  try {
    const checkableEntries: Array<{
      clientKey: string;
      name: string;
      fileSize: number;
      folderId: string | null;
    }> = [];

    entries.forEach((e, idx) => {
      const targetFolderId = resolveTargetFolderIdForEntry(
        e,
        existingFolders,
        folderId ?? null
      );
      if (targetFolderId !== undefined) {
        checkableEntries.push({
          clientKey: String(idx),
          name: e.file.name,
          fileSize: e.file.size,
          folderId: targetFolderId,
        });
      }
    });

    if (checkableEntries.length === 0) {
      return { duplicates: [], uniqueEntries: entries };
    }

    const payload = {
      folderId: folderId ?? null,
      entries: checkableEntries,
    };
    const checkRes = await fetch(`/api/tenant/${subdomain}/media/check-duplicates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!checkRes.ok) return null;

    const checkData = (await checkRes.json()) as {
      duplicates: Array<{ clientKey: string; existingItem: any }>;
    };
    if (!checkData.duplicates || checkData.duplicates.length === 0) {
      return { duplicates: [], uniqueEntries: entries };
    }

    const dupKeySet = new Set(checkData.duplicates.map((d) => d.clientKey));
    const duplicates: any[] = [];
    const uniqueEntries: any[] = [];

    entries.forEach((e, idx) => {
      if (dupKeySet.has(String(idx))) {
        duplicates.push(e);
      } else {
        uniqueEntries.push(e);
      }
    });

    return { duplicates, uniqueEntries };
  } catch {
    return null;
  }
}

export interface MediaLibraryExplorerProps {
  subdomain: string;
  initialFolders?: MediaFolder[];
  initialMediaItems?: MediaItemResponse[];
  initialCurrentFolderId?: string | null;
  initialViewMode?: MediaViewMode;
  initialSearchQuery?: string;
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
  initialViewMode,
  initialSearchQuery = '',
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(!initialMediaItems);

  // View mode
  const [viewMode, setViewMode] = useState<MediaViewMode>(() => {
    if (initialViewMode) return initialViewMode;
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(MEDIA_VIEW_MODE_STORAGE_KEY);
      if (stored === 'grid' || stored === 'table') return stored;
    }
    return 'grid';
  });

  const handleChangeViewMode = (mode: MediaViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MEDIA_VIEW_MODE_STORAGE_KEY, mode);
      } catch {}
    }
  };

  // Search & Filters
  const [searchInput, setSearchInput] = useState(initialSearchQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(
    initialSearchQuery.trim().toLowerCase()
  );
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'video' | 'image'>('all');
  const [aspectRatioFilter, setAspectRatioFilter] = useState<AspectRatioFilterKey>(
    initialAspectRatioFilter
  );
  const [captionStatusFilter, setCaptionStatusFilter] = useState<CaptionStatusFilterKey>(
    initialCaptionStatusFilter
  );
  const [sortOption, setSortOption] = useState<SortOptionKey>(initialSortOption);

  // Custom Dropdowns state (prevents mouse click swallowing)
  const [activeDropdown, setActiveDropdown] = useState<'ratio' | 'caption' | 'sort' | null>(null);

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
    const handleOutsideClick = () => setActiveDropdown(null);
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

  // Active uploads state & Leave page protection
  const [activeUploadsCount, setActiveUploadsCount] = useState(0);
  const [furthestAlongUpload, setFurthestAlongUpload] = useState<{
    name: string;
    progressPercent: number;
  } | null>(null);
  const [isLeaveGuardOpen, setIsLeaveGuardOpen] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Arm browser native beforeunload when uploads are active
  useEffect(() => {
    if (activeUploadsCount <= 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeUploadsCount]);

  // Intercept in-app link clicks if uploads are active
  useEffect(() => {
    if (activeUploadsCount <= 0) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        e.preventDefault();
        e.stopPropagation();
        setPendingNavigationUrl(href);
        setIsLeaveGuardOpen(true);
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [activeUploadsCount]);

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
      refreshLibraryData();
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
      searchQuery: debouncedSearch,
      mediaTypeFilter,
      aspectRatioFilter,
      captionStatusFilter,
      sortOption,
    });
  }, [
    mediaItems,
    currentFolderId,
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
    setSelectedIds((prev) => {
      if (options?.shiftKey && prev.length > 0) {
        const lastId = prev[prev.length - 1];
        const allIds = displayedMediaItems.map((m) => m.id);
        const lastIdx = allIds.indexOf(lastId);
        const currIdx = allIds.indexOf(mediaId);
        if (lastIdx !== -1 && currIdx !== -1) {
          const start = Math.min(lastIdx, currIdx);
          const end = Math.max(lastIdx, currIdx);
          const slice = allIds.slice(start, end + 1);
          return Array.from(new Set([...prev, ...slice]));
        }
      }
      return prev.includes(mediaId)
        ? prev.filter((id) => id !== mediaId)
        : [...prev, mediaId];
    });
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
  };

  const handleDeleteFolder = async (folderId: string) => {
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
  };

  // Reparenting via Drag and Drop
  const handleReparent = async (
    targetFolderId: string | null,
    payload: { mediaId?: string; folderId?: string }
  ) => {
    if (payload.mediaId) {
      await fetch(`/api/tenant/${subdomain}/media/${payload.mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId }),
      });
      showToast('Item moved');
      await refreshLibraryData();
    } else if (payload.folderId) {
      if (payload.folderId === targetFolderId) return;
      await fetch(`/api/tenant/${subdomain}/media/folders/${payload.folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: targetFolderId }),
      });
      showToast('Folder moved');
      await refreshLibraryData();
    }
  };

  // Batch Operations
  const handleBatchCaptionApply = async (text: string, mode: BatchCaptionMode) => {
    if (selectedIds.length === 0) return;

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

    await Promise.all(updates);
    showToast(`Caption updated on ${selectedIds.length} files`);
    setSelectedIds([]);
    await refreshLibraryData();
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} assets? This cannot be undone.`)) {
      return;
    }

    await fetch(`/api/tenant/${subdomain}/media/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', mediaIds: selectedIds }),
    });

    showToast(`Deleted ${selectedIds.length} files`);
    setSelectedIds([]);
    await refreshLibraryData();
  };

  const handleBatchMoveSubmit = async (destinationId: string | null) => {
    if (selectedIds.length === 0) return;

    await fetch(`/api/tenant/${subdomain}/media/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', mediaIds: selectedIds, folderId: destinationId }),
    });

    showToast(`Moved ${selectedIds.length} files`);
    setSelectedIds([]);
    setMoveTarget(null);
    await refreshLibraryData();
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
    await fetch(`/api/tenant/${subdomain}/media/${mediaId}`, {
      method: 'DELETE',
    });
    showToast('Asset deleted');
    setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
  };

  // Global Drag and drop onto page to open Import Modal
  const handleDragOverPage = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
    }
  };

  const handleDropPage = (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      setStagedFilesForImport(files);
      setIsImportModalOpen(true);
    }
  };

  const renderMediaCanvas = () => {
    if (displayedMediaItems.length > 0) {
      if (viewMode === 'grid') {
        return (
          <div
            data-testid="media-assets-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: SPACING.lg,
              marginTop: SPACING.xs,
            }}
          >
            {displayedMediaItems.map((item) => (
              <MediaAssetCard
                key={item.id}
                item={item}
                selected={selectedIds.includes(item.id)}
                folderPathLabel={
                  debouncedSearch ? formatFolderAncestryPath(item.folderId, folders) : null
                }
                onNavigateFolder={(fId) => setCurrentFolderId(fId)}
                onToggleSelect={handleToggleSelect}
                onPreview={(m) => setPreviewItem(m)}
                onUpdateCaption={handleUpdateItemCaption}
                onMoveRequest={(m) => {
                  setMoveTarget({ type: 'single_media', mediaItem: m });
                  setMoveDestinationFolderId(m.folderId);
                }}
                onDeleteRequest={(m) => handleDeleteItem(m.id)}
              />
            ))}
          </div>
        );
      }

      return (
        <div
          data-testid="media-table-view"
          style={{
            width: '100%',
            overflowX: 'auto',
            marginTop: SPACING.xs,
          }}
        >
          <table
            data-testid="media-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
            }}
          >
            <thead
              style={{
                position: 'sticky',
                top: 0,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                zIndex: 2,
              }}
            >
              <tr>
                <th style={{ width: '40px', padding: `${SPACING.sm} ${SPACING.md}` }}>
                  <span className="sr-only">Select</span>
                </th>
                <th style={{ width: '48px', padding: `${SPACING.sm} 0` }}>
                  <span className="sr-only">Thumbnail</span>
                </th>
                <th
                  style={{
                    padding: `${SPACING.sm} ${SPACING.md}`,
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    letterSpacing: '0.04em',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  FILE
                </th>
                <th
                  style={{
                    padding: `${SPACING.sm} ${SPACING.md}`,
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    letterSpacing: '0.04em',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  CAPTION
                </th>
                <th
                  style={{
                    padding: `${SPACING.sm} ${SPACING.md}`,
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    letterSpacing: '0.04em',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  DETAILS
                </th>
                <th
                  style={{
                    padding: `${SPACING.sm} ${SPACING.md}`,
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    letterSpacing: '0.04em',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  SIZE
                </th>
                <th
                  style={{
                    padding: `${SPACING.sm} ${SPACING.md}`,
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    letterSpacing: '0.04em',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  DATE
                </th>
                <th
                  style={{
                    padding: `${SPACING.sm} ${SPACING.md}`,
                    textAlign: 'right',
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    letterSpacing: '0.04em',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                  }}
                >
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedMediaItems.map((item) => (
                <MediaTableRow
                  key={item.id}
                  item={item}
                  selected={selectedIds.includes(item.id)}
                  folderPathLabel={
                    debouncedSearch ? formatFolderAncestryPath(item.folderId, folders) : null
                  }
                  onNavigateFolder={(fId) => setCurrentFolderId(fId)}
                  onToggleSelect={handleToggleSelect}
                  onPreview={(m) => setPreviewItem(m)}
                  onUpdateCaption={handleUpdateItemCaption}
                  onMoveRequest={(m) => {
                    setMoveTarget({ type: 'single_media', mediaItem: m });
                    setMoveDestinationFolderId(m.folderId);
                  }}
                  onDeleteRequest={(m) => handleDeleteItem(m.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (!isLoading) {
      return (
        <div
          data-testid="media-empty-state"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${SPACING.xxl} 0`,
            gap: SPACING.md,
            color: `var(--text-dim, ${THEME.default.text.muted})`,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.9375rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {debouncedSearch ? 'No matching files found' : 'No media in this folder'}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem' }}>
              {debouncedSearch
                ? 'Try a different search term or clear filters.'
                : 'Upload files or drag them anywhere into this folder to get started.'}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      data-testid="media-library-explorer"
      onDragOver={handleDragOverPage}
      onDrop={handleDropPage}
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
              color: '#000000',
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

      {/* 2. Toolbar (Single divider-separated row, NO boxes) */}
      <div
        data-testid="media-explorer-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACING.md,
          paddingBottom: SPACING.md,
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Magnifier Icon + Borderless Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.xs,
            flex: '1 1 260px',
            maxWidth: '380px',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={`var(--text-dim, ${THEME.default.text.muted})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            data-testid="media-search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by file name or caption…"
            aria-label="Search by file name or caption"
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '0.875rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              padding: '4px 0',
            }}
          />
        </div>

        {/* Center / Right: Tabs, Dropdowns & Bare View Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.lg,
            flexWrap: 'wrap',
          }}
        >
          {/* Media Type Tabs: All / Videos / Images with active underline */}
          <div
            role="tablist"
            aria-label="Filter by media type"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.md,
            }}
          >
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'video', label: 'Videos' },
                { key: 'image', label: 'Images' },
              ] as const
            ).map((tab) => {
              const active = mediaTypeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`filter-type-${tab.key}`}
                  onClick={() => setMediaTypeFilter(tab.key)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: active
                      ? `2px solid ${PALETTE.primary}`
                      : '2px solid transparent',
                    padding: `${SPACING.xs} 0`,
                    color: active
                      ? `var(--text-main, ${THEME.default.text.primary})`
                      : `var(--text-dim, ${THEME.default.text.muted})`,
                    fontSize: '0.8125rem',
                    fontWeight: active
                      ? TYPOGRAPHY.weights.semibold
                      : TYPOGRAPHY.weights.medium,
                    cursor: 'pointer',
                    transition: 'color 0.12s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Aspect Ratio Plain Text Dropdown with Caret */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              data-testid="media-aspect-ratio-select"
              onPointerDown={(e) => {
                e.stopPropagation();
                setActiveDropdown((prev) => (prev === 'ratio' ? null : 'ratio'));
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                padding: 0,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{ASPECT_RATIO_LABELS[aspectRatioFilter]}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {activeDropdown === 'ratio' && (
              <div
                style={{
                  position: 'absolute',
                  top: '26px',
                  left: 0,
                  backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                  border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                  borderRadius: RADII.xs,
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 30,
                  minWidth: '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {[
                  { key: 'all', label: 'All ratios' },
                  { key: '9:16', label: '9:16 Vertical' },
                  { key: '16:9', label: '16:9 Landscape' },
                  { key: '1:1', label: '1:1 Square' },
                  { key: '4:5', label: '4:5 Portrait' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setAspectRatioFilter(opt.key as AspectRatioFilterKey);
                      setActiveDropdown(null);
                    }}
                    style={{
                      padding: '6px 10px',
                      textAlign: 'left',
                      backgroundColor:
                        aspectRatioFilter === opt.key
                          ? `var(--bg-subtle, ${THEME.default.surfaces.subtle})`
                          : 'transparent',
                      border: 'none',
                      borderRadius: RADII.xs,
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Caption Status Plain Text Dropdown with Caret */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              data-testid="media-caption-status-select"
              onPointerDown={(e) => {
                e.stopPropagation();
                setActiveDropdown((prev) => (prev === 'caption' ? null : 'caption'));
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                padding: 0,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{CAPTION_STATUS_LABELS[captionStatusFilter]}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {activeDropdown === 'caption' && (
              <div
                style={{
                  position: 'absolute',
                  top: '26px',
                  left: 0,
                  backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                  border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                  borderRadius: RADII.xs,
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 30,
                  minWidth: '130px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {[
                  { key: 'all', label: 'All captions' },
                  { key: 'has_caption', label: 'Has caption' },
                  { key: 'empty_caption', label: 'Missing caption' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setCaptionStatusFilter(opt.key as CaptionStatusFilterKey);
                      setActiveDropdown(null);
                    }}
                    style={{
                      padding: '6px 10px',
                      textAlign: 'left',
                      backgroundColor:
                        captionStatusFilter === opt.key
                          ? `var(--bg-subtle, ${THEME.default.surfaces.subtle})`
                          : 'transparent',
                      border: 'none',
                      borderRadius: RADII.xs,
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort Plain Text Dropdown with Caret */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              data-testid="media-sort-select"
              onPointerDown={(e) => {
                e.stopPropagation();
                setActiveDropdown((prev) => (prev === 'sort' ? null : 'sort'));
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                padding: 0,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{SORT_OPTION_LABELS[sortOption]}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {activeDropdown === 'sort' && (
              <div
                style={{
                  position: 'absolute',
                  top: '26px',
                  right: 0,
                  backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                  border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                  borderRadius: RADII.xs,
                  padding: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 30,
                  minWidth: '130px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {[
                  { key: 'created_at:desc', label: 'Newest first' },
                  { key: 'created_at:asc', label: 'Oldest first' },
                  { key: 'name:asc', label: 'Name (A–Z)' },
                  { key: 'file_size:desc', label: 'Largest size' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setSortOption(opt.key as SortOptionKey);
                      setActiveDropdown(null);
                    }}
                    style={{
                      padding: '6px 10px',
                      textAlign: 'left',
                      backgroundColor:
                        sortOption === opt.key
                          ? `var(--bg-subtle, ${THEME.default.surfaces.subtle})`
                          : 'transparent',
                      border: 'none',
                      borderRadius: RADII.xs,
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bare Grid/Table Toggle Icons (NO segmented control box) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              data-testid="view-mode-grid-btn"
              aria-label="Grid view"
              onClick={() => handleChangeViewMode('grid')}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                padding: '4px',
                color:
                  viewMode === 'grid'
                    ? PALETTE.primary
                    : `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              data-testid="view-mode-table-btn"
              aria-label="Table view"
              onClick={() => handleChangeViewMode('table')}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                padding: '4px',
                color:
                  viewMode === 'table'
                    ? PALETTE.primary
                    : `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

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
            onClick={() => setCurrentFolderId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const mediaId = e.dataTransfer.getData('application/x-fbuploadpro-media');
              const folderId = e.dataTransfer.getData('application/x-fbuploadpro-folder');
              if (mediaId) {
                try {
                  const parsed = JSON.parse(mediaId);
                  void handleReparent(null, { mediaId: parsed.mediaId });
                } catch {}
              } else if (folderId) {
                try {
                  const parsed = JSON.parse(folderId);
                  void handleReparent(null, { folderId: parsed.folderId });
                } catch {}
              }
            }}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
              color:
                currentFolderId === null
                  ? `var(--text-main, ${THEME.default.text.primary})`
                  : `var(--text-sub, ${THEME.default.text.secondary})`,
              fontWeight:
                currentFolderId === null
                  ? TYPOGRAPHY.weights.semibold
                  : TYPOGRAPHY.weights.regular,
              cursor: 'pointer',
            }}
          >
            All Media
          </button>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                <span style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}>/</span>
                <button
                  type="button"
                  data-testid={`breadcrumb-folder-${crumb.id}`}
                  onClick={() => setCurrentFolderId(crumb.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const mediaId = e.dataTransfer.getData('application/x-fbuploadpro-media');
                    const folderId = e.dataTransfer.getData('application/x-fbuploadpro-folder');
                    if (mediaId) {
                      try {
                        const parsed = JSON.parse(mediaId);
                        void handleReparent(crumb.id, { mediaId: parsed.mediaId });
                      } catch {}
                    } else if (folderId) {
                      try {
                        const parsed = JSON.parse(folderId);
                        void handleReparent(crumb.id, { folderId: parsed.folderId });
                      } catch {}
                    }
                  }}
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

      {/* 4. Subfolders as ROWS (NOT cards) */}
      {currentSubfolders.length > 0 && !debouncedSearch && (
        <section
          aria-label="Subfolders"
          data-testid="subfolders-grid"
          style={{
            marginBottom: SPACING.xl,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              letterSpacing: '0.04em',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              marginBottom: '6px',
            }}
          >
            FOLDERS ({currentSubfolders.length})
          </span>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
            }}
          >
            {currentSubfolders.map((folder) => {
              const childSubfolders = folders.filter((f) => f.parentId === folder.id);
              const folderItems = mediaItems.filter((m) => m.folderId === folder.id);
              const subCount = childSubfolders.length;
              const fileCount = folder.itemCount ?? folderItems.length;

              return (
                <div
                  key={folder.id}
                  data-testid={`folder-row-${folder.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setCurrentFolderId(folder.id);
                    }
                  }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/x-fbuploadpro-folder',
                      JSON.stringify({ folderId: folder.id })
                    );
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const mediaId = e.dataTransfer.getData('application/x-fbuploadpro-media');
                    const folderId = e.dataTransfer.getData('application/x-fbuploadpro-folder');
                    if (mediaId) {
                      try {
                        const parsed = JSON.parse(mediaId);
                        void handleReparent(folder.id, { mediaId: parsed.mediaId });
                      } catch {}
                    } else if (folderId) {
                      try {
                        const parsed = JSON.parse(folderId);
                        void handleReparent(folder.id, { folderId: parsed.folderId });
                      } catch {}
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: `${SPACING.sm} ${SPACING.xs}`,
                    borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                    cursor: 'pointer',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
                    const actionContainer = e.currentTarget.querySelector('.folder-hover-actions') as HTMLElement | null;
                    if (actionContainer) actionContainer.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    const actionContainer = e.currentTarget.querySelector('.folder-hover-actions') as HTMLElement | null;
                    if (actionContainer) actionContainer.style.opacity = '0';
                  }}
                  onClick={() => setCurrentFolderId(folder.id)}
                >
                  {/* Left: Folder icon + Name + Secondary text ("1 subfolder · 0 files") */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={PALETTE.primary}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span
                      data-testid={`folder-name-${folder.id}`}
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: TYPOGRAPHY.weights.medium,
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                      }}
                    >
                      {folder.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: `var(--text-dim, ${THEME.default.text.muted})`,
                      }}
                    >
                      {subCount} subfolder{subCount === 1 ? '' : 's'} · {fileCount} file{fileCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Right: Hover-Revealed Icon Buttons (Rename, Move, Delete) */}
                  <div
                    className="folder-hover-actions"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: 0,
                      transition: 'opacity 0.12s ease',
                    }}
                  >
                    <button
                      type="button"
                      data-testid={`rename-folder-${folder.id}`}
                      aria-label={`Rename ${folder.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameFolderTarget(folder);
                        setRenameDraft(folder.name);
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: `var(--text-sub, ${THEME.default.text.secondary})`,
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      data-testid={`move-folder-${folder.id}`}
                      aria-label={`Move ${folder.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoveTarget({ type: 'folder', folder });
                        setMoveDestinationFolderId(folder.parentId);
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: `var(--text-sub, ${THEME.default.text.secondary})`,
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      data-testid={`delete-folder-${folder.id}`}
                      aria-label={`Delete ${folder.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteFolderTarget(folder);
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: PALETTE.accent3,
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Main Media Asset Canvas: Grid or Table View */}
      {renderMediaCanvas()}

      {/* 6. Floating Batch Action Pill (Bottom Center) */}
      <BatchActionBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onBatchMove={() => {
          setMoveTarget({ type: 'batch_media' });
          setMoveDestinationFolderId(currentFolderId);
        }}
        onBatchCaption={() => setIsBatchCaptionOpen(true)}
        onBatchDelete={handleBatchDelete}
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
          refreshLibraryData();
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
        onUpdateThumbnail={async (_id, _captured) => {
          // If update thumbnail API exists or update local preview
          showToast('Thumbnail updated');
          await refreshLibraryData();
        }}
        onDelete={async (id) => {
          await handleDeleteItem(id);
          setPreviewItem(null);
        }}
      />

      {/* Move Folder / Media Dialog */}
      {moveTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="move-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9500,
            padding: SPACING.md,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
              borderRadius: RADII.md,
              padding: SPACING.xl,
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.md,
            }}
          >
            <h2
              id="move-modal-title"
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Move to folder
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  letterSpacing: '0.04em',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                }}
              >
                SELECT DESTINATION
              </label>
              <select
                value={moveDestinationFolderId || ''}
                onChange={(e) => setMoveDestinationFolderId(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: `${SPACING.xs} ${SPACING.sm}`,
                  backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                  border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                  borderRadius: RADII.xs,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontSize: '0.8125rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Media</option>
                {folders
                  .filter((f) =>
                    moveTarget.type === 'folder' ? f.id !== moveTarget.folder?.id : true
                  )
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
              <button
                type="button"
                onClick={() => setMoveTarget(null)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
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
                style={{
                  padding: `${SPACING.xs} ${SPACING.lg}`,
                  backgroundColor: PALETTE.primary,
                  color: '#000000',
                  border: 'none',
                  borderRadius: RADII.xs,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  cursor: 'pointer',
                }}
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Dialog */}
      {renameFolderTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9500,
            padding: SPACING.md,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
              borderRadius: RADII.md,
              padding: SPACING.xl,
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.md,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Rename folder
            </h2>
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              style={{
                width: '100%',
                padding: `${SPACING.xs} ${SPACING.sm}`,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
              <button
                type="button"
                onClick={() => setRenameFolderTarget(null)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!renameDraft.trim()}
                onClick={() => handleRenameFolder(renameFolderTarget.id, renameDraft.trim())}
                style={{
                  padding: `${SPACING.xs} ${SPACING.lg}`,
                  backgroundColor: renameDraft.trim() ? PALETTE.primary : 'rgba(250, 215, 52, 0.3)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: RADII.xs,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  cursor: renameDraft.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Dialog */}
      {deleteFolderTarget && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="delete-folder-modal"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9500,
            padding: SPACING.md,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
              borderRadius: RADII.md,
              padding: SPACING.xl,
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.md,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Delete folder
            </h2>
            {(() => {
              const impact = computeFolderSubtreeImpact(deleteFolderTarget.id, folders);
              return (
                <p
                  data-testid="delete-folder-impact-summary"
                  style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    lineHeight: 1.45,
                  }}
                >
                  Are you sure you want to delete &ldquo;{deleteFolderTarget.name}&rdquo;?{' '}
                  {impact.subfolderCount > 0 || impact.totalMediaCount > 0
                    ? `${impact.subfolderCount} subfolders and ${impact.totalMediaCount} media files inside will be moved to All Media.`
                    : 'Items inside will be moved to All Media.'}
                </p>
              );
            })()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
              <button
                type="button"
                onClick={() => setDeleteFolderTarget(null)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFolder(deleteFolderTarget.id)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.lg}`,
                  backgroundColor: PALETTE.accent3,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: RADII.xs,
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
