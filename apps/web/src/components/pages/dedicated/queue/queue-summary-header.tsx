'use client';

import React from 'react';
import { THEME, SPACING, TYPOGRAPHY } from '@/lib/theme';
import { summarizeQueue } from './queue-logic';
import type { DedicatedQueueItem } from './queue-types';

export interface QueueSummaryHeaderProps {
  items: DedicatedQueueItem[];
  timeZone: string;
}

/** Quiet one-line summary: "12 posts queued · runs through Nov 3 · 2 failed need attention". */
export function QueueSummaryHeader({ items, timeZone }: Readonly<QueueSummaryHeaderProps>) {
  const summary = summarizeQueue(items);
  if (items.length === 0) return null;

  const parts: string[] = [
    `${summary.pendingCount} ${summary.pendingCount === 1 ? 'post' : 'posts'} queued`,
  ];
  if (summary.runsThrough) {
    let zone = timeZone;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(summary.runsThrough);
    } catch {
      zone = 'UTC';
    }
    const runsThrough = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      month: 'short',
      day: 'numeric',
    }).format(summary.runsThrough);
    parts.push(`runs through ${runsThrough}`);
  }
  if (summary.failedCount > 0) {
    parts.push(`${summary.failedCount} failed need${summary.failedCount === 1 ? 's' : ''} attention`);
  }

  return (
    <p
      data-testid="queue-summary"
      style={{
        margin: 0,
        fontSize: '0.8125rem',
        color: `var(--text-sub, ${THEME.default.text.secondary})`,
        fontWeight: TYPOGRAPHY.weights.medium,
      }}
    >
      {parts.join(' · ')}
    </p>
  );
}

export function queueHeaderRowStyle(): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    flexWrap: 'wrap',
  };
}
