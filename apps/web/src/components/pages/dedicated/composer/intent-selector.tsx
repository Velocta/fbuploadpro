'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type ComposerIntent = 'now' | 'schedule' | 'queue';

const INTENTS: Array<{ id: ComposerIntent; label: string; testId: string }> = [
  { id: 'now', label: 'Post now', testId: 'composer-intent-now' },
  { id: 'schedule', label: 'Schedule', testId: 'composer-intent-schedule' },
  { id: 'queue', label: 'Add to queue', testId: 'composer-intent-queue' },
];

export interface IntentSelectorProps {
  value: ComposerIntent;
  onChange: (intent: ComposerIntent) => void;
  /** True when the page has no posting times at all — the queue option is disabled. */
  queueDisabled: boolean;
}

export function IntentSelector({ value, onChange, queueDisabled }: Readonly<IntentSelectorProps>) {
  return (
    <div
      data-testid="composer-intent-selector"
      role="tablist"
      aria-label="Publishing intent"
      className="flex max-w-full gap-1 overflow-x-auto border-b border-line"
    >
      {INTENTS.map((intent) => {
        const isActive = value === intent.id;
        const isDisabled = intent.id === 'queue' && queueDisabled;
        return (
          <button
            key={intent.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={intent.testId}
            disabled={isDisabled}
            onClick={() => onChange(intent.id)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-body font-medium whitespace-nowrap transition-colors duration-fast outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:cursor-not-allowed disabled:opacity-50',
              isActive
                ? 'border-brand-gold font-semibold text-ink'
                : 'border-transparent text-ink-sub hover:text-ink'
            )}
          >
            {intent.label}
          </button>
        );
      })}
    </div>
  );
}
