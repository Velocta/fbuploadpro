import React from 'react';
import Link from 'next/link';
import { PALETTE, THEME, SPACING, RADII, TYPOGRAPHY, STATUS_SIGNALS } from '@web/lib/theme';

export default function ShowroomHome() {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: THEME.default.surfaces.canvas,
        color: THEME.default.text.primary,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        fontFamily: TYPOGRAPHY.fontFamily,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: THEME.default.surfaces.panel,
          border: `1px solid ${THEME.default.borders.hairline}`,
          borderRadius: RADII.md,
          padding: SPACING.xl,
          boxShadow: THEME.default.shadows.card,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: RADII.sm,
              backgroundColor: PALETTE.primary,
              color: PALETTE.background,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: TYPOGRAPHY.weights.heavy,
              fontSize: '0.875rem',
            }}
          >
            FB
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                margin: 0,
                letterSpacing: TYPOGRAPHY.tracking.h3,
              }}
            >
              FBUploadPro UI Showroom
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: RADII.full,
                  backgroundColor: STATUS_SIGNALS.operational.dot,
                  boxShadow: STATUS_SIGNALS.operational.halo,
                }}
              />
              <span style={{ fontSize: '0.6875rem', color: THEME.default.text.secondary }}>
                Isolated Component Harness
              </span>
            </div>
          </div>
        </div>

        <p
          style={{
            color: THEME.default.text.secondary,
            fontSize: '0.875rem',
            lineHeight: 1.5,
            margin: `0 0 ${SPACING.lg} 0`,
          }}
        >
          Dedicated interactive preview harness for evaluating UI components, responsive layout states, and theme token fidelity in isolation.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
          <Link
            href="/sidebar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${SPACING.md} ${SPACING.lg}`,
              backgroundColor: THEME.default.surfaces.subtle,
              border: `1px solid ${THEME.default.borders.hairline}`,
              borderRadius: RADII.sm,
              textDecoration: 'none',
              color: THEME.default.text.primary,
              transition: 'all 0.15s ease',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: PALETTE.primary,
                }}
              >
                Shared Sidebar Suite →
              </div>
              <div style={{ fontSize: '0.75rem', color: THEME.default.text.muted, marginTop: '2px' }}>
                Spec 014: Desktop rail collapse, mobile drawer, submenus, keyboard shortcut, and full theme alignment.
              </div>
            </div>
            <span
              style={{
                padding: '2px 8px',
                fontSize: '0.6875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                borderRadius: RADII.xs,
                backgroundColor: THEME.default.surfaces.hover,
                border: `1px solid ${THEME.default.borders.hairline}`,
                color: THEME.default.text.secondary,
              }}
            >
              Interactive
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
