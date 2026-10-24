'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { PromptCategory, PromptResponse } from '@fbuploadpro/contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormErrorSummary,
  FormField,
  FormItem,
  FormLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  type FormErrorSummaryEntry,
} from '@/components/shared/ui';
import {
  CreatePromptRequestSchema,
  PROMPT_CATEGORY_LABELS,
  PROMPT_CATEGORY_VALUES,
} from '@/lib/api/schemas/prompts';
import type { z } from 'zod';

type PromptFormValues = z.infer<typeof CreatePromptRequestSchema>;

interface PromptFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this prompt; otherwise it creates a new one. */
  editingPrompt?: PromptResponse | null;
  onSubmit: (values: PromptFormValues) => Promise<void>;
}

/**
 * Create/edit dialog for personal prompts (spec 144 §7, OD-144-5):
 * react-hook-form + zod, the app form standard. All three fields are
 * required in the form; the API's partial-update shape is for API
 * clients, not for this dialog.
 */
export function PromptFormDialog({
  open,
  onOpenChange,
  editingPrompt,
  onSubmit,
}: PromptFormDialogProps) {
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<PromptFormValues>({
    resolver: zodResolver(CreatePromptRequestSchema),
    mode: 'onTouched',
    reValidateMode: 'onSubmit',
    shouldFocusError: false,
    defaultValues: {
      title: editingPrompt?.title ?? '',
      body: editingPrompt?.body ?? '',
      category: (editingPrompt?.category as PromptCategory) ?? 'hooks',
    },
  });

  // Reset when the dialog opens for a different prompt (or for create).
  useEffect(() => {
    if (open) {
      form.reset({
        title: editingPrompt?.title ?? '',
        body: editingPrompt?.body ?? '',
        category: (editingPrompt?.category as PromptCategory) ?? 'hooks',
      });
      setSubmitAttempted(false);
      setServerError(null);
    }
  }, [open, editingPrompt?.id, form]);

  const isSaving = form.formState.isSubmitting;
  const isEditing = editingPrompt != null;

  async function handleValidSubmit(values: PromptFormValues) {
    setServerError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not save this prompt.');
    }
  }

  function handleInvalidSubmit() {
    setSubmitAttempted(true);
    setServerError(null);
  }

  const fieldErrors: FormErrorSummaryEntry[] = [];
  for (const key of ['title', 'body', 'category'] as const) {
    const message = form.formState.errors[key]?.message;
    if (message) {
      fieldErrors.push({ fieldId: `prompt-form-${key}`, message: String(message) });
    }
  }
  const summaryErrors =
    submitAttempted || serverError
      ? [...fieldErrors, ...(serverError ? [{ message: serverError }] : [])]
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="prompt-form-dialog">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit prompt' : 'New prompt'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your prompt. It stays private to you.'
              : 'Save a prompt you can reuse any time. It stays private to you.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit(handleValidSubmit, handleInvalidSubmit)}
          >
            {summaryErrors.length > 0 ? <FormErrorSummary errors={summaryErrors} /> : null}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem id="prompt-form-title">
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      data-testid="prompt-form-title"
                      placeholder="e.g. Hooks for a product launch"
                      maxLength={100}
                      disabled={isSaving}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem id="prompt-form-category">
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSaving}
                    >
                      <SelectTrigger data-testid="prompt-form-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROMPT_CATEGORY_VALUES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {PROMPT_CATEGORY_LABELS[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem id="prompt-form-body">
                  <FormLabel>Prompt text</FormLabel>
                  <FormControl>
                    <Textarea
                      data-testid="prompt-form-body"
                      placeholder="Write the prompt exactly as you will paste it into ChatGPT or Gemini. Use [brackets] for parts you fill in each time."
                      maxLength={4000}
                      rows={8}
                      disabled={isSaving}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} data-testid="prompt-form-submit">
                {isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Save prompt'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
