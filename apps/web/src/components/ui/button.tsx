import React, { forwardRef } from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    height: '30px',
    padding: `0 ${SPACING.sm}`,
    fontSize: '0.75rem',
    gap: '6px',
  },
  md: {
    height: '38px',
    padding: `0 ${SPACING.md}`,
    fontSize: '0.875rem',
    gap: SPACING.xs,
  },
  lg: {
    height: '44px',
    padding: `0 ${SPACING.lg}`,
    fontSize: '1rem',
    gap: SPACING.sm,
  },
};

const Spinner = ({ size }: { size: ButtonSize }) => {
  const dimension = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        animation: 'spin 0.75s linear infinite',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" />
    </svg>
  );
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    disabled = false,
    children,
    className = '',
    style,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading;

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: TYPOGRAPHY.fontFamily,
    fontWeight: variant === 'primary' ? TYPOGRAPHY.weights.bold : TYPOGRAPHY.weights.semibold,
    lineHeight: 1,
    borderRadius: RADII.sm,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled && !isLoading ? 0.45 : 1,
    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
    outline: 'none',
    position: 'relative',
    userSelect: 'none',
    boxSizing: 'border-box',
    ...sizeStyles[size],
  };

  const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      backgroundColor: PALETTE.primary,
      color: PALETTE.background,
      border: 'none',
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
    },
    secondary: {
      backgroundColor: 'transparent',
      color: 'var(--text-main)',
      border: '1px solid var(--border-subtle)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-main)',
      border: '1px solid transparent',
    },
    danger: {
      backgroundColor: PALETTE.accent3,
      color: PALETTE.text,
      border: 'none',
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25)',
    },
    link: {
      backgroundColor: 'transparent',
      color: PALETTE.accent1,
      border: 'none',
      padding: 0,
      height: 'auto',
      textDecoration: 'none',
    },
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .fbu-btn:focus-visible {
          box-shadow: 0 0 0 3px var(--ring-focus) !important;
        }
        .fbu-btn-primary:not(:disabled):hover {
          filter: brightness(1.08);
        }
        .fbu-btn-primary:not(:disabled):active {
          filter: brightness(0.94);
        }
        .fbu-btn-secondary:not(:disabled):hover {
          background-color: var(--bg-hover) !important;
          border-color: var(--border-strong) !important;
        }
        .fbu-btn-secondary:not(:disabled):active {
          background-color: var(--bg-active) !important;
        }
        .fbu-btn-ghost:not(:disabled):hover {
          background-color: var(--bg-hover) !important;
        }
        .fbu-btn-ghost:not(:disabled):active {
          background-color: var(--bg-active) !important;
        }
        .fbu-btn-danger:not(:disabled):hover {
          filter: brightness(1.10);
        }
        .fbu-btn-danger:not(:disabled):active {
          filter: brightness(0.90);
        }
        .fbu-btn-link:not(:disabled):hover {
          text-decoration: underline !important;
        }
      `}</style>
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading ? 'true' : undefined}
        aria-disabled={isDisabled ? 'true' : undefined}
        className={`fbu-btn fbu-btn-${variant} ${className}`}
        style={{
          ...baseStyle,
          ...variantStyles[variant],
          ...style,
        }}
        {...props}
      >
        {isLoading && <Spinner size={size} />}
        {!isLoading && leftIcon && (
          <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && (
          <span style={{ display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    </>
  );
});

Button.displayName = 'Button';
