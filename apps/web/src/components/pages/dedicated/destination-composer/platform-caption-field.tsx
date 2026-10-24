'use client';

import React from 'react';
import { utf8ByteLength } from '@fbuploadpro/contracts';
import { Textarea } from '@/components/shared/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Caption/description field for the platform composers — the Facebook
 * composer's caption field (`composer-caption.tsx`) with the limit
 * supplied by the platform instead of baked in: TikTok counts
 * characters against its caption limit; YouTube's description limit is
 * measured in UTF-8 bytes, so its counter counts bytes (the unit the
 * contracts validator `validateYouTubeUploadFields` enforces).
 */

export interface PlatformCaptionFieldProps {
  /** Field id stem — element ids and test ids derive from it. */
  idStem: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called on blur so the form can mark the field touched (onTouched). */
  onBlur?: () => void;
  placeholder: string;
  required?: boolean;
  /** Inline error from the form standard — wording matches the summary. */
  error?: string | undefined;
  /** The platform limit, in the unit `countMode` names. */
  limit: number;
  countMode: 'characters' | 'bytes';
  limitLabel: string;
  rows?: number;
}

export const PlatformCaptionField = React.forwardRef<
  HTMLTextAreaElement,
  PlatformCaptionFieldProps
>(function PlatformCaptionField(
  {
    idStem,
    label,
    value,
    onChange,
    onBlur,
    placeholder,
    required = false,
    error,
    limit,
    countMode,
    limitLabel,
    rows = 4,
  },
  ref,
) {
  const count =
    countMode === 'bytes' ? utf8ByteLength(value) : [...value].length;
  const isOverLimit = count > limit;
  const fieldId = `${idStem}-field`;
  const errorId = `${idStem}-error`;

  return (
    <div data-testid={idStem} className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-body font-medium text-ink">
        {label}
        {required ? ' (required)' : ''}
      </label>
      <Textarea
        ref={ref}
        id={fieldId}
        data-testid={fieldId}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-24 resize-y"
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-metadata font-medium text-brand-rose"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <span
          data-testid={`${idStem}-count`}
          className={cn(
            'text-metadata tabular-nums',
            isOverLimit ? 'text-brand-rose' : 'text-ink-sub',
          )}
        >
          {count.toLocaleString('en-US')} / {limitLabel}
        </span>
      </div>
    </div>
  );
});
