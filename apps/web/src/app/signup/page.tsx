import React from 'react';
import Link from 'next/link';
import { THEME, COMPONENT_STYLES } from '@/lib/theme';

export default function SignupPage() {
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
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <h2
          style={{
            margin: `0 0 ${THEME.default.spacing.xs} 0`,
            fontSize: '1.25rem',
            fontWeight: THEME.default.typography.weights.bold,
            letterSpacing: THEME.default.typography.tracking.h2,
          }}
        >
          Create Account
        </h2>
        <p
          style={{
            margin: `0 0 ${THEME.default.spacing.lg} 0`,
            color: THEME.default.text.secondary,
            fontSize: '0.875rem',
          }}
        >
          Get started with your FBUploadPro workspace.
        </p>

        <form style={{ display: 'flex', flexDirection: 'column', gap: THEME.default.spacing.md }}>
          <div>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: THEME.default.spacing.xs,
                fontSize: '0.75rem',
                fontWeight: THEME.default.typography.weights.semibold,
                color: THEME.default.text.secondary,
                letterSpacing: THEME.default.typography.tracking.caption,
                textTransform: 'uppercase',
              }}
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@domain.com"
              required
              style={{
                ...COMPONENT_STYLES.input(THEME.default),
                width: '100%',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: THEME.default.spacing.xs,
                fontSize: '0.75rem',
                fontWeight: THEME.default.typography.weights.semibold,
                color: THEME.default.text.secondary,
                letterSpacing: THEME.default.typography.tracking.caption,
                textTransform: 'uppercase',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              style={{
                ...COMPONENT_STYLES.input(THEME.default),
                width: '100%',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              ...COMPONENT_STYLES.primaryButton,
              width: '100%',
              marginTop: THEME.default.spacing.sm,
            }}
          >
            Create Account
          </button>
        </form>

        <div style={{ marginTop: THEME.default.spacing.lg, textAlign: 'center', fontSize: '0.8125rem' }}>
          <span style={{ color: THEME.default.text.muted }}>Already have an account? </span>
          <Link href="/login" style={{ color: THEME.default.text.link, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
