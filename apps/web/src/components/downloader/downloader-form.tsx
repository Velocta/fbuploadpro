'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DownloadIcon, PlusIcon } from 'lucide-react';
import type { MediaFolder } from '@fbuploadpro/contracts';
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormErrorSummary,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  type FormErrorSummaryEntry,
} from '@/components/shared/ui';
import { validateDownloaderBatchInput } from './media-downloader-helpers';

/**
 * Batch download form (spec 140 PR-140-2, T11/T14) — rebuilt on the
 * spec-137 form standard (react-hook-form + zod resolver +
 * FormErrorSummary) and shared/ui primitives.
 *
 * Validation parity (§3 item 2): an invalid batch produces the inline
 * error (`role="alert"`, byte-identical copy from
 * `validateDownloaderBatchInput`), nothing is submitted, and typing
 * clears the error. That last behaviour is why re-validation is bound
 * to submit (`reValidateMode: 'onSubmit'`) with an explicit
 * `clearErrors` on change — the standard's change-revalidation would
 * re-raise the error mid-typing for still-invalid input.
 */

/** Radix Select cannot hold an empty-string value; root is a sentinel. */
export const DOWNLOADER_ROOT_FOLDER_VALUE = '__root__';

export function folderIdToSelectValue(folderId: string | null): string {
  return folderId ?? DOWNLOADER_ROOT_FOLDER_VALUE;
}

export function selectValueToFolderId(value: string): string | null {
  return value === DOWNLOADER_ROOT_FOLDER_VALUE ? null : value;
}

const batchFormSchema = z.object({
  links: z.string().superRefine((value, ctx) => {
    const validation = validateDownloaderBatchInput(value);
    if (!validation.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          validation.errorMessage ??
          'Please paste at least one link to save to your Media Library.',
      });
    }
  }),
  folderId: z.string(),
});

type BatchFormValues = z.infer<typeof batchFormSchema>;

export interface DownloaderFormProps {
  sortedFolderOptions: Array<{ folder: MediaFolder; pathLabel: string }>;
  selectedFolderId: string | null;
  onSelectedFolderIdChange: (folderId: string | null) => void;
  isDownloading: boolean;
  duplicateCount: number;
  /**
   * Runs the batch for the validated input. Resolves `true` when the
   * batch finished with zero failures — the textarea then clears
   * (§3 item 11); with any failure the input stays.
   */
  onSubmitBatch: (rawInput: string, duplicateCount: number) => Promise<boolean>;
  onOpenNewFolderDialog: () => void;
}

export function DownloaderForm({
  sortedFolderOptions,
  selectedFolderId,
  onSelectedFolderIdChange,
  isDownloading,
  duplicateCount,
  onSubmitBatch,
  onOpenNewFolderDialog,
}: Readonly<DownloaderFormProps>) {
  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onSubmit',
    shouldFocusError: false,
    defaultValues: {
      links: '',
      folderId: folderIdToSelectValue(selectedFolderId),
    },
  });
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const isSubmitting = form.formState.isSubmitting;

  // The selected folder also changes outside the form (auto-provisioned
  // Downloads folder on first load, a folder created in the dialog) —
  // keep the select in sync with the surface's value.
  React.useEffect(() => {
    form.setValue('folderId', folderIdToSelectValue(selectedFolderId));
  }, [form, selectedFolderId]);

  const handleValidSubmit = async (values: BatchFormValues) => {
    const validation = validateDownloaderBatchInput(values.links);
    const clearInput = await onSubmitBatch(values.links, validation.duplicateCount);
    if (clearInput) {
      form.reset({ links: '', folderId: values.folderId });
      setSubmitAttempted(false);
    }
  };

  const linksErrorMessage = form.formState.errors.links?.message
    ? String(form.formState.errors.links.message)
    : null;
  const summaryErrors: FormErrorSummaryEntry[] =
    submitAttempted && linksErrorMessage
      ? [{ fieldId: 'downloader-url-input', message: linksErrorMessage }]
      : [];

  return (
    <Form {...form}>
      <form
        noValidate
        className="flex flex-col gap-6 px-6"
        onSubmit={form.handleSubmit(handleValidSubmit, () =>
          setSubmitAttempted(true)
        )}
      >
        {summaryErrors.length > 0 ? (
          <FormErrorSummary errors={summaryErrors} />
        ) : null}

        {/* Destination Folder Selector Row */}
        <FormField
          control={form.control}
          name="folderId"
          render={({ field }) => (
            <FormItem id="downloader-folder-select">
              <FormLabel>Destination folder</FormLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    onSelectedFolderIdChange(selectValueToFolderId(value));
                  }}
                  disabled={isDownloading}
                >
                  <FormControl>
                    <SelectTrigger
                      data-testid="downloader-folder-select"
                      className="min-w-55 flex-1"
                    >
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={DOWNLOADER_ROOT_FOLDER_VALUE}>
                      All Media (Root)
                    </SelectItem>
                    {sortedFolderOptions.map(({ folder, pathLabel }) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {pathLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  data-testid="downloader-new-folder-button"
                  onClick={onOpenNewFolderDialog}
                  disabled={isDownloading}
                >
                  <PlusIcon aria-hidden />
                  New Folder
                </Button>
              </div>
            </FormItem>
          )}
        />

        {/* Single & Multi-Line URL Input */}
        <FormField
          control={form.control}
          name="links"
          render={({ field }) => (
            <FormItem id="downloader-url-input">
              <FormLabel>Media links</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  data-testid="downloader-url-input"
                  disabled={isDownloading}
                  placeholder={
                    'https://www.tiktok.com/@creator/video/1234567890\nhttps://www.instagram.com/reel/ABC123xyz/\nhttps://drive.google.com/file/d/1A2B3C/view'
                  }
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    // §3 item 2: typing clears the error.
                    if (form.formState.errors.links) {
                      form.clearErrors('links');
                    }
                  }}
                />
              </FormControl>
              <FormDescription>
                Paste one link or multiple links (one per line). Original post
                captions are automatically saved with each video or image.
              </FormDescription>
              <FormMessage data-testid="downloader-url-error" />
            </FormItem>
          )}
        />

        {/* Submit Row & Deduplication Notice */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {duplicateCount > 0 && (
              <span
                data-testid="downloader-dedup-notice"
                className="text-metadata tabular-nums text-ink-sub"
              >
                Skipped {duplicateCount} duplicate{' '}
                {duplicateCount === 1 ? 'link' : 'links'} in batch
              </span>
            )}
          </div>

          <Button
            type="submit"
            data-testid="downloader-submit-button"
            disabled={isDownloading}
            loading={isSubmitting}
          >
            {isSubmitting ? null : <DownloadIcon aria-hidden />}
            {isDownloading ? 'Saving to Media Library...' : 'Save to Media Library'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
