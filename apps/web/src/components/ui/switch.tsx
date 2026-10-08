import React, { forwardRef, useState, useId } from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface SwitchProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    label,
    description,
    checked: controlledChecked,
    defaultChecked = false,
    onCheckedChange,
    disabled = false,
    name,
    id,
    className = '',
    style,
  },
  ref
) {
  const generatedId = useId();
  const switchId = id || generatedId;

  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
  const isChecked = controlledChecked !== undefined ? controlledChecked : uncontrolledChecked;

  const handleToggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (controlledChecked === undefined) {
      setUncontrolledChecked(next);
    }
    onCheckedChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <>
      <style>{`
        .fbu-switch-button:focus-visible {
          box-shadow: 0 0 0 3px var(--ring-focus) !important;
        }
      `}</style>
      <div
        className={`fbu-switch-wrapper ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'flex-start',
          gap: SPACING.sm,
          fontFamily: TYPOGRAPHY.fontFamily,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          userSelect: 'none',
          ...style,
        }}
        onClick={handleToggle}
      >
        <button
          ref={ref}
          id={switchId}
          type="button"
          role="switch"
          aria-checked={isChecked}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className="fbu-switch-button"
          style={{
            position: 'relative',
            width: '40px',
            height: '22px',
            borderRadius: RADII.full,
            backgroundColor: isChecked ? PALETTE.primary : 'var(--bg-hover)',
            border: `1px solid ${isChecked ? PALETTE.primary : 'var(--border-subtle)'}`,
            padding: '2px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            outline: 'none',
            transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              width: '16px',
              height: '16px',
              borderRadius: RADII.full,
              backgroundColor: isChecked ? PALETTE.background : '#848e9c',
              transform: isChecked ? 'translateX(18px)' : 'translateX(0)',
              transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
              display: 'block',
            }}
          />
          {name && (
            <input
              type="checkbox"
              name={name}
              checked={isChecked}
              readOnly
              style={{ display: 'none' }}
              tabIndex={-1}
            />
          )}
        </button>

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
      </div>
    </>
  );
});

Switch.displayName = 'Switch';
