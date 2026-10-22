'use client';

import React from 'react';
import Link from 'next/link';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';

export interface PagesEmptyStateProps {
  onAddPage: () => void;
  /** Workspace subdomain, used for the Settings → Facebook link. */
  subdomain?: string | undefined;
  /**
   * Whether the workspace's Facebook App ID and Secret are configured.
   * `false` = known missing (show guidance); `undefined` = not checked yet.
   */
  facebookAppConfigured?: boolean | undefined;
}

export function PagesEmptyState({
  onAddPage,
  subdomain,
  facebookAppConfigured,
}: Readonly<PagesEmptyStateProps>) {
  const showMissingAppGuidance =
    facebookAppConfigured === false && Boolean(subdomain);
  return (
    <div
      data-testid="pages-empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '64px 24px',
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        maxWidth: '560px',
        margin: '40px auto',
      }}
    >
      {/* Pages Icon Emblem */}
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: RADII.full,
          backgroundColor: PALETTE.primary,
          color: PALETTE.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: TYPOGRAPHY.weights.bold,
          fontSize: '1.25rem',
          marginBottom: SPACING.md,
          userSelect: 'none',
        }}
      >
        PG
      </div>

      <h2
        style={{
          margin: `0 0 ${SPACING.xs} 0`,
          fontSize: '1.25rem',
          fontWeight: TYPOGRAPHY.weights.bold,
          color: `var(--text-main, ${THEME.default.text.primary})`,
        }}
      >
        No Facebook Pages added yet
      </h2>

      <p
        style={{
          margin: `0 0 ${SPACING.xl} 0`,
          fontSize: '0.875rem',
          lineHeight: 1.5,
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          maxWidth: '420px',
        }}
      >
        Choose one of your connected Facebook accounts and select the pages you
        want to manage and publish reels to.
      </p>

      {showMissingAppGuidance && (
        <div
          data-testid="pages-empty-facebook-app-guidance"
          style={{
            margin: `0 0 ${SPACING.xl} 0`,
            padding: '10px 12px',
            backgroundColor: 'rgba(250, 215, 52, 0.08)',
            border: '1px solid rgba(250, 215, 52, 0.25)',
            borderRadius: RADII.sm,
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            maxWidth: '420px',
          }}
        >
          <p style={{ margin: `0 0 ${SPACING.xs} 0` }}>
            No account connected yet? First add your Facebook App ID and App
            Secret in Workspace Settings, under Facebook. Then connect your
            account and add its pages here.
          </p>
          <Link
            href={`/tenant/${subdomain}/settings?tab=byoc`}
            data-testid="pages-empty-settings-facebook-link"
            style={{
              color: PALETTE.primary,
              fontWeight: TYPOGRAPHY.weights.semibold,
              textDecoration: 'underline',
            }}
          >
            Add App ID and Secret in Settings
          </Link>
        </div>
      )}

      <button
        type="button"
        data-testid="empty-state-add-page-btn"
        onClick={onAddPage}
        style={{
          ...COMPONENT_STYLES.primaryButton,
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACING.xs,
          padding: `0 ${SPACING.lg}`,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Add Page</span>
      </button>
    </div>
  );
}
