import React from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export type StatusType = 'operational' | 'queued' | 'critical' | 'idle';

export interface StatusDotProps {
  status: StatusType;
  label?: string;
  showLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const statusConfig: Record<
  StatusType,
  {
    dot: string;
    halo: string;
    label: string;
  }
> = {
  operational: {
    dot: PALETTE.accent4,
    halo: '0 0 6px rgba(46, 189, 133, 0.45)',
    label: 'Operational',
  },
  queued: {
    dot: PALETTE.primary,
    halo: '0 0 6px rgba(250, 215, 52, 0.45)',
    label: 'Queued',
  },
  critical: {
    dot: PALETTE.accent3,
    halo: '0 0 6px rgba(246, 70, 93, 0.45)',
    label: 'Critical',
  },
  idle: {
    dot: '#848e9c',
    halo: 'none',
    label: 'Idle',
  },
};

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
}: StatusDotProps) {
  const signal = statusConfig[status];
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
