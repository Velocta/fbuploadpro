import React, { forwardRef, useState, useId } from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string | undefined;
  helperText?: string | undefined;
  error?: string | undefined;
  maxLength?: number | undefined;
  showCount?: boolean | undefined;
  containerClassName?: string | undefined;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Readonly<TextareaProps>>(function Textarea(
  {
    label,
    helperText,
    error,
    maxLength,
    showCount = false,
    rows = 4,
    id,
    disabled = false,
    className = '',
    containerClassName = '',
    style,
    value,
    defaultValue,
    onChange,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;

  const [uncontrolledLength, setUncontrolledLength] = useState(() => {
    if (defaultValue !== undefined) {
      return String(defaultValue).length;
    }
    return 0;
  });

  const currentLength = value !== undefined ? String(value).length : uncontrolledLength;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (value === undefined) {
      setUncontrolledLength(e.target.value.length);
    }
    onChange?.(e);
  };

  const getAriaDescribedBy = (): string | undefined => {
    if (error) return errorId;
    if (helperText) return helperId;
    return undefined;
  };

  return (
    <>
      <style>{`
        .fbu-textarea-field:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px var(--ring-focus) !important;
        }
        .fbu-textarea-field.has-error:focus {
          border-color: var(--accent-3) !important;
          box-shadow: 0 0 0 3px rgba(246, 70, 93, 0.35) !important;
        }
        .fbu-textarea-field::placeholder {
          color: var(--text-dim);
          opacity: 1;
        }
        .fbu-textarea-field:hover:not(:disabled):not(:focus) {
          border-color: var(--border-strong);
        }
      `}</style>
      <div
        className={containerClassName}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.xs,
          fontFamily: TYPOGRAPHY.fontFamily,
          width: '100%',
        }}
      >
        {label && (
          <label
            htmlFor={textareaId}
            style={{
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: 'var(--text-sub)',
              lineHeight: 1.25,
            }}
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          onChange={handleChange}
          aria-invalid={Boolean(error)}
          aria-describedby={getAriaDescribedBy()}
          className={`fbu-textarea-field ${error ? 'has-error' : ''} ${className}`}
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-canvas)',
            color: 'var(--text-main)',
            border: `1px solid ${error ? PALETTE.accent3 : 'var(--border-subtle)'}`,
            borderRadius: RADII.sm,
            padding: `${SPACING.sm} ${SPACING.md}`,
            fontSize: '0.875rem',
            lineHeight: 1.5,
            fontFamily: TYPOGRAPHY.fontFamily,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
            ...style,
          }}
          {...props}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: SPACING.sm,
          }}
        >
          <div style={{ flex: 1 }}>
            {error && (
              <span
                id={errorId}
                role="alert"
                style={{
                  fontSize: '0.75rem',
                  color: PALETTE.accent3,
                  lineHeight: 1.25,
                  display: 'block',
                }}
              >
                {error}
              </span>
            )}
            {!error && helperText && (
              <span
                id={helperId}
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  lineHeight: 1.25,
                  display: 'block',
                }}
              >
                {helperText}
              </span>
            )}
          </div>

          {(showCount || maxLength !== undefined) && (
            <span
              className="tabular-nums"
              style={{
                fontSize: '0.75rem',
                color: maxLength && currentLength >= maxLength ? PALETTE.accent3 : 'var(--text-dim)',
                whiteSpace: 'nowrap',
                lineHeight: 1.25,
              }}
            >
              {currentLength}
              {maxLength !== undefined ? ` / ${maxLength}` : ''}
            </span>
          )}
        </div>
      </div>
    </>
  );
});

Textarea.displayName = 'Textarea';
