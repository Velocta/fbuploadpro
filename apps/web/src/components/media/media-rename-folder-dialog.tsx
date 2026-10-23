'use client';

/**
 * Rename folder dialog (spec 133 PR-133-3, spec §6.4).
 *
 * Rebuilt on the shared/ui Dialog + the spec 137 form standard
 * (react-hook-form + zod): validate on blur/submit, the input is
 * never cleared by a failed submit, and the submit locks out while
 * the rename runs. The draft stays owned by the explorer (its
 * `renameDraft` state is the value other flows read), so the form
 * mirrors every keystroke through `onDraftChange` and submits via
 * the explorer's `onSubmit` — the props contract is unchanged from
 * the legacy dialog. An empty name disables Save with the reason
 * present (UI Rule 16), never silently.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shared/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/shared/ui/form';
import { Input } from '@/components/shared/ui/input';

const renameFolderSchema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, 'Enter a folder name.'),
});

type RenameFolderValues = z.infer<typeof renameFolderSchema>;

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
  const form = useForm<RenameFolderValues>({
    resolver: zodResolver(renameFolderSchema),
    mode: 'onTouched',
    values: { name: renameDraft },
  });

  const nameValue = form.watch('name');
  const isEmpty = nameValue.trim().length === 0;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !isRenaming) onClose();
      }}
    >
      <DialogContent data-testid="rename-folder-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(() => onSubmit())}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem id="rename-folder-name-input">
                  <FormLabel>Folder name</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus
                      disabled={isRenaming}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(e) => {
                        field.onChange(e);
                        onDraftChange(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="ghost" disabled={isRenaming} onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isRenaming}
                {...(isEmpty ? { disabledReason: 'Enter a folder name.' } : {})}
              >
                {isRenaming ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
            {isEmpty ? (
              <p className="text-right text-metadata text-ink-dim">
                Enter a folder name.
              </p>
            ) : null}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
