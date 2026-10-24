'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Explicit-choice buttons for composer fields where a value must be
 * picked and "unchosen" must stay visible — the tab pattern from the
 * Facebook composer's format selector, as a radiogroup. Used for the
 * YouTube made-for-kids gate (no default, no pre-selection: nothing is
 * selected until the user picks) and the TikTok post-type choice.
 */

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  testId?: string;
}

export interface ChoiceButtonsProps<T extends string> {
  label: string;
  options: Array<ChoiceOption<T>>;
  /** '' (or null) renders nothing selected — the unchosen state. */
  value: T | '';
  onChange: (value: T) => void;
  onBlur?: () => void;
  testId?: string;
}

export function ChoiceButtons<T extends string>({
  label,
  options,
  value,
  onChange,
  onBlur,
  testId,
}: Readonly<ChoiceButtonsProps<T>>): React.ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className="flex max-w-full flex-wrap gap-1"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            onBlur={onBlur}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-body font-medium whitespace-nowrap transition-colors duration-fast outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
              selected
                ? 'border-brand-gold bg-surface-raised font-semibold text-ink'
                : 'border-line text-ink-sub hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
