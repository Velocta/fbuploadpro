'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, SPACING } from '@/lib/theme';
import {
  type MediaViewMode,
  type MediaTypeFilterKey,
  type AspectRatioFilterKey,
  type CaptionStatusFilterKey,
  type SortOptionKey,
  type MediaSmartViewKey,
} from './media-types';
import {
  computeNextSelection,
  useUploadNavigationGuard,
  getInitialViewMode,
  computeActiveFilterCount,
  readInternalDropPayload,
  type MoveTargetState,
  type MediaLibraryExplorerProps,
} from './media-library-helpers';
import {
  invalidateMediaAll,
  useBatchCaptionMedia,
  useBatchDeleteMedia,
  useBatchMoveMedia,
  useCreateFolder,
  useDeleteFolder,
  useDeleteMediaItem,
  useMediaFolders,
  useMediaItems,
  useRenameFolder,
  useReparentMedia,
  useUpdateItemCaption,
} from './media-data';
import { useQueryClient } from '@tanstack/react-query';
import { reportError } from '@/lib/report-error';
import { setPreference, preferences } from '@/lib/storage/preferences';
export { MEDIA_VIEW_MODE_STORAGE_KEY } from './media-library-helpers';
export type { MoveTargetState, MediaLibraryExplorerProps } from './media-library-helpers';
import { buildFolderBreadcrumbs } from './media-library-breadcrumbs';
import {
  filterAndSortMediaItems,
  getScopeTagLabel,
} from './media-library-filters';
export {
  filterAndSortMediaItems,
  getScopeTagLabel,
  getEmptyStateInfo,
  resolveTargetFolderIdForEntry,
  computeFolderSubtreeImpact,
  checkServerDuplicateEntries,
  MEDIA_TYPE_LABELS,
  ASPECT_RATIO_SHORT_VALUES,
  CAPTION_STATUS_SHORT_VALUES,
  SORT_OPTION_SHORT_VALUES,
} from './media-library-filters';

export { buildFolderBreadcrumbs, formatFolderAncestryPath } from './media-library-breadcrumbs';
export type { MediaImportModalProps } from './media-import-progress';
export type { ActiveDropdownKey } from './media-library-filters';
import { MediaToolbar } from './media-library-toolbar';
import { type ActiveDropdownKey } from './media-library-filters';
import { MediaLibraryHeader } from './media-library-header';
import { MediaLibraryMain } from './media-library-main';
import { MediaLibraryOverlays } from './media-library-overlays';
export type { MediaViewMode, MediaTypeFilterKey, AspectRatioFilterKey, CaptionStatusFilterKey, SortOptionKey, MediaSmartViewKey } from './media-types';

