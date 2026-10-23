'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { QUEUE_FILTERS, QUEUE_FILTER_LABELS } from './queue-types';
import type { QueueFilter } from './queue-types';

export interface QueueFilterTabsProps {
  counts: Record<QueueFilter, number>;
  active: QueueFilter;
  onChange: (filter: QueueFilter) => void;
}

/**
 * Status filter row (spec 105's filter set with counts, re-presented as
 * the Table pattern's filter tabs on tokens — spec 134 §3.1): All ·
 * Queued · Scheduled · Published · Failed, active tab underlined in gold,
 * horizontally scrollable at small widths with 44px targets.
 */
export function QueueFilterTabs({ counts, active, onChange }: Readonly<QueueFilterTabsProps>) {
  return (
    <div
      role="tablist"
      aria-label="Filter posts by status"
      className="flex max-w-full gap-2 overflow-x-auto border-b border-line"
    >
      {QUEUE_FILTERS.map((filter) => {
        const isActive = filter === active;
        return (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`queue-filter-${filter}`}
            onClick={() => onChange(filter)}
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-2 text-body whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
              isActive
                ? 'border-primary font-semibold text-ink'
                : 'border-transparent font-medium text-ink-sub hover:text-ink'
            )}
          >
            <span>{QUEUE_FILTER_LABELS[filter]}</span>
            <span className="text-metadata font-medium text-ink-sub tabular-nums">
              {counts[filter]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
