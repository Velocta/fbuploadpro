'use client';

import React from 'react';
import { segmentedOptionStyle } from './composer-styles';

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
      style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)' }}
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
            style={segmentedOptionStyle(isActive, isDisabled)}
          >
            {intent.label}
          </button>
        );
      })}
    </div>
  );
}
