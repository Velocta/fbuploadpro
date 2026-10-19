'use client';

import React from 'react';
import { type PostFormat } from '@fbuploadpro/contracts';
import { segmentedOptionStyle } from './composer-styles';

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
      style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)' }}
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
          style={segmentedOptionStyle(value === format.id, disabled)}
        >
          {format.label}
        </button>
      ))}
    </div>
  );
}
