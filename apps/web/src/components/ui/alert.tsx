import React from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  severity?: AlertSeverity;
  title?: string;
  message?: string;
  onClose?: () => void;
  children?: React.ReactNode;
}

const severityConfig: Record<
  AlertSeverity,
  {
    border: string;
    background: string;
    accentColor: string;
    icon: React.ReactNode;
  }
> = {
  info: {
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-panel)',
    accentColor: 'var(--text-main)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  success: {
    border: `1px solid ${PALETTE.accent4}`,
    background: 'rgba(46, 189, 133, 0.08)',
    accentColor: PALETTE.accent4,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PALETTE.accent4} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  warning: {
    border: `1px solid ${PALETTE.primary}`,
    background: 'rgba(250, 215, 52, 0.08)',
    accentColor: PALETTE.primary,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PALETTE.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  error: {
    border: `1px solid ${PALETTE.accent3}`,
    background: 'rgba(246, 70, 93, 0.08)',
    accentColor: PALETTE.accent3,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PALETTE.accent3} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
};

export function Alert({
  severity = 'info',
  title,
  message,
  onClose,
  children,
  className = '',
  style,
  ...props
}: Readonly<AlertProps>) {
  const config = severityConfig[severity];
  const role = severity === 'error' || severity === 'warning' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={`fbu-alert fbu-alert-${severity} ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACING.md,
        padding: `${SPACING.md} ${SPACING.lg}`,
        borderRadius: RADII.sm, // 6px
        border: config.border,
        backgroundColor: config.background,
        color: 'var(--text-main)',
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: '0.875rem',
        boxSizing: 'border-box',
        position: 'relative',
        ...style,
      }}
      {...props}
    >
      <div style={{ flexShrink: 0, marginTop: '2px', color: config.accentColor }} aria-hidden="true">
        {config.icon}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {title && (
          <strong
            style={{
              fontWeight: TYPOGRAPHY.weights.semibold,
              lineHeight: 1.3,
              color: config.accentColor,
            }}
          >
            {title}
          </strong>
        )}
        {(message || children) && (
          <div style={{ color: 'var(--text-main)', lineHeight: 1.45 }}>
            {message || children}
          </div>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: RADII.xs,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
