'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import {
  UploadQueueBanner,
  SUPPORTED_MEDIA_ACCEPT,
  buildQueuedEntriesFromFileList,
  extractDroppedFileEntries,
  executeBoundedUploadBatch,
  type UploadBatchState,
} from './upload-queue-banner';
import { MediaAssetCard } from './media-asset-card';
import { MediaPreviewModal } from './media-preview-modal';
import { BatchActionBar } from './batch-action-bar';

export type SortOptionKey =
  | 'created_at:desc'
  | 'created_at:asc'
  | 'name:asc'
  | 'file_size:desc';

export interface FolderSubtreeImpact {
  descendantFolderIds: string[];
  subfolderCount: number;
  totalMediaCount: number;
}

/**
 * Builds the ordered ancestor breadcrumb trail from root up to `currentFolderId`.
 */
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

/**
 * Computes the recursive count of nested subfolders and media items inside `folderId`.
 */
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
  let totalMediaCount = rootFolder ? rootFolder.itemCount : 0;

  const queue: string[] = [folderId];
  const visited = new Set<string>([folderId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenByParent.get(currentId) ?? [];
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        descendantFolderIds.push(child.id);
        totalMediaCount += child.itemCount;
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

/**
 * Filters and sorts media items for the active folder view.
 */
export function filterAndSortMediaItems(
  items: MediaItemResponse[],
  options: {
    currentFolderId: string | null;
    mediaTypeFilter: 'all' | 'video' | 'image';
    searchQuery: string;
    sortOption: SortOptionKey;
  }
): MediaItemResponse[] {
  const { currentFolderId, mediaTypeFilter, searchQuery, sortOption } = options;
  const trimmedSearch = searchQuery.trim().toLowerCase();

  const filtered = items.filter((item) => {
    // Scope to current folder unless searching across current list
    if ((item.folderId ?? null) !== currentFolderId) {
      return false;
    }
    if (mediaTypeFilter !== 'all' && item.mediaType !== mediaTypeFilter) {
      return false;
    }
    if (trimmedSearch.length > 0) {
      const nameMatch = item.name.toLowerCase().includes(trimmedSearch);
      const captionMatch = (item.captionText ?? '')
        .toLowerCase()
        .includes(trimmedSearch);
      if (!nameMatch && !captionMatch) {
        return false;
      }
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortOption === 'name:asc') {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    }
    if (sortOption === 'file_size:desc') {
      return b.fileSize - a.fileSize;
    }
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortOption === 'created_at:asc' ? timeA - timeB : timeB - timeA;
  });

  return sorted;
}

export interface MediaLibraryExplorerProps {
  subdomain: string;
  initialFolders?: MediaFolder[];
  initialMediaItems?: MediaItemResponse[];
  initialCurrentFolderId?: string | null;
  initialSelectedIds?: string[];
  initialSearchQuery?: string;
  initialMediaTypeFilter?: 'all' | 'video' | 'image';
  initialSortOption?: SortOptionKey;
  initialUploadState?: UploadBatchState;
  initialPreviewItem?: MediaItemResponse | null;
  initialFolderModalState?: {
    mode: 'create' | 'rename';
    folder?: MediaFolder;
  } | null;
  initialMoveModalState?: {
    targetType: 'media' | 'folder' | 'batch';
    folder?: MediaFolder;
    mediaItem?: MediaItemResponse;
  } | null;
  initialDeleteFolderTarget?: MediaFolder | null;
  initialBatchCaptionModalOpen?: boolean;
}

export function MediaLibraryExplorer({
  subdomain,
  initialFolders,
  initialMediaItems,
  initialCurrentFolderId = null,
  initialSelectedIds = [],
  initialSearchQuery = '',
  initialMediaTypeFilter = 'all',
  initialSortOption = 'created_at:desc',
  initialUploadState,
  initialPreviewItem = null,
  initialFolderModalState = null,
  initialMoveModalState = null,
  initialDeleteFolderTarget = null,
  initialBatchCaptionModalOpen = false,
}: Readonly<MediaLibraryExplorerProps>) {
  const hasInitialData =
    initialFolders !== undefined || initialMediaItems !== undefined;

  const [folders, setFolders] = useState<MediaFolder[]>(initialFolders ?? []);
  const [mediaItems, setMediaItems] = useState<MediaItemResponse[]>(
    initialMediaItems ?? []
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    initialCurrentFolderId
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'video' | 'image'>(
    initialMediaTypeFilter
  );
  const [sortOption, setSortOption] = useState<SortOptionKey>(initialSortOption);
  const [isLoading, setIsLoading] = useState(!hasInitialData);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Upload Queue State
  const [uploadState, setUploadState] = useState<UploadBatchState>(
    initialUploadState ?? {
      status: 'idle',
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      totalBytes: 0,
      transferredBytes: 0,
      currentFileName: null,
    }
  );
  const cancelUploadRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Drag-and-drop state
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | 'root' | null>(
    null
  );

  // Modals state
  const [previewItem, setPreviewItem] = useState<MediaItemResponse | null>(
    initialPreviewItem
  );
  const [folderModalState, setFolderModalState] = useState<{
    mode: 'create' | 'rename';
    folder?: MediaFolder;
  } | null>(initialFolderModalState);
  const [folderFormName, setFolderFormName] = useState(
    initialFolderModalState?.folder?.name ?? ''
  );
  const [folderFormError, setFolderFormError] = useState<string | null>(null);
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  const [moveModalState, setMoveModalState] = useState<{
    targetType: 'media' | 'folder' | 'batch';
    folder?: MediaFolder;
    mediaItem?: MediaItemResponse;
  } | null>(initialMoveModalState);
  const [selectedMoveDestinationId, setSelectedMoveDestinationId] = useState<
    string | null
  >(null);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);

  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(
    initialDeleteFolderTarget
  );
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  const [batchCaptionModalOpen, setBatchCaptionModalOpen] = useState(
    initialBatchCaptionModalOpen
  );
  const [batchCaptionDraft, setBatchCaptionDraft] = useState('');
  const [isBatchBusy, setIsBatchBusy] = useState(false);

  // Fetch folders and current directory media items
  const refreshLibraryData = useCallback(async () => {
    if (!subdomain || hasInitialData) return;

    const [sortBy, sortOrder] = sortOption.split(':') as [
      'created_at' | 'name' | 'file_size',
      'asc' | 'desc',
    ];
    const query = new URLSearchParams();
    query.set('folderId', currentFolderId ?? 'unorganized');
    if (mediaTypeFilter !== 'all') {
      query.set('mediaType', mediaTypeFilter);
    }
    if (searchQuery.trim().length > 0) {
      query.set('search', searchQuery.trim());
    }
    query.set('sortBy', sortBy);
    query.set('sortOrder', sortOrder);
    query.set('limit', '100');

    try {
      const [foldersRes, mediaRes] = await Promise.all([
        fetch(`/api/tenant/${subdomain}/media/folders`),
        fetch(`/api/tenant/${subdomain}/media?${query.toString()}`),
      ]);

      if (foldersRes.ok) {
        const foldersData = (await foldersRes.json()) as {
          folders: MediaFolder[];
        };
        setFolders(foldersData.folders || []);
      }

      if (mediaRes.ok) {
        const mediaData = (await mediaRes.json()) as {
          items: MediaItemResponse[];
        };
        setMediaItems(mediaData.items || []);
      }
    } catch (_err) {
      // Retain existing state if network request fails
    } finally {
      setIsLoading(false);
    }
  }, [
    subdomain,
    hasInitialData,
    currentFolderId,
    mediaTypeFilter,
    searchQuery,
    sortOption,
  ]);

  useEffect(() => {
    void refreshLibraryData();
  }, [refreshLibraryData]);

  // Derived Explorer Hierarchy
  const breadcrumbs = buildFolderBreadcrumbs(currentFolderId, folders);
  const currentSubfolders = folders
    .filter((f) => (f.parentId ?? null) === currentFolderId)
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const displayedMediaItems = hasInitialData
    ? filterAndSortMediaItems(mediaItems, {
        currentFolderId,
        mediaTypeFilter,
        searchQuery,
        sortOption,
      })
    : mediaItems;

  // Navigation handler
  const handleNavigateFolder = (targetFolderId: string | null) => {
    setCurrentFolderId(targetFolderId);
    setSelectedIds([]);
  };

  // Multi-file & Folder Upload Trigger
  const handleStartUploadBatch = async (
    entries: ReturnType<typeof buildQueuedEntriesFromFileList>
  ) => {
    if (entries.length === 0) return;
    cancelUploadRef.current = false;

    const result = await executeBoundedUploadBatch({
      subdomain,
      baseFolderId: currentFolderId,
      rawEntries: entries,
      existingFolders: folders,
      onStateChange: setUploadState,
      onFoldersUpdated: (updated) => setFolders(updated),
      onItemUploaded: (item) => {
        setMediaItems((prev) => [item, ...prev]);
      },
      isCancelled: () => cancelUploadRef.current,
    });

    if (!hasInitialData && result.uploadedItems.length > 0) {
      await refreshLibraryData();
    }
  };

  // Create or Rename Folder submission
  const handleSubmitFolderForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = folderFormName.trim();
    if (!trimmedName) {
      setFolderFormError('Please enter a folder name.');
      return;
    }

    setIsSubmittingFolder(true);
    setFolderFormError(null);

    try {
      if (folderModalState?.mode === 'create') {
        const res = await fetch(`/api/tenant/${subdomain}/media/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            parentId: currentFolderId,
          }),
        });

        if (res.status === 409) {
          setFolderFormError(
            'A folder with this name already exists in this location.'
          );
          return;
        }
        if (!res.ok) {
          setFolderFormError('Couldn’t create folder. Please try again.');
          return;
        }

        const created = (await res.json()) as MediaFolder;
        setFolders((prev) => [...prev, created]);
        setFolderModalState(null);
        setFolderFormName('');
      } else if (folderModalState?.mode === 'rename' && folderModalState.folder) {
        const target = folderModalState.folder;
        const res = await fetch(
          `/api/tenant/${subdomain}/media/folders/${target.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmedName }),
          }
        );

        if (res.status === 409) {
          setFolderFormError(
            'A folder with this name already exists in this location.'
          );
          return;
        }
        if (!res.ok) {
          setFolderFormError('Couldn’t rename folder. Please try again.');
          return;
        }

        const updated = (await res.json()) as MediaFolder;
        setFolders((prev) =>
          prev.map((f) => (f.id === updated.id ? updated : f))
        );
        setFolderModalState(null);
        setFolderFormName('');
      }
    } catch (_err) {
      setFolderFormError('Couldn’t save folder changes. Please try again.');
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  // Delete Folder Cascade Handler
  const handleConfirmDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    setIsDeletingFolder(true);

    try {
      const targetId = deleteFolderTarget.id;
      const impact = computeFolderSubtreeImpact(targetId, folders);
      const removedFolderSet = new Set([targetId, ...impact.descendantFolderIds]);

      const res = await fetch(
        `/api/tenant/${subdomain}/media/folders/${targetId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setFolders((prev) => prev.filter((f) => !removedFolderSet.has(f.id)));
        setMediaItems((prev) =>
          prev.filter((m) => !m.folderId || !removedFolderSet.has(m.folderId))
        );
        if (currentFolderId && removedFolderSet.has(currentFolderId)) {
          setCurrentFolderId(deleteFolderTarget.parentId ?? null);
        }
        setDeleteFolderTarget(null);
        setFeedbackBanner({
          type: 'success',
          message: `Deleted "${deleteFolderTarget.name}" and its contents.`,
        });
      } else {
        setFeedbackBanner({
          type: 'error',
          message: 'Couldn’t delete folder. Please try again.',
        });
      }
    } catch (_err) {
      setFeedbackBanner({
        type: 'error',
        message: 'Couldn’t delete folder. Please try again.',
      });
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // Inline or Modal Caption / Name Update
  const handleUpdateMediaItem = async (
    mediaId: string,
    updates: { name?: string; captionText?: string; folderId?: string | null }
  ) => {
    // Optimistic update
    setMediaItems((prev) =>
      prev.map((item) =>
        item.id === mediaId
          ? {
              ...item,
              ...(updates.name !== undefined ? { name: updates.name } : {}),
              ...(updates.captionText !== undefined
                ? { captionText: updates.captionText }
                : {}),
              ...(updates.folderId !== undefined
                ? { folderId: updates.folderId }
                : {}),
            }
          : item
      )
    );

    try {
      const res = await fetch(`/api/tenant/${subdomain}/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = (await res.json()) as MediaItemResponse;
        setMediaItems((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      }
    } catch (_err) {
      // Keep optimistic state or refresh on next load
    }
  };

  // Single Media Item Delete
  const handleDeleteMediaItem = async (mediaId: string) => {
    setMediaItems((prev) => prev.filter((item) => item.id !== mediaId));
    setSelectedIds((prev) => prev.filter((id) => id !== mediaId));

    try {
      await fetch(`/api/tenant/${subdomain}/media/${mediaId}`, {
        method: 'DELETE',
      });
    } catch (_err) {
      // Ignore network error after optimistic removal
    }
  };

  // Move Folder or Media Items to Destination Folder
  const executeMoveToDestination = async (destinationFolderId: string | null) => {
    if (!moveModalState) return;
    setIsSubmittingMove(true);

    try {
      if (moveModalState.targetType === 'folder' && moveModalState.folder) {
        const folderToMove = moveModalState.folder;
        const res = await fetch(
          `/api/tenant/${subdomain}/media/folders/${folderToMove.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: destinationFolderId }),
          }
        );

        if (res.ok) {
          const updated = (await res.json()) as MediaFolder;
          setFolders((prev) =>
            prev.map((f) => (f.id === updated.id ? updated : f))
          );
          setMoveModalState(null);
        } else {
          setFeedbackBanner({
            type: 'error',
            message: 'Couldn’t move folder to the selected destination.',
          });
        }
      } else if (
        moveModalState.targetType === 'media' &&
        moveModalState.mediaItem
      ) {
        await handleUpdateMediaItem(moveModalState.mediaItem.id, {
          folderId: destinationFolderId,
        });
        setMoveModalState(null);
      } else if (moveModalState.targetType === 'batch' && selectedIds.length > 0) {
        const res = await fetch(`/api/tenant/${subdomain}/media/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'move',
            mediaIds: selectedIds,
            folderId: destinationFolderId,
          }),
        });

        if (res.ok) {
          const movedSet = new Set(selectedIds);
          setMediaItems((prev) =>
            prev.map((item) =>
              movedSet.has(item.id)
                ? { ...item, folderId: destinationFolderId }
                : item
            )
          );
          setSelectedIds([]);
          setMoveModalState(null);
        }
      }
    } finally {
      setIsSubmittingMove(false);
    }
  };

  // Batch Delete Handler
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchBusy(true);
    const idsToDelete = [...selectedIds];
    const deleteSet = new Set(idsToDelete);

    setMediaItems((prev) => prev.filter((item) => !deleteSet.has(item.id)));
    setSelectedIds([]);

    try {
      await fetch(`/api/tenant/${subdomain}/media/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          mediaIds: idsToDelete,
        }),
      });
    } finally {
      setIsBatchBusy(false);
    }
  };

  // Batch Caption Handler
  const handleConfirmBatchCaption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    setIsBatchBusy(true);
    const idsToUpdate = [...selectedIds];
    const updateSet = new Set(idsToUpdate);
    const nextCaption = batchCaptionDraft.trim();

    setMediaItems((prev) =>
      prev.map((item) =>
        updateSet.has(item.id) ? { ...item, captionText: nextCaption } : item
      )
    );
    setBatchCaptionModalOpen(false);
    setBatchCaptionDraft('');

    try {
      await fetch(`/api/tenant/${subdomain}/media/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'caption',
          mediaIds: idsToUpdate,
          captionText: nextCaption,
        }),
      });
    } finally {
      setIsBatchBusy(false);
    }
  };

  // Drag-and-Drop Reparenting onto Subfolder or Breadcrumb
  const handleDropOnTargetFolder = async (
    e: React.DragEvent<HTMLElement>,
    targetFolderId: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    const mediaPayloadRaw = e.dataTransfer?.getData(
      'application/x-fbuploadpro-media'
    );
    if (mediaPayloadRaw) {
      try {
        const parsed = JSON.parse(mediaPayloadRaw) as { mediaId: string };
        const idsToMove =
          selectedIds.includes(parsed.mediaId) && selectedIds.length > 1
            ? selectedIds
            : [parsed.mediaId];

        const moveSet = new Set(idsToMove);
        setMediaItems((prev) =>
          prev.map((m) =>
            moveSet.has(m.id) ? { ...m, folderId: targetFolderId } : m
          )
        );
        setSelectedIds((prev) => prev.filter((id) => !moveSet.has(id)));

        await fetch(`/api/tenant/${subdomain}/media/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'move',
            mediaIds: idsToMove,
            folderId: targetFolderId,
          }),
        });
      } catch (_err) {
        // Ignore malformed drag payload
      }
      return;
    }

    const folderPayloadRaw = e.dataTransfer?.getData(
      'application/x-fbuploadpro-folder'
    );
    if (folderPayloadRaw) {
      try {
        const parsed = JSON.parse(folderPayloadRaw) as { folderId: string };
        if (parsed.folderId && parsed.folderId !== targetFolderId) {
          const res = await fetch(
            `/api/tenant/${subdomain}/media/folders/${parsed.folderId}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ parentId: targetFolderId }),
            }
          );
          if (res.ok) {
            const updated = (await res.json()) as MediaFolder;
            setFolders((prev) =>
              prev.map((f) => (f.id === updated.id ? updated : f))
            );
          }
        }
      } catch (_err) {
        // Ignore malformed drag payload
      }
      return;
    }

    // Otherwise check if external files/folders were dropped directly onto a folder
    const droppedEntries = await extractDroppedFileEntries(e.dataTransfer);
    if (droppedEntries.length > 0) {
      cancelUploadRef.current = false;
      await executeBoundedUploadBatch({
        subdomain,
        baseFolderId: targetFolderId,
        rawEntries: droppedEntries,
        existingFolders: folders,
        onStateChange: setUploadState,
        onFoldersUpdated: (updated) => setFolders(updated),
        onItemUploaded: (item) => setMediaItems((prev) => [item, ...prev]),
        isCancelled: () => cancelUploadRef.current,
      });
    }
  };

  // Compute delete impact for Delete Folder Confirmation Modal
  const deleteFolderImpact = deleteFolderTarget
    ? computeFolderSubtreeImpact(deleteFolderTarget.id, folders)
    : null;

  // Compute valid destination folders when moving a folder (exclude self and descendants)
  const excludedMoveFolderIds = new Set<string>();
  if (moveModalState?.targetType === 'folder' && moveModalState.folder) {
    excludedMoveFolderIds.add(moveModalState.folder.id);
    const impact = computeFolderSubtreeImpact(moveModalState.folder.id, folders);
    for (const id of impact.descendantFolderIds) {
      excludedMoveFolderIds.add(id);
    }
  }
  const availableMoveFolders = folders.filter(
    (f) => !excludedMoveFolderIds.has(f.id)
  );

  return (
    <div
      data-testid="media-library-explorer"
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDropzoneActive) {
          setIsDropzoneActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDropzoneActive(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDropzoneActive(false);
        void (async () => {
          const entries = await extractDroppedFileEntries(e.dataTransfer);
          if (entries.length > 0) {
            await handleStartUploadBatch(entries);
          }
        })();
      }}
      style={{
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: SPACING.xl,
        boxSizing: 'border-box',
        border: isDropzoneActive
          ? `1px dashed ${PALETTE.primary}`
          : '1px solid transparent',
        borderRadius: RADII.md,
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Hidden File & Directory Picker Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        data-testid="file-upload-input"
        multiple
        accept={SUPPORTED_MEDIA_ACCEPT}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const entries = buildQueuedEntriesFromFileList(e.target.files);
            void handleStartUploadBatch(entries);
            e.target.value = '';
          }
        }}
        style={{ display: 'none' }}
      />
      <input
        ref={(node) => {
          folderInputRef.current = node;
          if (node) {
            node.setAttribute('webkitdirectory', '');
            node.setAttribute('directory', '');
          }
        }}
        type="file"
        data-testid="folder-upload-input"
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const entries = buildQueuedEntriesFromFileList(e.target.files);
            void handleStartUploadBatch(entries);
            e.target.value = '';
          }
        }}
        style={{ display: 'none' }}
      />

      {/* Page Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: SPACING.md,
          marginBottom: SPACING.lg,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            data-testid="media-library-title"
            style={{
              margin: `0 0 ${SPACING.xs} 0`,
              fontSize: '1.5rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              letterSpacing: TYPOGRAPHY.tracking.h1,
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
            Organize folders, edit captions, and upload videos and images for your queues
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            data-testid="new-folder-btn"
            onClick={() => {
              setFolderFormName('');
              setFolderFormError(null);
              setFolderModalState({ mode: 'create' });
            }}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
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
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            <span>New Folder</span>
          </button>

          <button
            type="button"
            data-testid="upload-folder-btn"
            onClick={() => folderInputRef.current?.click()}
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              color: `var(--text-main, ${THEME.default.text.primary})`,
              borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
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
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <polyline points="12 11 12 17" />
              <polyline points="9 14 12 11 15 14" />
            </svg>
            <span>Upload Folder</span>
          </button>

          <button
            type="button"
            data-testid="upload-files-btn"
            onClick={() => fileInputRef.current?.click()}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
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

      {/* Optional Feedback Banner */}
      {feedbackBanner && (
        <div
          data-testid="media-feedback-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACING.sm} ${SPACING.md}`,
            marginBottom: SPACING.md,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid ${
              feedbackBanner.type === 'success' ? PALETTE.accent4 : PALETTE.accent3
            }`,
            borderRadius: RADII.sm,
            fontSize: '0.875rem',
            color:
              feedbackBanner.type === 'success' ? PALETTE.accent4 : PALETTE.accent3,
          }}
        >
          <span>{feedbackBanner.message}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Single Unified Windows Copy-Style Upload Progress Banner */}
      <UploadQueueBanner
        state={uploadState}
        onCancel={() => {
          cancelUploadRef.current = true;
        }}
        onDismiss={() =>
          setUploadState((prev) => ({
            ...prev,
            status: 'idle',
          }))
        }
      />

      {/* Top Breadcrumb Path Bar (Google Drive-Style) */}
      <nav
        data-testid="folder-breadcrumbs"
        aria-label="Folder path navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: SPACING.xs,
          padding: `${SPACING.sm} ${SPACING.md}`,
          marginBottom: SPACING.md,
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
        }}
      >
        <button
          type="button"
          data-testid="breadcrumb-root"
          onClick={() => handleNavigateFolder(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverFolderId('root');
          }}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => void handleDropOnTargetFolder(e, null)}
          style={{
            backgroundColor:
              dragOverFolderId === 'root'
                ? `var(--bg-active, ${THEME.default.surfaces.active})`
                : currentFolderId === null
                  ? `var(--bg-subtle, ${THEME.default.surfaces.subtle})`
                  : 'transparent',
            border:
              dragOverFolderId === 'root'
                ? `1px solid ${PALETTE.primary}`
                : '1px solid transparent',
            borderRadius: RADII.xs,
            padding: '4px 8px',
            color:
              currentFolderId === null
                ? `var(--text-main, ${THEME.default.text.primary})`
                : `var(--text-sub, ${THEME.default.text.secondary})`,
            fontWeight:
              currentFolderId === null
                ? TYPOGRAPHY.weights.bold
                : TYPOGRAPHY.weights.medium,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          All Media
        </button>

        {breadcrumbs.map((crumb) => {
          const isCurrent = crumb.id === currentFolderId;
          const isDragOver = dragOverFolderId === crumb.id;
          return (
            <React.Fragment key={crumb.id}>
              <span
                aria-hidden="true"
                style={{
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  fontSize: '0.875rem',
                  userSelect: 'none',
                }}
              >
                /
              </span>
              <button
                type="button"
                data-testid={`breadcrumb-folder-${crumb.id}`}
                onClick={() => handleNavigateFolder(crumb.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverFolderId(crumb.id);
                }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => void handleDropOnTargetFolder(e, crumb.id)}
                style={{
                  backgroundColor: isDragOver
                    ? `var(--bg-active, ${THEME.default.surfaces.active})`
                    : isCurrent
                      ? `var(--bg-subtle, ${THEME.default.surfaces.subtle})`
                      : 'transparent',
                  border: isDragOver
                    ? `1px solid ${PALETTE.primary}`
                    : '1px solid transparent',
                  borderRadius: RADII.xs,
                  padding: '4px 8px',
                  color: isCurrent
                    ? `var(--text-main, ${THEME.default.text.primary})`
                    : `var(--text-sub, ${THEME.default.text.secondary})`,
                  fontWeight: isCurrent
                    ? TYPOGRAPHY.weights.bold
                    : TYPOGRAPHY.weights.medium,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Search, Filter & Sort Toolbar */}
      <div
        data-testid="media-explorer-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: SPACING.md,
          marginBottom: SPACING.lg,
        }}
      >
        {/* Search Input */}
        <div style={{ flex: '1 1 260px', maxWidth: '420px' }}>
          <input
            type="search"
            data-testid="media-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name or caption..."
            aria-label="Search by file name or caption"
            style={{
              ...COMPONENT_STYLES.input(THEME.default),
              width: '100%',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter Buttons & Sort Select */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            flexWrap: 'wrap',
          }}
        >
          <div
            role="group"
            aria-label="Filter by media type"
            style={{
              display: 'inline-flex',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              padding: '2px',
              gap: '2px',
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
                  data-testid={`filter-type-${tab.key}`}
                  onClick={() => setMediaTypeFilter(tab.key)}
                  style={{
                    height: '32px',
                    padding: `0 ${SPACING.md}`,
                    backgroundColor: active
                      ? `var(--bg-active, ${THEME.default.surfaces.active})`
                      : 'transparent',
                    color: active
                      ? `var(--text-main, ${THEME.default.text.primary})`
                      : `var(--text-sub, ${THEME.default.text.secondary})`,
                    border: 'none',
                    borderRadius: RADII.xs,
                    fontSize: '0.8125rem',
                    fontWeight: active
                      ? TYPOGRAPHY.weights.semibold
                      : TYPOGRAPHY.weights.medium,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <select
            data-testid="media-sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOptionKey)}
            aria-label="Sort media assets"
            style={{
              ...COMPONENT_STYLES.input(THEME.default),
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              padding: `0 ${SPACING.md}`,
              cursor: 'pointer',
            }}
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="name:asc">Name (A–Z)</option>
            <option value="file_size:desc">Largest size</option>
          </select>
        </div>
      </div>

      {/* Floating Batch Selection Action Bar */}
      <BatchActionBar
        selectedIds={selectedIds}
        totalAvailableCount={displayedMediaItems.length}
        onSelectAll={() =>
          setSelectedIds(displayedMediaItems.map((item) => item.id))
        }
        onClearSelection={() => setSelectedIds([])}
        onBatchMove={() => {
          setSelectedMoveDestinationId(currentFolderId);
          setMoveModalState({ targetType: 'batch' });
        }}
        onBatchCaption={() => {
          setBatchCaptionDraft('');
          setBatchCaptionModalOpen(true);
        }}
        onBatchDelete={() => void handleBatchDelete()}
        isBusy={isBatchBusy}
      />

      {/* Subfolders Section */}
      {currentSubfolders.length > 0 && (
        <section
          aria-label="Subfolders"
          style={{ marginBottom: SPACING.xl }}
        >
          <h2
            style={{
              margin: `0 0 ${SPACING.sm} 0`,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              letterSpacing: TYPOGRAPHY.tracking.h3,
            }}
          >
            Folders ({currentSubfolders.length})
          </h2>

          <div
            data-testid="subfolders-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: SPACING.md,
            }}
          >
            {currentSubfolders.map((folder) => {
              const isDragOver = dragOverFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  data-testid={`folder-card-${folder.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer?.setData(
                      'application/x-fbuploadpro-folder',
                      JSON.stringify({ folderId: folder.id })
                    );
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => void handleDropOnTargetFolder(e, folder.id)}
                  style={{
                    backgroundColor: isDragOver
                      ? `var(--bg-active, ${THEME.default.surfaces.active})`
                      : `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                    border: `1px solid ${
                      isDragOver
                        ? PALETTE.primary
                        : `var(--border-subtle, ${THEME.default.borders.hairline})`
                    }`,
                    borderRadius: RADII.md,
                    boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
                    padding: SPACING.md,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACING.sm,
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <button
                    type="button"
                    data-testid={`open-folder-${folder.id}`}
                    onClick={() => handleNavigateFolder(folder.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACING.sm,
                      backgroundColor: 'transparent',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      width: '100%',
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={PALETTE.primary}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: TYPOGRAPHY.weights.semibold,
                          color: `var(--text-main, ${THEME.default.text.primary})`,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {folder.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: `var(--text-dim, ${THEME.default.text.muted})`,
                          fontVariantNumeric: TYPOGRAPHY.tabularNums,
                        }}
                      >
                        {folder.subfolderCount}{' '}
                        {folder.subfolderCount === 1 ? 'subfolder' : 'subfolders'} ·{' '}
                        {folder.itemCount} {folder.itemCount === 1 ? 'file' : 'files'}
                      </div>
                    </div>
                  </button>

                  {/* Folder Card Quick Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: SPACING.xs,
                      paddingTop: SPACING.xs,
                      borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    }}
                  >
                    <button
                      type="button"
                      data-testid={`rename-folder-${folder.id}`}
                      onClick={() => {
                        setFolderFormName(folder.name);
                        setFolderFormError(null);
                        setFolderModalState({ mode: 'rename', folder });
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                        borderRadius: RADII.xs,
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        color: `var(--text-sub, ${THEME.default.text.secondary})`,
                        cursor: 'pointer',
                      }}
                    >
                      Rename
                    </button>

                    <button
                      type="button"
                      data-testid={`move-folder-${folder.id}`}
                      onClick={() => {
                        setSelectedMoveDestinationId(folder.parentId ?? null);
                        setMoveModalState({ targetType: 'folder', folder });
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                        borderRadius: RADII.xs,
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        color: `var(--text-sub, ${THEME.default.text.secondary})`,
                        cursor: 'pointer',
                      }}
                    >
                      Move
                    </button>

                    <button
                      type="button"
                      data-testid={`delete-folder-${folder.id}`}
                      onClick={() => setDeleteFolderTarget(folder)}
                      style={{
                        backgroundColor: 'transparent',
                        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                        borderRadius: RADII.xs,
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        color: PALETTE.accent3,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Media Assets Section */}
      <section aria-label="Media assets">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: SPACING.sm,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              letterSpacing: TYPOGRAPHY.tracking.h3,
            }}
          >
            Media Assets ({displayedMediaItems.length})
          </h2>

          {displayedMediaItems.length > 0 && (
            <button
              type="button"
              data-testid="toggle-select-all-media-btn"
              onClick={() => {
                if (selectedIds.length === displayedMediaItems.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(displayedMediaItems.map((m) => m.id));
                }
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
              }}
            >
              {selectedIds.length === displayedMediaItems.length
                ? 'Deselect all'
                : 'Select all in folder'}
            </button>
          )}
        </div>

        {isLoading ? (
          <div
            data-testid="media-loading-skeleton"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: SPACING.lg,
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{
                  height: '240px',
                  backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  borderRadius: RADII.md,
                  opacity: 0.45,
                }}
              />
            ))}
          </div>
        ) : displayedMediaItems.length === 0 ? (
          <div
            data-testid="media-empty-state"
            style={{
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.md,
              padding: SPACING.xxl,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: SPACING.sm,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {searchQuery.trim()
                ? 'No matching media found'
                : 'This folder has no media assets yet'}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                maxWidth: '460px',
              }}
            >
              {searchQuery.trim()
                ? 'Try adjusting your search keywords or media type filter.'
                : 'Drag and drop videos, images, or entire folders from your computer here to start organizing your content.'}
            </p>
            {!searchQuery.trim() && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  marginTop: SPACING.xs,
                }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={COMPONENT_STYLES.primaryButton}
                >
                  Upload Files
                </button>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  style={{
                    ...COMPONENT_STYLES.secondaryButton(THEME.default),
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                  }}
                >
                  Upload Folder
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            data-testid="media-assets-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: SPACING.lg,
            }}
          >
            {displayedMediaItems.map((item) => (
              <MediaAssetCard
                key={item.id}
                item={item}
                selected={selectedIds.includes(item.id)}
                onToggleSelect={(mediaId) => {
                  setSelectedIds((prev) =>
                    prev.includes(mediaId)
                      ? prev.filter((id) => id !== mediaId)
                      : [...prev, mediaId]
                  );
                }}
                onPreview={(target) => setPreviewItem(target)}
                onUpdateCaption={(mediaId, captionText) =>
                  handleUpdateMediaItem(mediaId, { captionText })
                }
                onMoveRequest={(target) => {
                  setSelectedMoveDestinationId(target.folderId ?? null);
                  setMoveModalState({ targetType: 'media', mediaItem: target });
                }}
                onDeleteRequest={(target) => void handleDeleteMediaItem(target.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Media Preview & Caption Modal */}
      <MediaPreviewModal
        item={previewItem}
        open={Boolean(previewItem)}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
        onSave={(mediaId, updates) => handleUpdateMediaItem(mediaId, updates)}
        onDelete={(mediaId) => handleDeleteMediaItem(mediaId)}
      />

      {/* Create / Rename Folder Modal */}
      <Dialog
        open={Boolean(folderModalState)}
        onOpenChange={(open) => {
          if (!open) {
            setFolderModalState(null);
            setFolderFormError(null);
          }
        }}
      >
        <DialogContent
          data-testid="folder-form-modal"
          style={{ maxWidth: '440px' }}
        >
          <form onSubmit={(e) => void handleSubmitFolderForm(e)}>
            <DialogHeader>
              <DialogTitle>
                {folderModalState?.mode === 'rename'
                  ? 'Rename Folder'
                  : 'Create New Folder'}
              </DialogTitle>
              <DialogDescription>
                {folderModalState?.mode === 'rename'
                  ? 'Enter a new name for this folder.'
                  : 'Create a folder inside the current location to organize your media.'}
              </DialogDescription>
            </DialogHeader>

            <DialogBody
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACING.sm,
              }}
            >
              <label
                htmlFor="folder-name-input"
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                }}
              >
                Folder name
              </label>
              <input
                id="folder-name-input"
                type="text"
                data-testid="folder-name-input"
                value={folderFormName}
                onChange={(e) => setFolderFormName(e.target.value)}
                placeholder="e.g. Q4 Reels Campaign"
                autoFocus
                style={{
                  ...COMPONENT_STYLES.input(THEME.default),
                  width: '100%',
                  backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  boxSizing: 'border-box',
                }}
              />
              {folderFormError && (
                <p
                  data-testid="folder-form-error"
                  style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    color: PALETTE.accent3,
                  }}
                >
                  {folderFormError}
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setFolderModalState(null)}
                style={{
                  ...COMPONENT_STYLES.secondaryButton(THEME.default),
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="folder-form-submit-btn"
                disabled={isSubmittingFolder}
                style={COMPONENT_STYLES.primaryButton}
              >
                {isSubmittingFolder
                  ? 'Saving...'
                  : folderModalState?.mode === 'rename'
                    ? 'Save name'
                    : 'Create folder'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move to Folder Destination Modal */}
      <Dialog
        open={Boolean(moveModalState)}
        onOpenChange={(open) => {
          if (!open) setMoveModalState(null);
        }}
      >
        <DialogContent
          data-testid="move-destination-modal"
          style={{ maxWidth: '460px' }}
        >
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Choose a destination folder for the selected content.
            </DialogDescription>
          </DialogHeader>

          <DialogBody
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.xs,
            }}
          >
            <button
              type="button"
              data-testid="move-dest-root"
              onClick={() => setSelectedMoveDestinationId(null)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: `${SPACING.sm} ${SPACING.md}`,
                backgroundColor:
                  selectedMoveDestinationId === null
                    ? `var(--bg-active, ${THEME.default.surfaces.active})`
                    : `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                border: `1px solid ${
                  selectedMoveDestinationId === null
                    ? PALETTE.primary
                    : `var(--border-subtle, ${THEME.default.borders.hairline})`
                }`,
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
              }}
            >
              All Media (Root)
            </button>

            {availableMoveFolders.map((f) => {
              const isSelected = selectedMoveDestinationId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  data-testid={`move-dest-${f.id}`}
                  onClick={() => setSelectedMoveDestinationId(f.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: `${SPACING.sm} ${SPACING.md}`,
                    backgroundColor: isSelected
                      ? `var(--bg-active, ${THEME.default.surfaces.active})`
                      : `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                    border: `1px solid ${
                      isSelected
                        ? PALETTE.primary
                        : `var(--border-subtle, ${THEME.default.borders.hairline})`
                    }`,
                    borderRadius: RADII.xs,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    fontSize: '0.875rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    cursor: 'pointer',
                  }}
                >
                  {f.name}
                </button>
              );
            })}
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setMoveModalState(null)}
              style={{
                ...COMPONENT_STYLES.secondaryButton(THEME.default),
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-move-btn"
              disabled={isSubmittingMove}
              onClick={() =>
                void executeMoveToDestination(selectedMoveDestinationId)
              }
              style={COMPONENT_STYLES.primaryButton}
            >
              {isSubmittingMove ? 'Moving...' : 'Move here'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Destructive Confirmation Modal */}
      <Dialog
        open={Boolean(deleteFolderTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteFolderTarget(null);
        }}
      >
        <DialogContent
          data-testid="delete-folder-modal"
          style={{ maxWidth: '460px' }}
        >
          <DialogHeader>
            <DialogTitle>
              Delete &ldquo;{deleteFolderTarget?.name}&rdquo;?
            </DialogTitle>
            <DialogDescription>
              This action permanently deletes the folder and everything inside it.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div
              data-testid="delete-folder-impact-summary"
              style={{
                padding: SPACING.md,
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                border: `1px solid ${PALETTE.accent3}`,
                borderRadius: RADII.sm,
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              <p
                style={{
                  margin: `0 0 ${SPACING.xs} 0`,
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: PALETTE.accent3,
                }}
              >
                Permanent deletion warning
              </p>
              <p style={{ margin: 0 }}>
                Deleting <strong>{deleteFolderTarget?.name}</strong> will permanently
                remove{' '}
                <strong>
                  {deleteFolderImpact?.subfolderCount ?? 0}{' '}
                  {deleteFolderImpact?.subfolderCount === 1
                    ? 'subfolder'
                    : 'subfolders'}
                </strong>{' '}
                and{' '}
                <strong>
                  {deleteFolderImpact?.totalMediaCount ?? 0}{' '}
                  {deleteFolderImpact?.totalMediaCount === 1
                    ? 'media file'
                    : 'media files'}
                </strong>
                . This cannot be undone.
              </p>
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              type="button"
              data-testid="cancel-delete-folder-btn"
              disabled={isDeletingFolder}
              onClick={() => setDeleteFolderTarget(null)}
              style={{
                ...COMPONENT_STYLES.secondaryButton(THEME.default),
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="confirm-delete-folder-btn"
              disabled={isDeletingFolder}
              onClick={() => void handleConfirmDeleteFolder()}
              style={{
                height: '38px',
                padding: `0 ${SPACING.md}`,
                backgroundColor: PALETTE.accent3,
                color: PALETTE.text,
                border: 'none',
                borderRadius: RADII.sm,
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                cursor: isDeletingFolder ? 'not-allowed' : 'pointer',
              }}
            >
              {isDeletingFolder ? 'Deleting...' : 'Delete folder & contents'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Set Caption Modal */}
      <Dialog
        open={batchCaptionModalOpen}
        onOpenChange={setBatchCaptionModalOpen}
      >
        <DialogContent
          data-testid="batch-caption-modal"
          style={{ maxWidth: '460px' }}
        >
          <form onSubmit={(e) => void handleConfirmBatchCaption(e)}>
            <DialogHeader>
              <DialogTitle>Set Caption for {selectedIds.length} Items</DialogTitle>
              <DialogDescription>
                Apply a shared publishing caption to all selected media assets.
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <textarea
                data-testid="batch-caption-input"
                rows={4}
                value={batchCaptionDraft}
                onChange={(e) => setBatchCaptionDraft(e.target.value)}
                placeholder="Write a caption for the selected items..."
                style={{
                  width: '100%',
                  padding: SPACING.sm,
                  backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  borderRadius: RADII.sm,
                  fontSize: '0.875rem',
                  fontFamily: TYPOGRAPHY.fontFamily,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </DialogBody>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setBatchCaptionModalOpen(false)}
                style={{
                  ...COMPONENT_STYLES.secondaryButton(THEME.default),
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  borderColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="confirm-batch-caption-btn"
                disabled={isBatchBusy}
                style={COMPONENT_STYLES.primaryButton}
              >
                Apply caption
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
