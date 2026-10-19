'use client';

import React from 'react';
import { THEME, PALETTE, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { QUEUE_FILTERS, QUEUE_FILTER_LABELS } from './queue-types';
import type { QueueFilter } from './queue-types';

export interface QueueFilterTabsProps {
  counts: Record<QueueFilter, number>;
  active: QueueFilter;
  onChange: (filter: QueueFilter) => void;
}

/** Plain text status tabs with counts — no boxes, active tab underlined. */
export function QueueFilterTabs({ counts, active, onChange }: Readonly<QueueFilterTabsProps>) {
  return (
    <div
      role="tablist"
      aria-label="Filter posts by status"
      style={{
        display: 'flex',
        gap: SPACING.lg,
        borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        overflowX: 'auto',
      }}
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
            style={{
              padding: `${SPACING.sm} 2px`,
              background: 'none',
              border: 'none',
              borderBottom: isActive
                ? `2px solid ${PALETTE.primary}`
                : '2px solid transparent',
              marginBottom: '-1px',
              color: isActive
                ? `var(--text-main, ${THEME.default.text.primary})`
                : `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              fontWeight: isActive ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{QUEUE_FILTER_LABELS[filter]}</span>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              {counts[filter]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
