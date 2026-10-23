'use client';

import React from 'react';
import { THEME, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';

export interface PlatformConnectInfoConfig {
  /** Platform slug, e.g. "youtube". */
  platform: string;
  /** Platform name shown to the user, e.g. "YouTube". */
  displayName: string;
  /** Prefix for data-testid values, e.g. "youtube". */
  testIdPrefix: string;
  /** Plain-language paragraphs explaining how connecting works. */
  paragraphs: readonly string[];
}

export interface PlatformConnectInfoViewProps {
  subdomain: string;
  config: PlatformConnectInfoConfig;
}

/**
 * Settings tab for a platform with nothing to set up here: it explains, in
 * plain language, how connecting works and sends the user to Accounts,
 * where the Connect action lives. It never renders a form or an input.
 */
export function PlatformConnectInfoView({
  subdomain,
  config,
}: Readonly<PlatformConnectInfoViewProps>) {
  const { displayName, testIdPrefix, paragraphs } = config;
  const accountsHref = `/tenant/${subdomain}/accounts`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xl,
        maxWidth: '780px',
        width: '100%',
      }}
    >
      <div
        data-testid={`${testIdPrefix}-connect-info-card`}
        style={{
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          padding: SPACING.xl,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.lg,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              letterSpacing: TYPOGRAPHY.tracking.h3,
            }}
          >
            {`Connect ${displayName}`}
          </h3>
          {paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              style={{
                margin: `${SPACING.sm} 0 0 0`,
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                lineHeight: 1.5,
              }}
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div>
          <a
            href={accountsHref}
            data-testid={`${testIdPrefix}-accounts-link`}
            style={{
              ...COMPONENT_STYLES.secondaryButton(),
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            Go to Accounts
          </a>
        </div>
      </div>
    </div>
  );
}
