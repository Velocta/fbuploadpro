'use client';

/**
 * Batch "Set caption" modal (spec 133 PR-133-3, spec §6.4 / PB-5).
 *
 * Rebuilt on the shared/ui Dialog + the spec 137 form standard
 * (react-hook-form + zod). Behaviour preserved exactly: title
 * "Set caption", subtext "Applies to n files", two modes — Replace
 * existing captions / Add to the end of existing captions (append
 * lands after a line break, applied by the data layer) — one
 * textarea with a character counter, empty text disables
 * "Apply to n files" with the reason present, Cancel changes
 * nothing, and success presents "Caption updated on n files"
 * through the shared Toast system (the explorer's handler).
 *
 * The form state lives outside the Dialog content so a cancelled
 * draft survives a close/reopen exactly as the legacy modal's did;
 * a successful apply clears the text.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from '@/components/shared/ui/form';
import { Textarea } from '@/components/shared/ui/textarea';
import type { BatchCaptionMode } from './media-types';

const batchCaptionSchema = z.object({
  mode: z.enum(['replace', 'append']),
  captionText: z.string(),
});

type BatchCaptionValues = z.infer<typeof batchCaptionSchema>;

const CAPTION_LIMIT = 2200;

export interface BatchSetCaptionModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onApply: (captionText: string, mode: BatchCaptionMode) => Promise<void>;
}

export function BatchSetCaptionModal({
  isOpen,
  selectedCount,
  onClose,
  onApply,
}: Readonly<BatchSetCaptionModalProps>) {
  const form = useForm<BatchCaptionValues>({
    resolver: zodResolver(batchCaptionSchema),
    mode: 'onTouched',
    defaultValues: { mode: 'replace', captionText: '' },
  });

  const captionText = form.watch('captionText') ?? '';
  const isSubmitting = form.formState.isSubmitting;
  const trimmedText = captionText.trim();
  const canSubmit = trimmedText.length > 0 && !isSubmitting;
  const targetLabel = selectedCount === 1 ? '1 file' : `${selectedCount} files`;

  const handleValid = async (values: BatchCaptionValues) => {
    await onApply(values.captionText.trim(), values.mode);
    form.reset({ mode: values.mode, captionText: '' });
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) onClose();
      }}
    >
      <DialogContent data-testid="batch-set-caption-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set caption</DialogTitle>
          <DialogDescription>
            Applies to {selectedCount} file{selectedCount === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(handleValid)}
          >
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-col" role="radiogroup" aria-label="Caption mode">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink">
                      <input
                        type="radio"
                        name={field.name}
                        value="replace"
                        checked={field.value === 'replace'}
                        disabled={isSubmitting}
                        onChange={() => field.onChange('replace')}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span>Replace existing captions</span>
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink">
                      <input
                        type="radio"
                        name={field.name}
                        value="append"
                        checked={field.value === 'append'}
                        disabled={isSubmitting}
                        onChange={() => field.onChange('append')}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span>Add to the end of existing captions</span>
                    </label>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="captionText"
              render={({ field }) => (
                <FormItem id="batch-caption-textarea-item">
                  <FormLabel className="sr-only">Caption</FormLabel>
                  <FormControl>
                    <Textarea
                      data-testid="batch-caption-textarea"
                      rows={4}
                      placeholder="Enter caption text..."
                      disabled={isSubmitting}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <div className="flex justify-end text-metadata text-ink-dim tabular-nums">
                    {captionText.length} / {CAPTION_LIMIT.toLocaleString('en-US')}
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="apply-batch-caption"
                loading={isSubmitting}
                disabled={!canSubmit}
                disabledReason={
                  !isSubmitting && trimmedText.length === 0
                    ? 'Enter a caption first.'
                    : undefined
                }
              >
                {isSubmitting ? 'Applying...' : `Apply to ${targetLabel}`}
              </Button>
            </DialogFooter>
            {!isSubmitting && trimmedText.length === 0 ? (
              <p className="text-right text-metadata text-ink-dim">
                Enter a caption first.
              </p>
            ) : null}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
