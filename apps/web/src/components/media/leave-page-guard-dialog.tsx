'use client';

/**
 * Leave-page guard (spec 133 PR-133-3, spec §6.4 / PB-19).
 *
 * Rebuilt with AlertDialog semantics: while uploads are active the
 * user must make an explicit choice — the dialog cannot be
 * dismissed by outside click or Esc, and focus starts on the safe
 * choice. "Stay on this page" is the primary action (it is also
 * the AlertDialog Cancel control, so the primitive's
 * focus-on-Cancel lands on it); "Leave anyway" is the quiet
 * action. The copy names the upload count and the furthest-along
 * file, exactly as PB-19 requires. The browser's native
 * beforeunload warning is armed separately by the explorer's
 * navigation guard — only while uploads are active.
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

export interface LeavePageGuardDialogProps {
  isOpen: boolean;
  activeUploadsCount: number;
  furthestAlongFile: { name: string; progressPercent: number } | null;
  onStay: () => void;
  onLeaveAnyway: () => void;
}

export function LeavePageGuardDialog({
  isOpen,
  activeUploadsCount,
  furthestAlongFile,
  onStay,
  onLeaveAnyway,
}: Readonly<LeavePageGuardDialogProps>) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent data-testid="leave-page-guard-dialog" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Uploads still in progress</AlertDialogTitle>
          <AlertDialogDescription>
            Leaving now will cancel {activeUploadsCount} upload
            {activeUploadsCount === 1 ? '' : 's'} — they&apos;ll be lost and
            you&apos;ll need to start over.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {furthestAlongFile ? (
          <p className="truncate rounded-sm bg-subtle px-3 py-2 text-body text-ink-sub tabular-nums">
            {furthestAlongFile.name} · {Math.round(furthestAlongFile.progressPercent)}%
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogAction
            variant="ghost"
            data-testid="leave-guard-leave-btn"
            onClick={onLeaveAnyway}
          >
            Leave anyway
          </AlertDialogAction>
          <AlertDialogCancel
            variant="default"
            data-testid="leave-guard-stay-btn"
            onClick={onStay}
          >
            Stay on this page
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
