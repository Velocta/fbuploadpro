'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tab-style format selector for the destination composers — the
 * IntentSelector's interaction pattern (44px tab buttons, gold active
 * underline) over a caller-supplied option list, so each platform
 * offers exactly the formats its contracts schema supports. An option
 * the platform must not offer (e.g. Stories for a Creator account) is
 * ABSENT from the list — never rendered disabled (spec 132 §4.1 gate).
 */
export interface DestinationFormatOption {
  id: string;
  label: string;
}

export interface DestinationFormatSelectorProps {
  options: DestinationFormatOption[];
  value: string;
  onChange: (id: string) => void;
  testIdPrefix: string;
}

export function DestinationFormatSelector({
  options,
  value,
  onChange,
  testIdPrefix,
}: Readonly<DestinationFormatSelectorProps>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">Post type</span>
      <div
        data-testid={`${testIdPrefix}-format-selector`}
        role="tablist"
        aria-label="Post type"
        className="flex max-w-full gap-1 overflow-x-auto border-b border-line"
      >
        {options.map((option) => {
          const isActive = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`${testIdPrefix}-format-${option.id}`}
              onClick={() => onChange(option.id)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-body font-medium whitespace-nowrap transition-colors duration-fast outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
                isActive
                  ? 'border-brand-gold font-semibold text-ink'
                  : 'border-transparent text-ink-sub hover:text-ink'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
