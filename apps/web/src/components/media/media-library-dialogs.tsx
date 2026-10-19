'use client';

import React, { useState } from 'react';
import type { MediaFolder, MediaItemResponse } from '@fbuploadpro/contracts';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { computeFolderSubtreeImpact } from './media-library-filters';

export interface MoveTargetState {
  type: 'single_media' | 'batch_media' | 'folder';
  mediaItem?: MediaItemResponse;
  folder?: MediaFolder;
}

export interface MoveTargetDialogProps {
  moveTarget: MoveTargetState;
  destinationFolderId: string | null;
  folders: MediaFolder[];
  isMoving: boolean;
  onDestinationChange: (folderId: string | null) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function MoveTargetDialog({
  moveTarget,
  destinationFolderId,
  folders,
  isMoving,
  onDestinationChange,
  onClose,
  onConfirm,
}: Readonly<MoveTargetDialogProps>) {
  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="move-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9500,
        padding: SPACING.md,
        border: 'none',
        margin: 0,
        boxSizing: 'border-box',
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
            htmlFor="move-destination-folder-select"
            style={{
              fontSize: '0.6875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            Select destination
          </label>
          <select
            id="move-destination-folder-select"
            disabled={isMoving}
            value={destinationFolderId || ''}
            onChange={(e) => onDestinationChange(e.target.value || null)}
            style={{
              width: '100%',
              padding: `${SPACING.xs} ${SPACING.sm}`,
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
              borderRadius: RADII.xs,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              fontSize: '0.8125rem',
              outline: 'none',
              cursor: isMoving ? 'not-allowed' : 'pointer',
              opacity: isMoving ? 0.6 : 1,
            }}
          >
            <option value="">Library</option>
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
            disabled={isMoving}
            onClick={onClose}
            style={{
              padding: `${SPACING.xs} ${SPACING.md}`,
              backgroundColor: 'transparent',
              border: 'none',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              cursor: isMoving ? 'not-allowed' : 'pointer',
              opacity: isMoving ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isMoving}
            onClick={onConfirm}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: isMoving ? 'rgba(250, 215, 52, 0.3)' : PALETTE.primary,
              color: PALETTE.background,
              border: 'none',
              borderRadius: RADII.xs,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isMoving ? 'not-allowed' : 'pointer',
              opacity: isMoving ? 0.6 : 1,
            }}
          >
            {isMoving ? 'Moving...' : 'Move'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export interface RenameFolderDialogProps {
  renameDraft: string;
  isRenaming: boolean;
  onDraftChange: (name: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function RenameFolderDialog({
  renameDraft,
  isRenaming,
  onDraftChange,
  onClose,
  onSubmit,
}: Readonly<RenameFolderDialogProps>) {
  const isValid = Boolean(renameDraft.trim());
  const canSave = isValid && !isRenaming;
  return (
    <dialog
      open
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9500,
        padding: SPACING.md,
        border: 'none',
        margin: 0,
        boxSizing: 'border-box',
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
          disabled={isRenaming}
          value={renameDraft}
          onChange={(e) => onDraftChange(e.target.value)}
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
            opacity: isRenaming ? 0.6 : 1,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
          <button
            type="button"
            disabled={isRenaming}
            onClick={onClose}
            style={{
              padding: `${SPACING.xs} ${SPACING.md}`,
              backgroundColor: 'transparent',
              border: 'none',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              cursor: isRenaming ? 'not-allowed' : 'pointer',
              opacity: isRenaming ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={onSubmit}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: canSave ? PALETTE.primary : 'rgba(250, 215, 52, 0.3)',
              color: PALETTE.background,
              border: 'none',
              borderRadius: RADII.xs,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: canSave ? 'pointer' : 'not-allowed',
              opacity: isRenaming ? 0.6 : 1,
            }}
          >
            {isRenaming ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export interface DeleteFolderDialogProps {
  target: MediaFolder;
  folders: MediaFolder[];
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteFolderDialog({
  target,
  folders,
  isDeleting,
  onClose,
  onConfirm,
}: Readonly<DeleteFolderDialogProps>) {
  const impact = computeFolderSubtreeImpact(target.id, folders);
  const impactText =
    impact.subfolderCount > 0 || impact.totalMediaCount > 0
      ? `${impact.subfolderCount} subfolders and ${impact.totalMediaCount} media files inside will be moved to Library.`
      : 'Items inside will be moved to Library.';

  return (
    <dialog
      open
      aria-modal="true"
      data-testid="delete-folder-modal"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9500,
        padding: SPACING.md,
        border: 'none',
        margin: 0,
        boxSizing: 'border-box',
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
        <p
          data-testid="delete-folder-impact-summary"
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.45,
          }}
        >
          Are you sure you want to delete &ldquo;{target.name}&rdquo;? {impactText}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            style={{
              padding: `${SPACING.xs} ${SPACING.md}`,
              backgroundColor: 'transparent',
              border: 'none',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              backgroundColor: PALETTE.accent3,
              color: PALETTE.text,
              border: 'none',
              borderRadius: RADII.xs,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export interface BatchDeleteConfirmDialogProps {
  count: number;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function BatchDeleteConfirmDialog({
  count,
  isDeleting,
  onClose,
  onConfirm,
}: Readonly<BatchDeleteConfirmDialogProps>) {
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent style={{ maxWidth: '440px' }} data-testid="batch-delete-confirm-dialog">
        <DialogHeader>
          <DialogTitle>Delete {count} assets?</DialogTitle>
          <DialogDescription>This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            data-testid="batch-delete-keep-btn"
            disabled={isDeleting}
            onClick={onClose}
            style={{
              height: '36px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: 'transparent',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            Keep
          </button>
          <button
            type="button"
            data-testid="batch-delete-confirm-btn"
            disabled={isDeleting}
            onClick={onConfirm}
            style={{
              height: '36px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: PALETTE.accent3,
              color: PALETTE.text,
              border: 'none',
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            {isDeleting ? 'Deleting...' : `Delete ${count} assets`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reads an internal media/folder drag payload from a drop event.
 * Returns the parsed payload, or null when the drop carries no internal
 * payload (or the payload is malformed — intentionally ignored, since
 * invalid JSON means the dropped data isn't ours).
 */