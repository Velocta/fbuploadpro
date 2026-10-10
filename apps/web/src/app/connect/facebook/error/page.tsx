import React from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export default function FacebookConnectErrorPage() {
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
        data-testid="magic-connect-error"
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
            backgroundColor: 'rgba(246, 70, 93, 0.15)',
            border: '1px solid rgba(246, 70, 93, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: PALETTE.accent3,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>

        <h1
          style={{
            margin: '0 0 8px',
            fontSize: '1.25rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Connection Link Expired or Invalid
        </h1>

        <p
          style={{
            margin: '0 0 24px',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          This single-use Facebook authorization link has expired or is no longer valid. Please return to your main workspace to generate a fresh link.
        </p>
      </div>
    </main>
  );
}
