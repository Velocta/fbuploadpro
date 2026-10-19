'use client';

import React from 'react';
import {
  composerLabelStyle,
  composerFieldStyle,
  composerInputStyle,
} from './composer-styles';
import { SPACING, PALETTE } from '@/lib/theme';

export const CAPTION_CHAR_LIMIT = 63206;
const CAPTION_WARN_AT = 60000;

export interface ComposerCaptionProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export function ComposerCaption({ value, onChange, required = false }: Readonly<ComposerCaptionProps>) {
  const count = value.length;
  const isNearLimit = count > CAPTION_WARN_AT;

  return (
    <div data-testid="composer-caption" style={composerFieldStyle}>
      <label htmlFor="composer-caption-field" style={composerLabelStyle}>
        Caption{required ? ' (required)' : ''}
      </label>
      <textarea
        id="composer-caption-field"
        data-testid="composer-caption-field"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write a caption for this post…"
        style={{
          ...composerInputStyle(),
          height: 'auto',
          minHeight: '88px',
          resize: 'vertical',
          padding: SPACING.sm,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span
          data-testid="composer-caption-count"
          style={{
            fontSize: '0.75rem',
            color: isNearLimit ? PALETTE.accent3 : 'var(--text-sub)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count.toLocaleString('en-US')} / {CAPTION_CHAR_LIMIT.toLocaleString('en-US')}
        </span>
      </div>
    </div>
  );
}
