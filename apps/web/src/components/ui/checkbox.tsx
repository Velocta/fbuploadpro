import React, { forwardRef, useState, useId } from 'react';
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
    checked: controlledChecked,
    defaultChecked = false,
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

  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
  const isChecked = controlledChecked ?? uncontrolledChecked;

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (disabled) return;
    e.preventDefault();
    const next = !isChecked;
    if (controlledChecked === undefined) {
      setUncontrolledChecked(next);
    }
    onCheckedChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      handleToggle(e);
    }
  };

  return (
    <>
      <style>{`
        .fbu-checkbox-wrapper:focus-visible .fbu-checkbox-box {
          box-shadow: 0 0 0 3px var(--ring-focus, rgba(250, 215, 52, 0.35)) !important;
        }
        .fbu-checkbox-wrapper:hover:not(.is-disabled) .fbu-checkbox-box {
          border-color: var(--border-strong, #b29527);
        }
      `}</style>
      <div
        id={checkboxId}
        role="checkbox"
        tabIndex={disabled ? -1 : 0}
        aria-checked={isChecked}
        aria-disabled={disabled ? 'true' : undefined}
        onKeyDown={handleKeyDown}
        onClick={handleToggle}
        className={`fbu-checkbox-wrapper ${disabled ? 'is-disabled' : ''} ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'flex-start',
          gap: SPACING.sm,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          userSelect: 'none',
          fontFamily: TYPOGRAPHY.fontFamily,
          outline: 'none',
          ...style,
        }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '2px' }}>
          <input
            ref={ref}
            type="checkbox"
            tabIndex={-1}
            aria-hidden="true"
            checked={isChecked}
            disabled={disabled}
            readOnly
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: 0,
              height: 0,
              margin: 0,
            }}
            {...props}
          />
          <div
            className="fbu-checkbox-box"
            style={{
              width: '18px',
              height: '18px',
              borderRadius: RADII.xs, // Strict 4px rectilinear geometry
              border: `1px solid ${isChecked ? PALETTE.primary : 'var(--border-subtle, #2b323c)'}`,
              backgroundColor: isChecked ? PALETTE.primary : 'var(--bg-canvas, #000000)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            {isChecked && (
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
                  color: 'var(--text-main, currentColor)',
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
                  color: 'var(--text-dim, #6b7280)',
                  lineHeight: 1.3,
                }}
              >
                {description}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
});

Checkbox.displayName = 'Checkbox';
