'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { CuratedPrompt, PromptCategory, PromptResponse } from '@fbuploadpro/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, Tag } from '@/components/shared/ui';
import { PROMPT_CATEGORY_LABELS } from '@/lib/api/schemas/prompts';
import { copyTextToClipboard } from './copy-text';

export type LibraryPrompt =
  | { source: 'curated'; prompt: CuratedPrompt }
  | { source: 'personal'; prompt: PromptResponse };

interface PromptCardProps {
  item: LibraryPrompt;
  onEdit?: (prompt: PromptResponse) => void;
  onDelete?: (prompt: PromptResponse) => void;
}

/**
 * One prompt card (spec 144 §7): title, category tag, body, and a Copy
 * button with inline "Copied" feedback. Edit/Delete appear only for
 * personal prompts — curated prompts are read-only product data.
 */
export function PromptCard({ item, onEdit, onDelete }: PromptCardProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const { prompt } = item;
  const category = prompt.category as PromptCategory;

  async function handleCopy() {
    const ok = await copyTextToClipboard(prompt.body);
    setCopyState(ok ? 'copied' : 'failed');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopyState('idle'), 2000);
  }

  return (
    <Card data-testid={`prompt-card-${prompt.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{prompt.title}</CardTitle>
          <Tag>{PROMPT_CATEGORY_LABELS[category]}</Tag>
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap break-words text-body text-ink">{prompt.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            data-testid={`prompt-copy-${prompt.id}`}
          >
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </Button>
          {item.source === 'personal' && onEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit(item.prompt)}
              data-testid={`prompt-edit-${prompt.id}`}
            >
              Edit
            </Button>
          ) : null}
          {item.source === 'personal' && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(item.prompt)}
              data-testid={`prompt-delete-${prompt.id}`}
            >
              Delete
            </Button>
          ) : null}
          {copyState === 'failed' ? (
            <span role="alert" className="text-body text-brand-rose">
              Copy failed — please select the text manually.
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
