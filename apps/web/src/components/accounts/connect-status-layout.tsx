import React from 'react';
import { THEME, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

interface ConnectStatusLayoutProps {
  testId: string;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function ConnectStatusLayout({
  testId,
  iconBg,
  iconBorder,
  iconColor,
  icon,
  title,
  description,
  children,
}: Readonly<ConnectStatusLayoutProps>) {
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100svh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
        padding: SPACING.md,
      }}
    >
      <div
        data-testid={testId}
        style={{
          maxWidth: '440px',
          width: '100%',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          padding: SPACING.xl,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 16px',
            borderRadius: RADII.full,
            backgroundColor: iconBg,
            border: `1px solid ${iconBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
          }}
        >
          {icon}
        </div>

        <h1
          style={{
            margin: '0 0 8px',
            fontSize: '1.25rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            margin: '0 0 24px',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          {description}
        </p>

        {children}
      </div>
    </main>
  );
}
