import React, { forwardRef, useId } from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    description,
    checked,
    defaultChecked,
    onCheckedChange,
    disabled = false,
    id,
    className = '',
    style,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const checkboxId = id || generatedId;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(e.target.checked);
  };

  return (
    <>
      <style>{`
        .fbu-checkbox-input:focus-visible + .fbu-checkbox-box {
          box-shadow: 0 0 0 3px var(--ring-focus) !important;
        }
        .fbu-checkbox-wrapper:hover:not(.is-disabled) .fbu-checkbox-box {
          border-color: var(--border-strong);
        }
      `}</style>
      <label
        htmlFor={checkboxId}
        className={`fbu-checkbox-wrapper ${disabled ? 'is-disabled' : ''} ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'flex-start',
          gap: SPACING.sm,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          userSelect: 'none',
          fontFamily: TYPOGRAPHY.fontFamily,
          ...style,
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '2px' }}>
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            role="checkbox"
            aria-checked={checked !== undefined ? (checked ? 'true' : 'false') : undefined}
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            onChange={handleChange}
            className="fbu-checkbox-input"
            style={{
              position: 'absolute',
              opacity: 0,
              width: '18px',
              height: '18px',
              margin: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              zIndex: 1,
            }}
            {...props}
          />
          <div
            className="fbu-checkbox-box"
            style={{
              width: '18px',
              height: '18px',
              borderRadius: RADII.xs, // Strict 4px rectilinear geometry
              border: `1px solid ${checked ? PALETTE.primary : 'var(--border-subtle)'}`,
              backgroundColor: checked ? PALETTE.primary : 'var(--bg-canvas)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
              boxSizing: 'border-box',
            }}
          >
            {checked && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke={PALETTE.background}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>

        {(label || description) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {label && (
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: 'var(--text-main)',
                  lineHeight: 1.3,
                }}
              >
                {label}
              </span>
            )}
            {description && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  lineHeight: 1.3,
                }}
              >
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    </>
  );
});

Checkbox.displayName = 'Checkbox';
