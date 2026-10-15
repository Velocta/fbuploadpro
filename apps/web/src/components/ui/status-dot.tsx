import React from 'react';
import { STATUS_SIGNALS, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export type StatusType = keyof typeof STATUS_SIGNALS;

export interface StatusDotProps {
  status: StatusType;
  label?: string;
  showLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * StatusDot
 * 
 * STRICT CONSTITUTIONAL RULE:
 * Strictly unboxed 6px luminous dot with micro-halo.
 * NEVER wrap in capsule or pill badges.
 */
export function StatusDot({
  status,
  label,
  showLabel = true,
  className = '',
  style,
}: Readonly<StatusDotProps>) {
  const signal = STATUS_SIGNALS[status] ?? STATUS_SIGNALS.idle;
  const displayLabel = label || signal.label;

  return (
    <span
      role="status"
      aria-label={`Status: ${displayLabel}`}
      className={`fbu-status-dot ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACING.sm,
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: '0.8125rem',
        color: 'var(--text-main)',
        lineHeight: 1,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: RADII.full,
          backgroundColor: signal.dot,
          boxShadow: signal.halo,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {showLabel && <span>{displayLabel}</span>}
    </span>
  );
}
