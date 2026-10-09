import React from 'react';
import { PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface FormErrorCalloutProps {
  message?: string | null | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}

/**
 * Compact, non-intrusive inline error callout for general form-level errors
 * (e.g., bad credentials, network timeouts, rate limit warnings).
 * Placed immediately above the primary action button to prevent disruptive layout shifts.
 */
export function FormErrorCallout({
  message,
  className = '',
  style,
}: FormErrorCalloutProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={`fbu-form-error-callout ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
        padding: '8px 12px',
        backgroundColor: 'rgba(246, 70, 93, 0.08)',
        border: `1px solid rgba(246, 70, 93, 0.25)`,
        borderRadius: RADII.sm,
        color: PALETTE.accent3,
        fontSize: '0.8125rem',
        lineHeight: 1.4,
        fontFamily: TYPOGRAPHY.fontFamily,
        boxSizing: 'border-box',
        width: '100%',
        ...style,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span style={{ flex: 1 }}>{message}</span>
    </div>
  );
}
