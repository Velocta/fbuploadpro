'use client';

import React from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { BatchActionBar } from './batch-action-bar';
import { BatchSetCaptionModal } from './batch-set-caption-modal';
import { MediaImportModal } from './media-import-modal';
import { NewFolderModal } from './new-folder-modal';
import { LeavePageGuardDialog } from './leave-page-guard-dialog';
import { MediaPreviewModal } from './media-preview-modal';
import {
  MoveTargetDialog,
  RenameFolderDialog,
  DeleteFolderDialog,
  BatchDeleteConfirmDialog,
} from './media-library-dialogs';
import type { MoveTargetState } from './media-library-helpers';

/**
 * All modal/dialog overlays for the media library, extracted from
 * media-library-explorer.tsx. No behavior changes — moved verbatim.
 */

export interface MediaLibraryOverlaysProps {
  subdomain: string;
  selectedIds: string[];
  folders: MediaFolder[];
  currentFolderId: string | null;
  isBatchDeleting: boolean;
  isBatchCaptioning: boolean;
  isMoving: boolean;
  isRenamingFolder: boolean;
  isDeletingFolder: boolean;
  isNewFolderOpen: boolean;
  isImportModalOpen: boolean;
  isBatchCaptionOpen: boolean;
  isLeaveGuardOpen: boolean;
  showBatchDeleteConfirm: boolean;
  stagedFilesForImport: File[];
  previewItem: MediaItemResponse | null;
  moveTarget: MoveTargetState | null;
  moveDestinationFolderId: string | null;
  renameFolderTarget: MediaFolder | null;
  renameDraft: string;
  deleteFolderTarget: MediaFolder | null;
  activeUploadsCount: number;
  furthestAlongUpload: { name: string; progressPercent: number } | null;
  pendingNavigationUrl: string | null;
  setSelectedIds: (ids: string[]) => void;
  setMoveTarget: (t: MoveTargetState | null) => void;
  setMoveDestinationFolderId: (id: string | null) => void;
  setIsBatchCaptionOpen: (open: boolean) => void;
  setShowBatchDeleteConfirm: (show: boolean) => void;
  setIsNewFolderOpen: (open: boolean) => void;
  setIsImportModalOpen: (open: boolean) => void;
  setStagedFilesForImport: (files: File[]) => void;
  setActiveUploadsCount: (count: number) => void;
  setFurthestAlongUpload: (f: { name: string; progressPercent: number } | null) => void;
  setIsLeaveGuardOpen: (open: boolean) => void;
  setPendingNavigationUrl: (url: string | null) => void;
  setPreviewItem: (item: MediaItemResponse | null) => void;
  setRenameFolderTarget: (f: MediaFolder | null) => void;
  setRenameDraft: (draft: string) => void;
  setDeleteFolderTarget: (f: MediaFolder | null) => void;
  handleBatchCaptionApply: (text: string, mode: import('./media-types').BatchCaptionMode) => Promise<void>;
  handleCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  handleDeleteItem: (mediaId: string) => Promise<void>;
  handleReparent: (
    targetFolderId: string | null,
    payload: { mediaId?: string; folderId?: string }
  ) => Promise<void>;
  handleRenameFolder: (folderId: string, newName: string) => Promise<void>;
  handleDeleteFolder: (folderId: string) => Promise<void>;
  handleBatchDelete: () => Promise<void>;
  handleBatchMoveSubmit: (destinationId: string | null) => Promise<void>;
  onUploadSuccess: (item: MediaItemResponse) => void;
  refreshLibraryData: () => Promise<void>;
  showToast: (msg: string) => void;
}

export function MediaLibraryOverlays({
  subdomain,
  selectedIds,
  folders,
  currentFolderId,
  isBatchDeleting,
  isBatchCaptioning,
  isMoving,
  isRenamingFolder,
  isDeletingFolder,
  isNewFolderOpen,
  isImportModalOpen,
  isBatchCaptionOpen,
  isLeaveGuardOpen,
  showBatchDeleteConfirm,
  stagedFilesForImport,
  previewItem,
  moveTarget,
  moveDestinationFolderId,
  renameFolderTarget,
  renameDraft,
  deleteFolderTarget,
  activeUploadsCount,
  furthestAlongUpload,
  pendingNavigationUrl,
  setSelectedIds,
  setMoveTarget,
  setMoveDestinationFolderId,
  setIsBatchCaptionOpen,
  setShowBatchDeleteConfirm,
  setIsNewFolderOpen,
  setIsImportModalOpen,
  setStagedFilesForImport,
  setActiveUploadsCount,
  setFurthestAlongUpload,
  setIsLeaveGuardOpen,
  setPendingNavigationUrl,
  setPreviewItem,
  setRenameFolderTarget,
  setRenameDraft,
  setDeleteFolderTarget,
  handleBatchCaptionApply,
  handleCreateFolder,
  handleDeleteItem,
  handleReparent,
  handleRenameFolder,
  handleDeleteFolder,
  handleBatchDelete,
  handleBatchMoveSubmit,
  onUploadSuccess,
  refreshLibraryData,
  showToast,
}: Readonly<MediaLibraryOverlaysProps>) {
  const isBusy = isBatchDeleting || isBatchCaptioning || isMoving;

  return (
    <>
      {/* 6. Floating Batch Action Pill (Bottom Center) */}
      <BatchActionBar
        selectedIds={selectedIds}
        isBusy={isBusy}
        onClearSelection={() => {
          if (isBusy) return;
          setSelectedIds([]);
        }}
        onBatchMove={() => {
          if (isBusy) return;
          setMoveTarget({ type: 'batch_media' });
          setMoveDestinationFolderId(currentFolderId);
        }}
        onBatchCaption={() => {
          if (isBusy) return;
          setIsBatchCaptionOpen(true);
        }}
        onBatchDelete={() => {
          if (isBusy) return;
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
        onUploadSuccess={onUploadSuccess}
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
    </>
  );
}
