'use client';

import React from 'react';
import { THEME, SPACING, RADII, TYPOGRAPHY } from '@/lib/theme';

export interface FdolaStudioWorkspaceProps {
  subdomain: string;
}

export function FdolaStudioWorkspace({ subdomain: _subdomain }: Readonly<FdolaStudioWorkspaceProps>) {
  return (
    <div
      data-slot="fdola-studio-workspace"
      data-testid="fdola-studio-workspace"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: `${SPACING.xl} ${SPACING.md}`,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          padding: `${SPACING.xxl} ${SPACING.xl}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: SPACING.xs,
          textAlign: 'center',
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            letterSpacing: TYPOGRAPHY.tracking.h1,
          }}
        >
          Fdola Studio
        </h1>
        <p
          data-testid="fdola-desktop-workspace-empty"
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Desktop Workspace
        </p>
      </div>
    </div>
  );
}
