'use client';

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

export interface QueueBulkDeleteDialogProps {
  count: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Bulk-delete confirmation on the shared AlertDialog (UI Rule 3):
 * verb-named confirm ("Delete posts"), focus starts on Cancel, no
 * outside-click/Esc dismissal. Loaded via next/dynamic by the panel
 * (closed by default).
 */
export function QueueBulkDeleteDialog({
  count,
  deleting,
  onCancel,
  onConfirm,
}: Readonly<QueueBulkDeleteDialogProps>) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} {count === 1 ? 'post' : 'posts'}?
          </AlertDialogTitle>
          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction disabled={deleting} onClick={onConfirm}>
            {deleting ? 'Deleting…' : 'Delete posts'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default QueueBulkDeleteDialog;
