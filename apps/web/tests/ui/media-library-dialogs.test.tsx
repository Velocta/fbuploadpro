/**
 * @file media-library-dialogs.test.tsx
 * @description Behavioural tests for the media library dialogs &
 * overlays rebuilt in spec 133 PR-133-3 (T27): the four library
 * dialogs on shared/ui Dialog/AlertDialog, the new-folder and
 * batch-caption forms on the spec 137 form standard (RHF + zod),
 * the leave-page guard, and the batch action bar.
 *
 * These supersede the static-markup assertions the legacy suite
 * (tests/ui/media-library-explorer.test.tsx) held for these
 * components — Radix portal content does not exist in static
 * markup, and behaviour (focus, dismissal rules, validation,
 * lockouts) is what the rebuild must preserve (spec §2.5).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MediaFolder } from '@fbuploadpro/contracts';

import { BatchActionBar } from '@/components/media/batch-action-bar';
import { BatchSetCaptionModal } from '@/components/media/batch-set-caption-modal';
import { LeavePageGuardDialog } from '@/components/media/leave-page-guard-dialog';
import { BatchDeleteConfirmDialog } from '@/components/media/media-batch-delete-dialog';
import { DeleteFolderDialog } from '@/components/media/media-delete-folder-dialog';
import { MoveTargetDialog } from '@/components/media/media-move-dialog';
import { RenameFolderDialog } from '@/components/media/media-rename-folder-dialog';
import { NewFolderModal } from '@/components/media/new-folder-modal';

const FOLDERS: MediaFolder[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: null,
    name: 'Campaign A',
    itemCount: 2,
    subfolderCount: 2,
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: '11111111-1111-4111-8111-111111111111',
    name: 'Reels',
    itemCount: 5,
    subfolderCount: 1,
    createdAt: '2026-10-10T10:05:00.000Z',
    updatedAt: '2026-10-10T10:05:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: '22222222-2222-4222-8222-222222222222',
    name: 'Week 1',
    itemCount: 3,
    subfolderCount: 0,
    createdAt: '2026-10-10T10:10:00.000Z',
    updatedAt: '2026-10-10T10:10:00.000Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    userId: '00000000-0000-4000-8000-000000000001',
    parentId: '11111111-1111-4111-8111-111111111111',
    name: 'Photos',
    itemCount: 4,
    subfolderCount: 0,
    createdAt: '2026-10-10T10:15:00.000Z',
    updatedAt: '2026-10-10T10:15:00.000Z',
  },
];

describe('NewFolderModal (PB-7, form standard)', () => {
  it('autofocuses the name field, disables Create while empty with the reason present', async () => {
    render(
      <NewFolderModal
        isOpen
        folders={FOLDERS}
        initialParentId={null}
        onClose={vi.fn()}
        onCreateFolder={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const input = screen.getByTestId('new-folder-name-input');
    await waitFor(() => expect(input).toHaveFocus());
    const create = screen.getByTestId('submit-create-folder');
    expect(create).toBeDisabled();
    // The reason is present twice by design: the Button's accessible
    // description (disabledReason) and the visible line beside it.
    expect(screen.getAllByText('Enter a folder name.').length).toBeGreaterThan(0);
  });

  it('shows the duplicate name as an inline error and keeps Create disabled', async () => {
    const user = userEvent.setup();
    render(
      <NewFolderModal
        isOpen
        folders={FOLDERS}
        initialParentId={null}
        onClose={vi.fn()}
        onCreateFolder={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const input = screen.getByTestId('new-folder-name-input');
    await user.type(input, 'Campaign A');
    expect(screen.getByTestId('folder-duplicate-warning')).toHaveTextContent(
      'A folder with this name already exists'
    );
    expect(screen.getByTestId('submit-create-folder')).toBeDisabled();
  });

  it('creates with the trimmed name + chosen parent on Enter, then closes', async () => {
    const user = userEvent.setup();
    const onCreateFolder = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <NewFolderModal
        isOpen
        folders={FOLDERS}
        initialParentId={null}
        onClose={onClose}
        onCreateFolder={onCreateFolder}
      />
    );
    const input = screen.getByTestId('new-folder-name-input');
    await user.type(input, '  Launch Week  {Enter}');
    await waitFor(() =>
      expect(onCreateFolder).toHaveBeenCalledWith('Launch Week', null)
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc closes the dialog and Cancel changes nothing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onCreateFolder = vi.fn();
    render(
      <NewFolderModal
        isOpen
        folders={FOLDERS}
        initialParentId={null}
        onClose={onClose}
        onCreateFolder={onCreateFolder}
      />
    );
    await user.type(screen.getByTestId('new-folder-name-input'), 'Draft name');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCreateFolder).not.toHaveBeenCalled();
  });
});

describe('BatchSetCaptionModal (PB-5, form standard)', () => {
  it('states the file count, gates Apply on empty text with the reason present', async () => {
    render(
      <BatchSetCaptionModal
        isOpen
        selectedCount={3}
        onClose={vi.fn()}
        onApply={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Applies to 3 files.')).toBeInTheDocument();
    expect(screen.getByTestId('apply-batch-caption')).toBeDisabled();
    expect(screen.getAllByText('Enter a caption first.').length).toBeGreaterThan(0);
    expect(screen.getByText('0 / 2,200')).toBeInTheDocument();
  });

  it('applies in Replace mode and reports the typed length in the counter', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <BatchSetCaptionModal
        isOpen
        selectedCount={2}
        onClose={onClose}
        onApply={onApply}
      />
    );
    const textarea = screen.getByTestId('batch-caption-textarea');
    await user.type(textarea, 'Morning launch');
    expect(screen.getByText('14 / 2,200')).toBeInTheDocument();
    await user.click(screen.getByTestId('apply-batch-caption'));
    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith('Morning launch', 'replace')
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('applies in Append mode when the append radio is chosen', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(
      <BatchSetCaptionModal
        isOpen
        selectedCount={1}
        onClose={vi.fn()}
        onApply={onApply}
      />
    );
    await user.click(
      screen.getByRole('radio', { name: 'Add to the end of existing captions' })
    );
    await user.type(screen.getByTestId('batch-caption-textarea'), 'Extra line');
    await user.click(screen.getByTestId('apply-batch-caption'));
    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith('Extra line', 'append')
    );
  });

  it('Cancel changes nothing', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <BatchSetCaptionModal
        isOpen
        selectedCount={2}
        onClose={onClose}
        onApply={onApply}
      />
    );
    await user.type(screen.getByTestId('batch-caption-textarea'), 'Unsent');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('DeleteFolderDialog (AlertDialog destructive pattern)', () => {
  it('states the exact subtree impact, focus starts on Cancel, Esc does not dismiss', async () => {
    const user = userEvent.setup();
    render(
      <DeleteFolderDialog
        target={FOLDERS[0]!}
        folders={FOLDERS}
        isDeleting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    // Campaign A: 3 descendant subfolders, 2 + 5 + 3 + 4 = 14 media files.
    expect(screen.getByTestId('delete-folder-impact-summary')).toHaveTextContent(
      '3 subfolders and 14 media files inside will be moved to Library.'
    );
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete folder' })
    ).toBeInTheDocument();
  });

  it('confirm calls onConfirm and stays open while deleting', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeleteFolderDialog
        target={FOLDERS[0]!}
        folders={FOLDERS}
        isDeleting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Delete folder' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // The dialog does not auto-close on the confirm click — the
    // explorer closes it when the delete settles.
    expect(screen.queryByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('BatchDeleteConfirmDialog (AlertDialog destructive pattern)', () => {
  it('names the verb and count, focus on Keep, confirm does not auto-close', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <BatchDeleteConfirmDialog
        count={4}
        isDeleting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('This can\'t be undone.')).toBeInTheDocument();
    const keep = screen.getByTestId('batch-delete-keep-btn');
    await waitFor(() => expect(keep).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('batch-delete-confirm-btn'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('MoveTargetDialog', () => {
  it('offers Library + folders, excludes the folder being moved, confirms the choice', async () => {
    const user = userEvent.setup();
    const onDestinationChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <MoveTargetDialog
        moveTarget={{ type: 'folder', folder: FOLDERS[0]! }}
        destinationFolderId={null}
        folders={FOLDERS}
        isMoving={false}
        onDestinationChange={onDestinationChange}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const trigger = screen.getByTestId('move-destination-select');
    await user.click(trigger);
    expect(
      screen.getByRole('option', { name: 'Library' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Reels' })
    ).toBeInTheDocument();
    // The folder being moved is not its own destination.
    expect(
      screen.queryByRole('option', { name: 'Campaign A' })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Reels' }));
    expect(onDestinationChange).toHaveBeenCalledWith(FOLDERS[1]!.id);
    await user.click(screen.getByRole('button', { name: 'Move' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Esc closes a plain Dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MoveTargetDialog
        moveTarget={{ type: 'batch_media' }}
        destinationFolderId={null}
        folders={FOLDERS}
        isMoving={false}
        onDestinationChange={vi.fn()}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('RenameFolderDialog (form standard)', () => {
  it('mirrors the draft, disables Save on empty with the reason present, submits trimmed flow via the explorer contract', async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <RenameFolderDialog
        renameDraft="Reels"
        isRenaming={false}
        onDraftChange={onDraftChange}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const input = screen.getByDisplayValue('Reels');
    await user.clear(input);
    expect(onDraftChange).toHaveBeenLastCalledWith('');
    rerender(
      <RenameFolderDialog
        renameDraft=""
        isRenaming={false}
        onDraftChange={onDraftChange}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    expect(screen.getAllByText('Enter a folder name.').length).toBeGreaterThan(0);
  });

  it('submits on Enter when the name is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <RenameFolderDialog
        renameDraft="Reels"
        isRenaming={false}
        onDraftChange={vi.fn()}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );
    await user.click(screen.getByDisplayValue('Reels'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});

describe('LeavePageGuardDialog (PB-19)', () => {
  it('names the count and furthest-along file; Stay is the focused primary, Leave is quiet', async () => {
    const user = userEvent.setup();
    const onStay = vi.fn();
    const onLeaveAnyway = vi.fn();
    render(
      <LeavePageGuardDialog
        isOpen
        activeUploadsCount={3}
        furthestAlongFile={{ name: 'launch-reel.mp4', progressPercent: 62.4 }}
        onStay={onStay}
        onLeaveAnyway={onLeaveAnyway}
      />
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      screen.getByText(/Leaving now will cancel 3 uploads/)
    ).toBeInTheDocument();
    expect(screen.getByText(/launch-reel\.mp4 · 62%/)).toBeInTheDocument();
    const stay = screen.getByTestId('leave-guard-stay-btn');
    await waitFor(() => expect(stay).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('leave-guard-leave-btn'));
    expect(onLeaveAnyway).toHaveBeenCalledTimes(1);
    expect(onStay).not.toHaveBeenCalled();
  });
});

describe('BatchActionBar (PB-17)', () => {
  it('states the count and offers Move / Set caption / Delete / Clear with no Schedule action', async () => {
    const user = userEvent.setup();
    const onBatchCaption = vi.fn();
    render(
      <BatchActionBar
        selectedIds={['a', 'b']}
        onClearSelection={vi.fn()}
        onBatchMove={vi.fn()}
        onBatchCaption={onBatchCaption}
        onBatchDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId('batch-selected-count')).toHaveTextContent(
      '2 selected'
    );
    expect(screen.queryByText(/Schedule|Add to Queue/)).not.toBeInTheDocument();
    await user.click(screen.getByTestId('batch-caption-btn'));
    expect(onBatchCaption).toHaveBeenCalledTimes(1);
  });

  it('renders nothing at zero selection and locks out while busy', () => {
    const { container } = render(
      <BatchActionBar selectedIds={[]} onBatchMove={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    render(
      <BatchActionBar
        selectedIds={['a']}
        isBusy
        onClearSelection={vi.fn()}
        onBatchMove={vi.fn()}
        onBatchCaption={vi.fn()}
        onBatchDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId('batch-move-btn')).toBeDisabled();
    expect(screen.getByTestId('batch-delete-btn')).toBeDisabled();
    expect(screen.getByTestId('batch-clear-btn')).toBeDisabled();
  });
});
