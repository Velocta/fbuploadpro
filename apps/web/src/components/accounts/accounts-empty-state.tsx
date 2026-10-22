'use client';

import React from 'react';
import Link from 'next/link';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';

interface AccountsEmptyStateProps {
  onConnect: () => void;
  /** Disable the connect action (for example while credentials are checked). */
  isConnectDisabled?: boolean | undefined;
  /** The workspace's Facebook App ID and Secret are known to be missing. */
  credentialsMissing?: boolean | undefined;
  /** Where to add the missing App ID and Secret (Settings → Facebook). */
  settingsHref?: string | undefined;
}

export function AccountsEmptyState({
  onConnect,
  isConnectDisabled = false,
  credentialsMissing = false,
  settingsHref,
}: Readonly<AccountsEmptyStateProps>) {
  const isDisabled = isConnectDisabled || credentialsMissing;
  return (
    <div
      data-testid="accounts-empty-state"
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
      {/* Facebook Brand Monogram Icon */}
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
        FB
      </div>

      <h2
        style={{
          margin: `0 0 ${SPACING.xs} 0`,
          fontSize: '1.25rem',
          fontWeight: TYPOGRAPHY.weights.bold,
          color: `var(--text-main, ${THEME.default.text.primary})`,
        }}
      >
        Connect your first Facebook account
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
        Link your Facebook Account to import pages
      </p>

      <button
        type="button"
        data-testid="empty-connect-button"
        onClick={onConnect}
        disabled={isDisabled}
        aria-describedby={
          credentialsMissing ? 'empty-connect-disabled-reason' : undefined
        }
        style={{
          ...COMPONENT_STYLES.primaryButton,
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACING.xs,
          padding: `0 ${SPACING.lg}`,
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
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
        <span>Connect Facebook Account</span>
      </button>

      {credentialsMissing && (
        <p
          id="empty-connect-disabled-reason"
          data-testid="empty-connect-disabled-reason"
          style={{
            margin: `${SPACING.md} 0 0 0`,
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            maxWidth: '420px',
          }}
        >
          Add your Facebook App ID and App Secret first — connecting is
          paused until they are saved.{' '}
          {settingsHref && (
            <Link
              href={settingsHref}
              data-testid="empty-connect-settings-link"
              style={{
                color: PALETTE.primary,
                fontWeight: TYPOGRAPHY.weights.semibold,
                textDecoration: 'underline',
              }}
            >
              Add them in Settings
            </Link>
          )}
        </p>
      )}

      <p
        style={{
          margin: `${SPACING.md} 0 0 0`,
          fontSize: '0.75rem',
          lineHeight: 1.4,
          color: `var(--text-dim, ${THEME.default.text.muted})`,
          maxWidth: '420px',
        }}
      >
        We only request permissions to publish reels and manage your pages
      </p>
    </div>
  );
}
