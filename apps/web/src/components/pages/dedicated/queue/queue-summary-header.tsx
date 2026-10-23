'use client';

import * as React from 'react';
import { summarizeQueue } from './queue-logic';
import type { DedicatedQueueItem } from './queue-types';

export interface QueueSummaryHeaderProps {
  items: DedicatedQueueItem[];
  timeZone: string;
}

/**
 * Quiet one-line summary (spec 105 copy shape, preserved):
 * "12 posts queued · runs through Nov 3 · 2 failed need attention".
 * Rebuilt on tokens (spec 134 PR-134-1) — no inline styles.
 */
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
    <p data-testid="queue-summary" className="m-0 text-body font-medium text-ink-sub">
      {parts.join(' · ')}
    </p>
  );
}
