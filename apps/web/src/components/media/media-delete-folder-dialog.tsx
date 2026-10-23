'use client';

/**
 * Delete folder confirmation (spec 133 PR-133-3, spec §6.4).
 *
 * The destructive pattern (OD-133-3 = (a)): shared/ui AlertDialog —
 * it cannot be dismissed by outside click or Esc, focus starts on
 * Cancel, and the confirm names the verb ("Delete folder"). The
 * consequence is stated specifically: the folder's subtree impact
 * (subfolders + media files) is computed from the folder tree and
 * the copy states that the contents move to Library — folder
 * deletion itself is irreversible, its contents are not deleted.
 */

import * as React from 'react';
import type { MediaFolder } from '@fbuploadpro/contracts';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shared/ui/alert-dialog';
import { computeFolderSubtreeImpact } from './media-library-filters';

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
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent data-testid="delete-folder-modal" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete folder</AlertDialogTitle>
          <AlertDialogDescription data-testid="delete-folder-impact-summary">
            Are you sure you want to delete &ldquo;{target.name}&rdquo;? {impactText}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting}
            onClick={(event) => {
              // Keep the dialog open until the delete settles: the
              // explorer closes it on success; on failure it stays
              // open with the failure toasted by the explorer.
              event.preventDefault();
              onConfirm();
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete folder'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
