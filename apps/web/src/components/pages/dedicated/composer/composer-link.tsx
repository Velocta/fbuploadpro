'use client';

import React, { useState } from 'react';
import { Input } from '@/components/shared/ui/input';

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
  /** Inline error from the form standard — wording matches the summary. */
  error?: string | undefined;
  /** Called on blur so the form can mark the field touched (onTouched). */
  onBlur?: () => void;
}

export const ComposerLink = React.forwardRef<HTMLInputElement, ComposerLinkProps>(
  function ComposerLink({ value, onChange, visible, error, onBlur }, ref) {
    const [touched, setTouched] = useState(false);

    if (!visible) return null;

    const showError = (touched && !isValidLink(value)) || Boolean(error);
    const errorText = error ?? "That doesn't look like a valid link.";

    return (
      <div data-testid="composer-link" className="flex flex-col gap-1.5">
        <label htmlFor="composer-link-field" className="text-body font-medium text-ink">
          Link (optional)
        </label>
        <Input
          ref={ref}
          id="composer-link-field"
          data-testid="composer-link-field"
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            setTouched(true);
            onBlur?.();
          }}
          placeholder="https://example.com/…"
          aria-invalid={showError ? true : undefined}
          aria-describedby={showError ? 'composer-link-error' : 'composer-link-hint'}
        />
        {showError ? (
          <span id="composer-link-error" data-testid="composer-link-error" role="alert" className="text-metadata font-medium text-brand-rose">
            {errorText}
          </span>
        ) : (
          <span id="composer-link-hint" className="text-metadata text-ink-sub">
            Links are checked when you leave this field.
          </span>
        )}
      </div>
    );
  }
);
