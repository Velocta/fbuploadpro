import React, { forwardRef } from 'react';
import { RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode;
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`fbu-card ${className}`}
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: RADII.md, // 8px
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: TYPOGRAPHY.fontFamily,
        color: 'var(--text-main)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`fbu-card-header ${className}`}
      style={{
        padding: SPACING.lg, // 16px
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xs,
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
});
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <h3
      ref={ref}
      className={`fbu-card-title ${className}`}
      style={{
        margin: 0,
        fontSize: '1.125rem',
        fontWeight: TYPOGRAPHY.weights.semibold,
        lineHeight: 1.3,
        letterSpacing: TYPOGRAPHY.tracking.h3,
        color: 'var(--text-main)',
        ...style,
      }}
      {...props}
    >
      {children}
    </h3>
  );
});
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(function CardDescription(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <p
      ref={ref}
      className={`fbu-card-description ${className}`}
      style={{
        margin: 0,
        fontSize: '0.875rem',
        fontWeight: TYPOGRAPHY.weights.regular,
        lineHeight: 1.45,
        color: 'var(--text-sub)',
        ...style,
      }}
      {...props}
    >
      {children}
    </p>
  );
});
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(function CardContent(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`fbu-card-content ${className}`}
      style={{
        padding: SPACING.lg, // 16px
        flex: 1,
        boxSizing: 'border-box',
        color: 'var(--text-main)',
        fontSize: '0.875rem',
        lineHeight: 1.5,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
});
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter(
  { className = '', style, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`fbu-card-footer ${className}`}
      style={{
        padding: `${SPACING.md} ${SPACING.lg}`,
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: SPACING.sm,
        boxSizing: 'border-box',
        backgroundColor: 'var(--bg-canvas)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
});
CardFooter.displayName = 'CardFooter';
