'use client';

/**
 * CreateWorkspaceModal — rebuilt on the shared/ui Dialog primitive +
 * the spec 137 §3.8 form standard (spec 130 §5.4, PR-130-2b).
 *
 * The legacy hand-rolled modal (the audit's one semantically-correct
 * modal) is replaced by the Dialog primitive: focus trap, Esc, and
 * focus return come from the primitive; Esc stays blocked while a
 * submission is in flight, as before. The form is react-hook-form +
 * zod with `onTouched` validation and the §4.2 messages verbatim;
 * submission goes through the typed client as a mutation
 * (`POST /api/workspaces`, `WorkspaceMutationResponseSchema`); the
 * submit button carries the Button primitive's loading state while
 * pending; the input is never cleared on failure.
 *
 * Error presentation (§3.8 wired pattern — the shape change from the
 * legacy single error box is spec §9 item 2, named): field problems
 * present inline + in the FormErrorSummary; server/network failures
 * present as a dialog-level Alert. Wording is §4.2 verbatim: a
 * server-provided `error` string takes precedence, then the listed
 * fallbacks. The modal's `COMPONENT_STYLES` / `modal-styles.ts`
 * imports are deleted (the modal-styles file itself survives — 8
 * other consumers, spec §3.1).
 *
 * Success (§4.1 preserved): the modal closes and hands the created
 * workspace to `onSuccess`; the switcher then switches into it by
 * full-page navigation. The legacy modal's own extra self-navigation
 * is not carried over — the switch flow is the single navigation,
 * ending in the new workspace's home either way.
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

import { api, getErrorMessage, isApiError } from '@/lib/api';
import { WorkspaceMutationResponseSchema } from '@/lib/api/schemas/workspaces';
import { Alert, AlertDescription } from '@/components/shared/ui/alert';
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
  FormErrorSummary,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type FormErrorSummaryEntry,
} from '@/components/shared/ui/form';
import { Input } from '@/components/shared/ui/input';

export const createWorkspaceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please provide a workspace name.')
    .min(2, 'Workspace name must be at least 2 characters long.'),
});

export type CreateWorkspaceFormValues = z.infer<typeof createWorkspaceFormSchema>;

const NAME_FIELD_ID = 'ws-name-input';

export interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: ((workspace: { id: string; name: string; subdomain: string }) => void) | undefined;
}

/** Map a failed create onto the §4.2 verbatim fallbacks: a server
 *  `error` string first (HTTP failures), then the invalid-response
 *  fallback for parse failures, then the network fallback. */
function createFailureMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.kind === 'http') {
      return getErrorMessage(error, 'Server error while creating workspace. Please try again.');
    }
    if (error.kind === 'parse') {
      return 'Server returned an invalid workspace response.';
    }
    if (error.kind === 'session-expired') {
      return 'Server error while creating workspace. Please try again.';
    }
  }
  return 'Network communication failed. Please try again.';
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onSuccess,
}: Readonly<CreateWorkspaceModalProps>) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const form = useForm<CreateWorkspaceFormValues>({
    resolver: zodResolver(createWorkspaceFormSchema),
    mode: 'onTouched',
    shouldFocusError: false,
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ name: '' });
      setServerError(null);
      setSubmitAttempted(false);
    }
  }, [isOpen, form]);

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.post('/api/workspaces', { name }, { schema: WorkspaceMutationResponseSchema }),
    onSuccess: (data) => {
      onSuccess?.(data.workspace);
      onClose();
    },
    onError: (error) => {
      setServerError(createFailureMessage(error));
    },
  });

  const isSubmitting = createMutation.isPending;

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      onClose();
    }
  };

  const onSubmit = (values: CreateWorkspaceFormValues) => {
    setSubmitAttempted(true);
    setServerError(null);
    createMutation.mutate(values.name.trim());
  };

  const nameError = form.formState.errors.name?.message;
  const summaryEntries: FormErrorSummaryEntry[] = [
    ...(submitAttempted && nameError ? [{ fieldId: NAME_FIELD_ID, message: nameError }] : []),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-labelledby="create-workspace-title"
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        className="max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle id="create-workspace-title">Create Workspace</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close dialog"
              className="size-11"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </div>
          <DialogDescription>
            Workspaces keep your social accounts, scheduled posts, and media organized in one
            dedicated space.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            {summaryEntries.length > 0 && <FormErrorSummary errors={summaryEntries} />}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={NAME_FIELD_ID}>Workspace Name</FormLabel>
                  <FormControl>
                    <Input
                      id={NAME_FIELD_ID}
                      type="text"
                      placeholder="e.g. Acme Media or Brand Name"
                      disabled={isSubmitting}
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <p className="text-metadata text-ink-dim">
                    Give your workspace a recognizable name, such as your brand, company, or
                    client project.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="create-workspace-submit"
                loading={isSubmitting}
                disabled={isSubmitting || !form.watch('name').trim()}
              >
                {isSubmitting ? 'Creating...' : 'Create Workspace'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
