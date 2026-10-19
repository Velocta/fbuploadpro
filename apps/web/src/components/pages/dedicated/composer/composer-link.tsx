'use client';

import React, { useState } from 'react';
import {
  composerLabelStyle,
  composerHintStyle,
  composerErrorStyle,
  composerFieldStyle,
  composerInputStyle,
  composerInputErrorBorder,
} from './composer-styles';

/** Visible, blocking link validation — invalid links disable submit. */
export function isValidLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ComposerLinkProps {
  value: string;
  onChange: (value: string) => void;
  /** Only rendered for Text, Photo, and Video formats. */
  visible: boolean;
}

export function ComposerLink({ value, onChange, visible }: Readonly<ComposerLinkProps>) {
  const [touched, setTouched] = useState(false);

  if (!visible) return null;

  const showError = touched && !isValidLink(value);

  return (
    <div data-testid="composer-link" style={composerFieldStyle}>
      <label htmlFor="composer-link-field" style={composerLabelStyle}>
        Link (optional)
      </label>
      <input
        id="composer-link-field"
        data-testid="composer-link-field"
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="https://example.com/…"
        style={{
          ...composerInputStyle(),
          ...(showError ? composerInputErrorBorder : {}),
        }}
      />
      {showError ? (
        <span data-testid="composer-link-error" style={composerErrorStyle}>
          That doesn&apos;t look like a valid link.
        </span>
      ) : (
        <span style={composerHintStyle}>Links are checked when you leave this field.</span>
      )}
    </div>
  );
}