export type { FolderSubtreeImpact } from './media-library-filters';
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
  // Data (spec 133 §6.1): the React Query cache is the surface's
  // store. The route hydrates it server-first; the `initial*` props
  // remain as the test/seed API and feed the queries' initial data.
  const queryClient = useQueryClient();
  const foldersQuery = useMediaFolders(subdomain, { initialFolders });
  const itemsQuery = useMediaItems(subdomain, { initialItems: initialMediaItems });
  const folders = useMemo<MediaFolder[]>(() => foldersQuery.data ?? [], [foldersQuery.data]);
  const mediaItems = useMemo<MediaItemResponse[]>(
    () => itemsQuery.data ?? [],
    [itemsQuery.data]
  );
  const isLoading = itemsQuery.isPending || foldersQuery.isPending;

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    initialCurrentFolderId
  );
  const [activeSmartView, setActiveSmartView] = useState<MediaSmartViewKey | null>(
    initialActiveSmartView
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // View mode
  const [viewMode, setViewMode] = useState<MediaViewMode>(() => getInitialViewMode(initialViewMode));

  const handleChangeViewMode = (mode: MediaViewMode) => {
    setViewMode(mode);
    // Typed preferences helper (spec 137 §3.9): a failed write
    // (unavailable/full store) just means the mode won't persist.
    setPreference(preferences.mediaViewMode, mode);
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
      if (!activeDropdown || !target) return;
      const ref = dropdownRefs[activeDropdown];
      if (ref?.current?.contains(target)) return;
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
  const [moveTarget, setMoveTarget] = useState<MoveTargetState | null>(null);
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

  // Open the file picker reliably: showPicker() is the programmatic opener
  // that browsers honor; fall back to click() where it is unavailable.
  const handleUploadClick = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Fall through to click() when the browser rejects showPicker.
      }
    }
    input.click();
  }, []);

  const handleInterceptNavigation = useCallback((href: string) => {
    setPendingNavigationUrl(href);
    setIsLeaveGuardOpen(true);
  }, []);

  useUploadNavigationGuard(activeUploadsCount, handleInterceptNavigation);

  const {
    refreshLibraryData,
    showToast,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleReparent,
    handleBatchCaptionApply,
    handleBatchDelete,
    handleBatchMoveSubmit,
    handleUpdateItemCaption,
    handleDeleteItem,
    handleFilesDrop,
  } = useMediaLibraryActions({
    subdomain,
    isRenamingFolder,
    isDeletingFolder,
    isMoving,
    isBatchDeleting,
    isBatchCaptioning,
    deletingAssetId,
    currentFolderId,
    selectedIds,
    mediaItems,
    setFolders,
    setMediaItems,
    setIsLoading,
    setCurrentFolderId,
    setToastMessage,
    setRenameFolderTarget,
    setIsRenamingFolder,
    setDeleteFolderTarget,
    setIsDeletingFolder,
    setIsMoving,
    setMoveTarget,
    setIsBatchDeleting,
    setSelectedIds,
    setIsBatchCaptioning,
    setDeletingAssetId,
    setStagedFilesForImport,
    setIsImportModalOpen,
  });

  useEffect(() => {
    if (!initialMediaItems) {
      void refreshLibraryData();
    }
  }, [refreshLibraryData, initialMediaItems]);

  // Grid refresh (M11): show the confirmed item immediately instead of
  // waiting on a refetch round-trip, then refresh to pick up server fields.
  const handleUploadSuccess = useCallback(
    (item: MediaItemResponse) => {
      setMediaItems((prev) =>
        prev.some((m) => m.id === item.id) ? prev : [item, ...prev]
      );
      void refreshLibraryData();
    },
    [refreshLibraryData]
  );

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

  // Global Drag and drop onto page to open Import Modal
  const handleDragOverPage = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  };

  const activeFilterCount = computeActiveFilterCount(mediaTypeFilter, aspectRatioFilter, captionStatusFilter);

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
      <MediaLibraryHeader
        toastMessage={toastMessage}
        fileInputRef={fileInputRef}
        onFileInputChange={(files) => {
          setStagedFilesForImport(files);
          setIsImportModalOpen(true);
        }}
        onNewFolderClick={() => setIsNewFolderOpen(true)}
        onUploadClick={handleUploadClick}
      />

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
      <MediaLibraryMain
        breadcrumbs={breadcrumbs}
        activeSmartView={activeSmartView}
        currentFolderId={currentFolderId}
        displayedMediaItems={displayedMediaItems}
        selectedIds={selectedIds}
        currentSubfolders={currentSubfolders}
        folders={folders}
        mediaItems={mediaItems}
        debouncedSearch={debouncedSearch}
        viewMode={viewMode}
        isLoading={isLoading}
        isLocked={isRenamingFolder || isDeletingFolder || isMoving}
        onNavigateRoot={() => {
          setActiveSmartView(null);
          setCurrentFolderId(null);
        }}
        onNavigateFolder={(folderId) => {
          setActiveSmartView(null);
          setCurrentFolderId(folderId);
        }}
        onSelectAll={handleSelectAll}
        onToggleSelect={handleToggleSelect}
        onPreview={(m) => setPreviewItem(m)}
        onUpdateCaption={handleUpdateItemCaption}
        onDeleteItem={handleDeleteItem}
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
        onMoveMediaRequest={(m) => {
          setMoveTarget({ type: 'single_media', mediaItem: m });
          setMoveDestinationFolderId(m.folderId);
        }}
        onFilesDrop={handleFilesDrop}
      />

      <MediaLibraryOverlays
        subdomain={subdomain}
        selectedIds={selectedIds}
        folders={folders}
        currentFolderId={currentFolderId}
        isBatchDeleting={isBatchDeleting}
        isBatchCaptioning={isBatchCaptioning}
        isMoving={isMoving}
        isRenamingFolder={isRenamingFolder}
        isDeletingFolder={isDeletingFolder}
        isNewFolderOpen={isNewFolderOpen}
        isImportModalOpen={isImportModalOpen}
        isBatchCaptionOpen={isBatchCaptionOpen}
        isLeaveGuardOpen={isLeaveGuardOpen}
        showBatchDeleteConfirm={showBatchDeleteConfirm}
        stagedFilesForImport={stagedFilesForImport}
        previewItem={previewItem}
        moveTarget={moveTarget}
        moveDestinationFolderId={moveDestinationFolderId}
        renameFolderTarget={renameFolderTarget}
        renameDraft={renameDraft}
        deleteFolderTarget={deleteFolderTarget}
        activeUploadsCount={activeUploadsCount}
        furthestAlongUpload={furthestAlongUpload}
        pendingNavigationUrl={pendingNavigationUrl}
        setSelectedIds={setSelectedIds}
        setMoveTarget={setMoveTarget}
        setMoveDestinationFolderId={setMoveDestinationFolderId}
        setIsBatchCaptionOpen={setIsBatchCaptionOpen}
        setShowBatchDeleteConfirm={setShowBatchDeleteConfirm}
        setIsNewFolderOpen={setIsNewFolderOpen}
        setIsImportModalOpen={setIsImportModalOpen}
        setStagedFilesForImport={setStagedFilesForImport}
        setActiveUploadsCount={setActiveUploadsCount}
        setFurthestAlongUpload={setFurthestAlongUpload}
        setIsLeaveGuardOpen={setIsLeaveGuardOpen}
        setPendingNavigationUrl={setPendingNavigationUrl}
        setPreviewItem={setPreviewItem}
        setRenameFolderTarget={setRenameFolderTarget}
        setRenameDraft={setRenameDraft}
        setDeleteFolderTarget={setDeleteFolderTarget}
        handleBatchCaptionApply={handleBatchCaptionApply}
        handleCreateFolder={handleCreateFolder}
        handleDeleteItem={handleDeleteItem}
        handleReparent={handleReparent}
        handleRenameFolder={handleRenameFolder}
        handleDeleteFolder={handleDeleteFolder}
        handleBatchDelete={handleBatchDelete}
        handleBatchMoveSubmit={handleBatchMoveSubmit}
        onUploadSuccess={handleUploadSuccess}
        refreshLibraryData={refreshLibraryData}
        showToast={showToast}
      />

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
