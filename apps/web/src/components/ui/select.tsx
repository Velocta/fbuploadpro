import React, { forwardRef, useId } from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean | undefined;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string | undefined;
  helperText?: string | undefined;
  error?: string | undefined;
  options: SelectOption[];
  placeholder?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  containerClassName?: string | undefined;
}

const ChevronDownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    helperText,
    error,
    options,
    placeholder,
    onValueChange,
    value,
    defaultValue,
    id,
    disabled = false,
    className = '',
    containerClassName = '',
    style,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onValueChange?.(e.target.value);
  };

  return (
    <>
      <style>{`
        .fbu-select-field:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px var(--ring-focus) !important;
        }
        .fbu-select-field.has-error:focus {
          border-color: var(--accent-3) !important;
          box-shadow: 0 0 0 3px rgba(246, 70, 93, 0.35) !important;
        }
        .fbu-select-field:hover:not(:disabled):not(:focus) {
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
            htmlFor={selectId}
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

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
          <select
            ref={ref}
            id={selectId}
            value={value}
            defaultValue={placeholder && defaultValue === undefined && value === undefined ? '' : defaultValue}
            disabled={disabled}
            onChange={handleChange}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`fbu-select-field ${error ? 'has-error' : ''} ${className}`}
            style={{
              width: '100%',
              height: '38px',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--text-main)',
              border: `1px solid ${error ? PALETTE.accent3 : 'var(--border-subtle)'}`,
              borderRadius: RADII.sm,
              paddingLeft: SPACING.md,
              paddingRight: '36px',
              fontSize: '0.875rem',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              opacity: disabled ? 0.45 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
              ...style,
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          <div
            style={{
              position: 'absolute',
              right: SPACING.md,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-dim)',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <ChevronDownIcon />
          </div>
        </div>

        {error ? (
          <span
            id={errorId}
            role="alert"
            style={{
              fontSize: '0.75rem',
              color: PALETTE.accent3,
              lineHeight: 1.25,
            }}
          >
            {error}
          </span>
        ) : helperText ? (
          <span
            id={helperId}
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              lineHeight: 1.25,
            }}
          >
            {helperText}
          </span>
        ) : null}
      </div>
    </>
  );
});

Select.displayName = 'Select';
