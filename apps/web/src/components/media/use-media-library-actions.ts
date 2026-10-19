'use client';

import React, { useCallback } from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import type { BatchCaptionMode } from './media-types';
import { readInternalDropPayload } from './media-library-helpers';

/**
 * Data-mutation handlers for the media library, extracted from
 * media-library-explorer.tsx. No behavior changes — moved verbatim.
 */

export interface MediaLibraryActionsParams {
  subdomain: string;
  // Guard values
  isRenamingFolder: boolean;
  isDeletingFolder: boolean;
  isMoving: boolean;
  isBatchDeleting: boolean;
  isBatchCaptioning: boolean;
  deletingAssetId: string | null;
  currentFolderId: string | null;
  selectedIds: string[];
  mediaItems: MediaItemResponse[];
  // Setters
  setFolders: React.Dispatch<React.SetStateAction<MediaFolder[]>>;
  setMediaItems: React.Dispatch<React.SetStateAction<MediaItemResponse[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setRenameFolderTarget: React.Dispatch<React.SetStateAction<MediaFolder | null>>;
  setIsRenamingFolder: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteFolderTarget: React.Dispatch<React.SetStateAction<MediaFolder | null>>;
  setIsDeletingFolder: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMoving: React.Dispatch<React.SetStateAction<boolean>>;
  setMoveTarget: React.Dispatch<
    React.SetStateAction<{
      type: 'single_media' | 'batch_media' | 'folder';
      mediaItem?: MediaItemResponse;
      folder?: MediaFolder;
    } | null>
  >;
  setIsBatchDeleting: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsBatchCaptioning: React.Dispatch<React.SetStateAction<boolean>>;
  setDeletingAssetId: React.Dispatch<React.SetStateAction<string | null>>;
  setStagedFilesForImport: React.Dispatch<React.SetStateAction<File[]>>;
  setIsImportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useMediaLibraryActions(params: MediaLibraryActionsParams) {
  const {
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
  } = params;

  const showToast = useCallback(
    (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3500);
    },
    [setToastMessage]
  );

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
  }, [subdomain, setFolders, setMediaItems, setIsLoading]);

  const handleCreateFolder = useCallback(
    async (name: string, parentId: string | null) => {
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
    },
    [subdomain, showToast, refreshLibraryData, setCurrentFolderId]
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, newName: string) => {
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
    },
    [subdomain, isRenamingFolder, showToast, refreshLibraryData, setRenameFolderTarget, setIsRenamingFolder]
  );

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
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
    },
    [
      subdomain,
      isDeletingFolder,
      currentFolderId,
      showToast,
      refreshLibraryData,
      setDeleteFolderTarget,
      setCurrentFolderId,
      setIsDeletingFolder,
    ]
  );

  const handleReparent = useCallback(
    async (
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
    },
    [subdomain, isMoving, showToast, refreshLibraryData, setIsMoving]
  );

  const handleBatchCaptionApply = useCallback(
    async (text: string, mode: BatchCaptionMode) => {
      if (selectedIds.length === 0 || isBatchCaptioning) return;
      setIsBatchCaptioning(true);
      try {
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
    },
    [
      subdomain,
      selectedIds,
      isBatchCaptioning,
      mediaItems,
      showToast,
      refreshLibraryData,
      setSelectedIds,
      setIsBatchCaptioning,
    ]
  );

  const handleBatchDelete = useCallback(async () => {
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
  }, [
    subdomain,
    selectedIds,
    isBatchDeleting,
    showToast,
    refreshLibraryData,
    setSelectedIds,
    setIsBatchDeleting,
  ]);

  const handleBatchMoveSubmit = useCallback(
    async (destinationId: string | null) => {
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
    },
    [
      subdomain,
      selectedIds,
      isMoving,
      showToast,
      refreshLibraryData,
      setSelectedIds,
      setMoveTarget,
      setIsMoving,
    ]
  );

  const handleUpdateItemCaption = useCallback(
    async (mediaId: string, captionText: string) => {
      await fetch(`/api/tenant/${subdomain}/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captionText }),
      });
      setMediaItems((prev) =>
        prev.map((m) => (m.id === mediaId ? { ...m, captionText } : m))
      );
    },
    [subdomain, setMediaItems]
  );

  const handleDeleteItem = useCallback(
    async (mediaId: string) => {
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
    },
    [subdomain, deletingAssetId, showToast, setMediaItems, setDeletingAssetId]
  );

  const handleFilesDrop = useCallback(
    (e: React.DragEvent, targetFolderId?: string | null) => {
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
    },
    [handleReparent, setStagedFilesForImport, setIsImportModalOpen]
  );

  return {
    showToast,
    refreshLibraryData,
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
  };
}
