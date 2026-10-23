'use client';

/**
 * Batch delete confirmation (spec 133 PR-133-3, spec §6.4).
 *
 * The destructive pattern (OD-133-3 = (a)): shared/ui AlertDialog —
 * no outside-click/Esc dismissal, focus starts on the safe exit
 * ("Keep"), and the confirm names the verb and the count
 * ("Delete n files"). Media deletion is irreversible, so this
 * stays a confirmation, never an Undo toast (spec §11 OD-133-3).
 */

import * as React from 'react';

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
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent
        data-testid="batch-delete-confirm-dialog"
        className="sm:max-w-md"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} file{count === 1 ? '' : 's'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="batch-delete-keep-btn" disabled={isDeleting}>
            Keep
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="batch-delete-confirm-btn"
            disabled={isDeleting}
            onClick={(event) => {
              // Keep the dialog open until the delete settles: the
              // caller closes it on success; on failure it stays
              // open with the failure toasted by the explorer.
              event.preventDefault();
              onConfirm();
            }}
          >
            {isDeleting ? 'Deleting...' : `Delete ${count} files`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
