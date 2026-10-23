'use client';

/**
 * Move target dialog (spec 133 PR-133-3, spec §6.4).
 *
 * Rebuilt on the shared/ui Dialog: focus trap, Esc/outside dismissal
 * (a plain Dialog — moving is reversible, so it is not an
 * AlertDialog), focus returns to the trigger on close. The folder
 * picker is the shared/ui Select; "Library" is the root destination.
 * Behaviour preserved from the legacy dialog: for a folder move the
 * folder itself is not offered as its own destination (the API also
 * enforces no cycles), and both actions lock out while a move runs.
 */

import * as React from 'react';
import type { MediaFolder } from '@fbuploadpro/contracts';

import { Button } from '@/components/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shared/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui/select';
import type { MoveTargetState } from './media-library-helpers';

const ROOT_VALUE = 'library';

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
  const destinations = folders.filter((f) =>
    moveTarget.type === 'folder' ? f.id !== moveTarget.folder?.id : true
  );

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !isMoving) onClose();
      }}
    >
      <DialogContent data-testid="move-target-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="move-destination-folder-select"
            className="text-metadata font-medium tracking-caption text-ink-dim uppercase"
          >
            Select destination
          </label>
          <Select
            value={destinationFolderId ?? ROOT_VALUE}
            disabled={isMoving}
            onValueChange={(value) =>
              onDestinationChange(value === ROOT_VALUE ? null : value)
            }
          >
            <SelectTrigger
              id="move-destination-folder-select"
              data-testid="move-destination-select"
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT_VALUE}>Library</SelectItem>
              {destinations.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={isMoving} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={isMoving} onClick={onConfirm}>
            {isMoving ? 'Moving...' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
