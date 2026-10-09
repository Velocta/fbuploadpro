import React, { forwardRef, useState, useId } from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  helperText?: string | undefined;
  error?: string | undefined;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isPassword?: boolean | undefined;
  containerClassName?: string | undefined;
}

const EyeIcon = () => (
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
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
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
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    leftIcon,
    rightIcon,
    isPassword = false,
    type = 'text',
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
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const [showPassword, setShowPassword] = useState(false);
  const effectiveType = isPassword || type === 'password' ? (showPassword ? 'text' : 'password') : type;
  const hasPasswordToggle = isPassword || type === 'password';

  return (
    <>
      <style>{`
        .fbu-input-field:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px var(--ring-focus) !important;
        }
        .fbu-input-field.has-error:focus {
          border-color: var(--accent-3) !important;
          box-shadow: 0 0 0 3px rgba(246, 70, 93, 0.35) !important;
        }
        .fbu-input-field::placeholder {
          color: var(--text-dim);
          opacity: 1;
        }
        .fbu-input-field:hover:not(:disabled):not(:focus) {
          border-color: var(--border-strong);
        }
        .fbu-password-toggle:focus-visible {
          outline: 2px solid var(--primary) !important;
          outline-offset: 2px !important;
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
            htmlFor={inputId}
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
          {leftIcon && (
            <div
              style={{
                position: 'absolute',
                left: SPACING.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-dim)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`fbu-input-field ${error ? 'has-error' : ''} ${className}`}
            style={{
              width: '100%',
              height: '38px',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--text-main)',
              border: `1px solid ${error ? PALETTE.accent3 : 'var(--border-subtle)'}`,
              borderRadius: RADII.sm,
              paddingLeft: leftIcon ? '38px' : SPACING.md,
              paddingRight: hasPasswordToggle || rightIcon ? '38px' : SPACING.md,
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              opacity: disabled ? 0.45 : 1,
              cursor: disabled ? 'not-allowed' : 'text',
              ...style,
            }}
            {...props}
          />

          {hasPasswordToggle ? (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={disabled}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="fbu-password-toggle"
              style={{
                position: 'absolute',
                right: SPACING.sm,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: '4px',
                borderRadius: RADII.xs,
                transition: 'color 0.12s ease',
              }}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          ) : rightIcon ? (
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
              {rightIcon}
            </div>
          ) : null}
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

Input.displayName = 'Input';
