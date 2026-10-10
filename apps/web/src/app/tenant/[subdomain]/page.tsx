import React from 'react';
import { THEME, SPACING, RADII, TYPOGRAPHY } from '@/lib/theme';

interface TenantIndexPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function TenantIndexPage({ params }: Readonly<TenantIndexPageProps>) {
  const { subdomain } = await params;

  return (
    <div
      style={{
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
        padding: SPACING.xl,
      }}
    >
      <div
        style={{
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          padding: SPACING.xl,
        }}
      >
        <h1
          style={{
            margin: `0 0 ${SPACING.xs} 0`,
            fontSize: '1.5rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            letterSpacing: TYPOGRAPHY.tracking.h1,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Workspace: {subdomain}
        </h1>
        <p
          style={{
            margin: 0,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontSize: '0.875rem',
          }}
        >
          Welcome to your FBUploadPro workspace.
        </p>
      </div>
    </div>
  );
}
