'use client';

import React from 'react';
import { THEME, SPACING, RADII, TYPOGRAPHY, PALETTE } from '@/lib/theme';

export interface FdolaStudioGateProps {
  subdomain?: string;
}

export function FdolaStudioGate({ subdomain: _subdomain }: Readonly<FdolaStudioGateProps>) {
  return (
    <div
      data-slot="fdola-studio-gate"
      data-testid="fdola-studio-gate"
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
          gap: SPACING.lg,
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          textAlign: 'center',
        }}
      >
        {/* Studio Icon Container */}
        <div
          data-slot="studio-gate-icon"
          data-testid="studio-gate-icon"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: RADII.md,
            backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: PALETTE.primary,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
          </svg>
        </div>

        {/* Title & Desktop Only Notice */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
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
            data-testid="fdola-gate-message"
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              lineHeight: 1.5,
              maxWidth: '380px',
            }}
          >
            This feature is only available on desktop. Please download the desktop app.
          </p>
        </div>
      </div>
    </div>
  );
}
