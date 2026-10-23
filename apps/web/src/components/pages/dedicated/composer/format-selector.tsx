'use client';

import React from 'react';
import { type PostFormat } from '@fbuploadpro/contracts';
import { cn } from '@/lib/utils';

const FORMATS: Array<{ id: PostFormat; label: string; testId: string }> = [
  { id: 'text', label: 'Text', testId: 'composer-format-text' },
  { id: 'image', label: 'Photo', testId: 'composer-format-image' },
  { id: 'video', label: 'Video', testId: 'composer-format-video' },
  { id: 'reel', label: 'Reel', testId: 'composer-format-reel' },
  { id: 'story', label: 'Story', testId: 'composer-format-story' },
];

export interface FormatSelectorProps {
  value: PostFormat;
  onChange: (format: PostFormat) => void;
  /** Edit mode: the format is locked to the post's original format. */
  disabled?: boolean;
}

export function FormatSelector({ value, onChange, disabled = false }: Readonly<FormatSelectorProps>) {
  return (
    <div
      data-testid="composer-format-selector"
      role="tablist"
      aria-label="Post format"
      className="flex max-w-full flex-wrap gap-1 border-b border-line"
    >
      {FORMATS.map((format) => (
        <button
          key={format.id}
          type="button"
          role="tab"
          aria-selected={value === format.id}
          aria-disabled={disabled}
          disabled={disabled}
          data-testid={format.testId}
          onClick={() => {
            if (!disabled) onChange(format.id);
          }}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-body font-medium whitespace-nowrap transition-colors duration-fast outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:cursor-not-allowed disabled:opacity-50',
            value === format.id
              ? 'border-brand-gold font-semibold text-ink'
              : 'border-transparent text-ink-sub hover:text-ink'
          )}
        >
          {format.label}
        </button>
      ))}
    </div>
  );
}
