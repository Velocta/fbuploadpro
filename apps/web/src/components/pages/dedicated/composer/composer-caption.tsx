'use client';

import React from 'react';
import { Textarea } from '@/components/shared/ui/textarea';
import { cn } from '@/lib/utils';

export const CAPTION_CHAR_LIMIT = 63206;
const CAPTION_WARN_AT = 60000;

export interface ComposerCaptionProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Inline error from the form standard — wording matches the summary. */
  error?: string | undefined;
  /** Called on blur so the form can mark the field touched (onTouched). */
  onBlur?: () => void;
}

export const ComposerCaption = React.forwardRef<HTMLTextAreaElement, ComposerCaptionProps>(
  function ComposerCaption({ value, onChange, required = false, error, onBlur }, ref) {
    const count = value.length;
    const isNearLimit = count > CAPTION_WARN_AT;

    return (
      <div data-testid="composer-caption" className="flex flex-col gap-1.5">
        <label htmlFor="composer-caption-field" className="text-body font-medium text-ink">
          Caption{required ? ' (required)' : ''}
        </label>
        <Textarea
          ref={ref}
          id="composer-caption-field"
          data-testid="composer-caption-field"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Write a caption for this post…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'composer-caption-error' : undefined}
          className="min-h-24 resize-y"
        />
        {error ? (
          <p id="composer-caption-error" role="alert" className="text-metadata font-medium text-brand-rose">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <span
            data-testid="composer-caption-count"
            className={cn(
              'text-metadata tabular-nums',
              isNearLimit ? 'text-brand-rose' : 'text-ink-sub'
            )}
          >
            {count.toLocaleString('en-US')} / {CAPTION_CHAR_LIMIT.toLocaleString('en-US')}
          </span>
        </div>
      </div>
    );
  }
);
