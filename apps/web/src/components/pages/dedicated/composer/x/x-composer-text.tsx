'use client';

/**
 * The X composer's post-text field (spec 132 §4.5) — the caption
 * field's pattern with X's weighted counting from the contracts
 * validators: links count as 23 characters, CJK/emoji count double,
 * the limit is 280 weighted characters. The counter is always visible;
 * over-limit is a blocking inline error whose wording matches the
 * form summary exactly.
 */
import React from 'react';
import { validateXText, X_MAX_WEIGHTED_CHARACTERS, X_URL_WEIGHTED_LENGTH } from '@fbuploadpro/contracts';
import { Textarea } from '@/components/shared/ui/textarea';
import { cn } from '@/lib/utils';

export interface XComposerTextProps {
  value: string;
  onChange: (value: string) => void;
  /** Required when no media is attached — a media post may omit text. */
  required?: boolean;
  error?: string | undefined;
  onBlur?: () => void;
}

export const XComposerText = React.forwardRef<HTMLTextAreaElement, XComposerTextProps>(
  function XComposerText({ value, onChange, required = false, error, onBlur }, ref) {
    const { weightedLength, remaining } = validateXText(value);
    const isOver = remaining < 0;

    return (
      <div data-testid="x-composer-text" className="flex flex-col gap-1.5">
        <label htmlFor="x-composer-text-field" className="text-body font-medium text-ink">
          Post text{required ? ' (required)' : ''}
        </label>
        <Textarea
          ref={ref}
          id="x-composer-text-field"
          data-testid="x-composer-text-field"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Write your post…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'x-composer-text-error' : undefined}
          className="min-h-24 resize-y"
        />
        {error ? (
          <p id="x-composer-text-error" role="alert" className="text-metadata font-medium text-brand-rose">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-metadata text-ink-sub">
            Links count as {X_URL_WEIGHTED_LENGTH} characters on X.
          </span>
          <span
            data-testid="x-composer-text-count"
            className={cn('text-metadata tabular-nums', isOver ? 'font-medium text-brand-rose' : 'text-ink-sub')}
          >
            {weightedLength} / {X_MAX_WEIGHTED_CHARACTERS}
          </span>
        </div>
      </div>
    );
  }
);
