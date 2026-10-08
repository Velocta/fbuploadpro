import React, { forwardRef } from 'react';
import { PALETTE, RADII, TYPOGRAPHY } from '@/lib/theme';

export type TagVariant = 'default' | 'primary' | 'accent' | 'warning' | 'danger' | 'success';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
  children: React.ReactNode;
}

const variantStyles: Record<TagVariant, React.CSSProperties> = {
  default: {
    backgroundColor: 'var(--bg-subtle)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-sub)',
  },
  primary: {
    backgroundColor: 'rgba(250, 215, 52, 0.12)',
    border: '1px solid rgba(250, 215, 52, 0.35)',
    color: PALETTE.primary,
  },
  accent: {
    backgroundColor: 'rgba(250, 215, 52, 0.12)',
    border: '1px solid rgba(250, 215, 52, 0.35)',
    color: PALETTE.primary,
  },
  warning: {
    backgroundColor: 'rgba(178, 149, 39, 0.12)',
    border: '1px solid rgba(178, 149, 39, 0.35)',
    color: PALETTE.accent1,
  },
  danger: {
    backgroundColor: 'rgba(246, 70, 93, 0.10)',
    border: '1px solid rgba(246, 70, 93, 0.30)',
    color: PALETTE.accent3,
  },
  success: {
    backgroundColor: 'rgba(46, 189, 133, 0.10)',
    border: '1px solid rgba(46, 189, 133, 0.30)',
    color: PALETTE.accent4,
  },
};

export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { variant = 'default', children, className = '', style, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={`fbu-tag fbu-tag-${variant} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: RADII.xs, // Strict 4px rectilinear geometry. NEVER rounded pill!
        fontSize: '0.75rem',
        fontWeight: TYPOGRAPHY.weights.medium,
        fontFamily: TYPOGRAPHY.fontFamily,
        lineHeight: 1.25,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
});

Tag.displayName = 'Tag';
