import React from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export default function FacebookConnectSuccessPage() {
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
        data-testid="magic-connect-success"
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
            backgroundColor: 'rgba(46, 189, 133, 0.15)',
            border: '1px solid rgba(46, 189, 133, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: PALETTE.accent4,
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
            <polyline points="20 6 9 17 4 12" />
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
          Facebook Account Connected Successfully
        </h1>

        <p
          style={{
            margin: '0 0 24px',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Your Facebook profile has been linked to your workspace. You can safely close this window and return to your main dashboard.
        </p>

        <div
          style={{
            padding: '10px 14px',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            borderRadius: RADII.sm,
            fontSize: '0.8125rem',
            color: `var(--text-dim, ${THEME.default.text.muted})`,
          }}
        >
          Authorization completed securely via FBUploadPro.
        </div>
      </div>
    </main>
  );
}
