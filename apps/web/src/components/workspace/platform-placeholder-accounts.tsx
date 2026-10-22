'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { THEME, SPACING, RADII, TYPOGRAPHY, PALETTE } from '@/lib/theme';
import { TESTING_PLACEHOLDER_TEXT } from './platform-nav-config';

export interface PlatformPlaceholderAccountsProps {
  platformName: string;
  subdomain: string;
  icon?: React.ReactNode;
  /** Overrides the default body copy (e.g. the platform's connect model). */
  description?: string;
  /** Optional connect area rendered above the return button (e.g. a gated connect action). */
  connectArea?: React.ReactNode;
}

export function PlatformPlaceholderAccounts({
  platformName,
  subdomain,
  icon,
  description,
  connectArea,
}: Readonly<PlatformPlaceholderAccountsProps>) {
  const router = useRouter();

  const handleReturnHome = () => {
    router.push(`/tenant/${subdomain}`);
  };

  return (
    <div
      data-slot="platform-placeholder-page"
      data-testid="platform-placeholder-accounts"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: SPACING.xl,
        textAlign: 'center',
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
        }}
      >
        {/* Brand Icon Container */}
        {icon && (
          <div
            data-slot="platform-icon-container"
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
            {icon}
          </div>
        )}

        {/* Header & Status Notice */}
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
            {platformName} Accounts
          </h1>
          <p
            data-testid="testing-placeholder-notice"
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              lineHeight: 1.4,
            }}
          >
            {TESTING_PLACEHOLDER_TEXT}
          </p>
        </div>

        {/* Informative Body Copy */}
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.5,
            maxWidth: '380px',
          }}
        >
          {description ??
            `${platformName} integration is currently undergoing testing and verification. Account connectivity and publishing tools for this channel will be enabled once public validation completes.`}
        </p>

        {/* Connect Area (e.g. point-of-need credentials gate) */}
        {connectArea}

        {/* Primary Action Button */}
        <div style={{ marginTop: SPACING.sm, width: '100%' }}>
          <button
            type="button"
            onClick={handleReturnHome}
            style={{
              width: '100%',
              padding: `${SPACING.sm} ${SPACING.lg}`,
              borderRadius: RADII.sm,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
              transition: 'background-color 150ms ease, border-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `var(--bg-active, ${THEME.default.surfaces.active})`;
            }}
          >
            Return to Overview
          </button>
        </div>
      </div>
    </div>
  );
}
