import React from 'react';
import { THEME, COMPONENT_STYLES, STATUS_SIGNALS } from '@/lib/theme';

export default function AccountSuspendedPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: THEME.default.spacing.lg,
        backgroundColor: THEME.default.surfaces.canvas,
        color: THEME.default.text.primary,
        fontFamily: THEME.default.typography.fontFamily,
      }}
    >
      <div
        style={{
          ...COMPONENT_STYLES.card(THEME.default),
          padding: THEME.default.spacing.xl,
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: THEME.default.spacing.sm, marginBottom: THEME.default.spacing.md }}>
          <span style={COMPONENT_STYLES.statusDot('critical')} />
          <span style={{ fontSize: '0.875rem', fontWeight: THEME.default.typography.weights.semibold, color: STATUS_SIGNALS.critical.color }}>
            Account Suspended
          </span>
        </div>
        <h2
          style={{
            margin: `0 0 ${THEME.default.spacing.sm} 0`,
            fontSize: '1.25rem',
            fontWeight: THEME.default.typography.weights.bold,
            letterSpacing: THEME.default.typography.tracking.h2,
          }}
        >
          Access Restricted
        </h2>
        <p
          style={{
            margin: `0 0 ${THEME.default.spacing.lg} 0`,
            color: THEME.default.text.secondary,
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          Your account has been suspended. Please contact platform administration to restore access.
        </p>
      </div>
    </main>
  );
}
