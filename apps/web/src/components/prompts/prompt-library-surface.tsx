'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PromptCategory, PromptResponse } from '@fbuploadpro/contracts';
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/shared/ui';
import { api, buildTenantApiPath } from '@/lib/api';
import {
  DeletePromptResponseSchema,
  PROMPT_CATEGORY_LABELS,
  PROMPT_CATEGORY_VALUES,
  PromptListResponseSchema,
  PromptResponseSchema,
} from '@/lib/api/schemas/prompts';
import { queryKeys } from '@/lib/data/query-keys';
import { PromptCard, type LibraryPrompt } from './prompt-card';
import { PromptFormDialog } from './prompt-form-dialog';

type SourceTab = 'all' | 'curated' | 'mine';
type CategoryFilter = 'all' | PromptCategory;

interface PromptLibrarySurfaceProps {
  subdomain: string;
}

/**
 * Prompt Library surface (spec 144 §7).
 *
 * Browse model (OD-144-3): source tab (All / Curated / My prompts) ×
 * category filter × full-text search over title + body, all client-side
 * at v1 scale (42 curated + ≤200 personal). Personal prompts are created,
 * edited, and deleted through the typed API; every mutation invalidates
 * the prompt list so the surface never shows stale rows.
 */
export function PromptLibrarySurface({ subdomain }: PromptLibrarySurfaceProps) {
  const queryClient = useQueryClient();
  const promptsKey = queryKeys.tenant(subdomain).prompts.list;

  const [source, setSource] = useState<SourceTab>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromptResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: promptsKey,
    queryFn: () =>
      api.get(buildTenantApiPath(subdomain, '/prompts'), {
        schema: PromptListResponseSchema,
      }),
  });

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: promptsKey });

  const createMutation = useMutation({
    mutationFn: (values: { title: string; body: string; category: PromptCategory }) =>
      api.post(buildTenantApiPath(subdomain, '/prompts'), values, {
        schema: PromptResponseSchema,
      }),
    onSuccess: invalidateList,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: { title: string; body: string; category: PromptCategory };
    }) =>
      api.patch(buildTenantApiPath(subdomain, `/prompts/${id}`), values, {
        schema: PromptResponseSchema,
      }),
    onSuccess: invalidateList,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(buildTenantApiPath(subdomain, `/prompts/${id}`), {
        schema: DeletePromptResponseSchema,
      }),
    onSuccess: () => {
      setDeleteTarget(null);
      void invalidateList();
    },
  });

  const allItems: LibraryPrompt[] = useMemo(() => {
    const data = listQuery.data;
    if (!data) return [];
    return [
      ...data.curated.map((prompt) => ({ source: 'curated' as const, prompt })),
      ...data.personal.map((prompt) => ({ source: 'personal' as const, prompt })),
    ];
  }, [listQuery.data]);

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (source === 'curated' && item.source !== 'curated') return false;
      if (source === 'mine' && item.source !== 'personal') return false;
      if (category !== 'all' && item.prompt.category !== category) return false;
      if (needle) {
        const haystack = `${item.prompt.title} ${item.prompt.body}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [allItems, source, category, search]);

  async function handleFormSubmit(values: { title: string; body: string; category: PromptCategory }) {
    setActionError(null);
    try {
      if (editingPrompt) {
        await updateMutation.mutateAsync({ id: editingPrompt.id, values });
      } else {
        await createMutation.mutateAsync(values);
      }
      setEditingPrompt(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not save this prompt. Please try again.'
      );
      throw err;
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not delete this prompt. Please try again.'
      );
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="prompt-library-surface">
      <header className="flex flex-col gap-1">
        <h1 className="text-lg leading-heading font-semibold text-ink">Prompt Library</h1>
        <p className="text-body text-ink-dim">
          Ready-made prompts for social content creation — copy one into ChatGPT or Gemini, or
          save your own.
        </p>
      </header>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            aria-label="Search prompts"
            placeholder="Search prompts…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="prompt-search"
            className="min-w-55 flex-1"
          />
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as CategoryFilter)}
          >
            <SelectTrigger data-testid="prompt-category-filter" className="min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {PROMPT_CATEGORY_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PROMPT_CATEGORY_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={() => {
              setEditingPrompt(null);
              setFormOpen(true);
            }}
            data-testid="prompt-new-button"
          >
            New prompt
          </Button>
        </div>

        <Tabs
          value={source}
          onValueChange={(value) => setSource(value as SourceTab)}
        >
          <TabsList data-testid="prompt-source-tabs">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="curated">Curated</TabsTrigger>
            <TabsTrigger value="mine">My prompts</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {listQuery.isPending ? (
        <p className="text-body text-ink-dim">Loading prompts…</p>
      ) : listQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load prompts</AlertTitle>
          <AlertDescription>Please refresh the page and try again.</AlertDescription>
        </Alert>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          type="no-results"
          title={
            source === 'mine' && allItems.every((item) => item.source !== 'personal')
              ? 'You haven’t added any prompts yet'
              : 'No prompts match your search'
          }
          description={
            source === 'mine' && allItems.every((item) => item.source !== 'personal')
              ? 'Save a prompt you reuse often so it is always one tap away.'
              : 'Try a different search term or category.'
          }
          action={
            source === 'mine' ? (
              <Button
                type="button"
                onClick={() => {
                  setEditingPrompt(null);
                  setFormOpen(true);
                }}
              >
                New prompt
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          data-testid="prompt-grid"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {visibleItems.map((item) => (
            <PromptCard
              key={`${item.source}-${item.prompt.id}`}
              item={item}
              onEdit={(prompt) => {
                setEditingPrompt(prompt);
                setFormOpen(true);
              }}
              onDelete={(prompt) => setDeleteTarget(prompt)}
            />
          ))}
        </div>
      )}

      <PromptFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingPrompt(null);
        }}
        editingPrompt={editingPrompt}
        onSubmit={handleFormSubmit}
      />

      {/* Delete confirmation — a destructive action always confirms (house UX). */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent data-testid="prompt-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              data-testid="prompt-delete-cancel"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                // Keep the dialog open until the delete settles; the
                // mutation's onSuccess clears the target (and closes it).
                event.preventDefault();
                void handleDeleteConfirm();
              }}
              disabled={deleteMutation.isPending}
              data-testid="prompt-delete-confirm-button"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
