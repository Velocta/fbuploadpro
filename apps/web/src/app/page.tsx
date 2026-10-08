import React from 'react';
import Link from 'next/link';
import { THEME, COMPONENT_STYLES } from '@/lib/theme';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: THEME.default.spacing.xl,
        backgroundColor: THEME.default.surfaces.canvas,
        color: THEME.default.text.primary,
        fontFamily: THEME.default.typography.fontFamily,
      }}
    >
      <div
        style={{
          ...COMPONENT_STYLES.card(THEME.default),
          padding: THEME.default.spacing.xl,
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: `0 0 ${THEME.default.spacing.sm} 0`,
            fontSize: '1.75rem',
            fontWeight: THEME.default.typography.weights.bold,
            letterSpacing: THEME.default.typography.tracking.h1,
          }}
        >
          FBUploadPro
        </h1>
        <p
          style={{
            margin: `0 0 ${THEME.default.spacing.xl} 0`,
            color: THEME.default.text.secondary,
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          High-throughput Facebook publishing automation platform.
        </p>

        <div style={{ display: 'flex', gap: THEME.default.spacing.md, justifyContent: 'center' }}>
          <Link
            href="/login"
            style={{
              ...COMPONENT_STYLES.primaryButton,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              flex: 1,
            }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            style={{
              ...COMPONENT_STYLES.secondaryButton(THEME.default),
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              flex: 1,
            }}
          >
            Create Account
          </Link>
        </div>
      </div>
    </main>
  );
}
