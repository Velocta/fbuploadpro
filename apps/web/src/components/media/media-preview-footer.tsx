'use client';

/**
 * Preview dialog footer (spec 133 §6.6 / PR-133-5, PB-8).
 *
 * The arrangement is round-2 behaviour, preserved exactly: Delete as
 * a danger text action on the left; Cancel + "Save changes" (the
 * dialog's single primary) on the right. A save failure presents
 * inline above the actions — at the scope of the operation, never a
 * bare return or a generic toast (spec §7.2). Every action locks out
 * while a save or delete is in flight, so no duplicate action can
 * start (spec 071 lockouts).
 */

import * as React from 'react';

import { Button } from '@/components/shared/ui/button';
import { cn } from '@/lib/utils';

export interface MediaPreviewFooterProps {
  hasDelete: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  saveError: string | null;
  onDelete?: (() => void) | undefined;
  onCancel: () => void;
  onSave: () => void;
}

export function MediaPreviewFooter({
  hasDelete,
  isSaving,
  isDeleting,
  saveError,
  onDelete,
  onCancel,
  onSave,
}: Readonly<MediaPreviewFooterProps>) {
  const isBusy = isSaving || isDeleting;

  return (
    <div className="border-t border-line px-4 py-3 sm:px-6">
      {saveError ? (
        <p role="alert" className="m-0 pb-2 text-right text-metadata font-medium text-brand-rose">
          {saveError}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        {hasDelete ? (
          <Button
            variant="ghost"
            data-testid="modal-delete-media-btn"
            disabled={isBusy}
            onClick={onDelete}
            className={cn('text-brand-rose hover:bg-brand-rose/10 hover:text-brand-rose')}
          >
            {isDeleting ? 'Deleting...' : 'Delete asset'}
          </Button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={isBusy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            data-testid="modal-save-caption-btn"
            disabled={isBusy}
            loading={isSaving}
            onClick={onSave}
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
