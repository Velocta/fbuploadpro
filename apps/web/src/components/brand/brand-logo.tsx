'use client';

import React from 'react';
import { PALETTE, TYPOGRAPHY, SPACING } from '@/lib/theme';

export interface BrandMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * Official FBUploadPro Brand Mark.
 * Implements the 4-path geometric anatomy:
 * 1. Primary Gold Upload Arrow & "F" Crown/Spine (#fad734)
 * 2. Pure White Specular Edge Highlight (#ffffff @ 0.35 opacity per DESIGN.md Section 7.1)
 * 3. Peru Accent Middle Crossbar & Active Stream Wing (#b29527)
 * 4. Bronze Accent Recurring Queue Slot Anchor (#766018)
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 32,
  className,
  style,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="FBUploadPro"
      className={className}
      style={{ flexShrink: 0, display: 'inline-block', ...style }}
      {...props}
    >
      {/* PRIMARY GOLD (--color-primary: #fad734): Unified Ascending Upload Arrow + "F" Crown & Spine */}
      <path
        d="M24 11L12 23L17 28L20 25V51L28 45V23H45L53 15H28L24 11Z"
        fill={PALETTE.primary}
      />

      {/* PURE WHITE SPECULAR EDGE (--color-text: #ffffff @ 0.35 opacity per DESIGN.md Section 7.1) */}
      <path
        d="M24 11L12 23L13.2 24.2L24 13.4L28 17.4H50.6L53 15H28L24 11Z"
        fill={PALETTE.text}
        fillOpacity={0.35}
      />

      {/* PERU ACCENT 1 (--color-accent-1: #b29527): Middle "F" Crossbar & Active Stream Wing */}
      <path
        d="M32 30H48L40 38H32V30Z"
        fill={PALETTE.accent1}
      />

      {/* BRONZE ACCENT 2 (--color-accent-2: #766018): Recurring Queue Slot Anchor */}
      <path
        d="M32 43H41L35 49H32V43Z"
        fill={PALETTE.accent2}
      />
    </svg>
  );
};

export interface BrandLogoProps {
  markSize?: number;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Composite Brand Logo pairing BrandMark with the canonical logotype and optional subtitle.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  markSize = 32,
  showWordmark = true,
  subtitle,
  className,
  style,
}) => {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACING.sm,
        textDecoration: 'none',
        ...style,
      }}
    >
      <BrandMark size={markSize} />
      {showWordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span
            style={{
              fontSize: '0.9375rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              color: 'var(--text-main, #ffffff)',
              letterSpacing: TYPOGRAPHY.tracking.caption,
              lineHeight: 1.2,
            }}
          >
            FBUploadPro
          </span>
          {subtitle && (
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-dim, #6b7280)',
                lineHeight: 1.2,
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
