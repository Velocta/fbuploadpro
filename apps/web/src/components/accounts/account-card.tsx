'use client';

import React from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface FacebookAccountItem {
  id: string;
  fbAccountId: string;
  displayName: string;
  profilePictureUrl?: string | null;
  gender?: string | null;
  accountLink?: string | null;
  status: 'active' | 'disconnected' | 'expired';
  tokenExpiresAt?: string | null;
  connectedPagesCount: number;
  createdAt: string;
  updatedAt?: string;
}

interface AccountCardProps {
  account: FacebookAccountItem;
  onReconnect?: (account: FacebookAccountItem) => void;
  onDisconnect?: (account: FacebookAccountItem) => void;
}

export function AccountCard({
  account,
  onReconnect,
  onDisconnect,
}: Readonly<AccountCardProps>) {
  const isExpired = account.status === 'expired';

  // Format connection date
  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(account.createdAt);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_e) {
      // Ignored because invalid dates safely fallback to recent
      return 'Recent';
    }
  }, [account.createdAt]);

  const initials = (account.displayName || 'FB')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const formattedGender = account.gender
    ? account.gender.charAt(0).toUpperCase() + account.gender.slice(1)
    : null;

  return (
    <div
      data-testid={`account-card-${account.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        padding: SPACING.lg,
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Profile Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          marginBottom: SPACING.md,
        }}
      >
        {/* Avatar */}
        {account.profilePictureUrl ? (
          <img
            src={account.profilePictureUrl}
            alt={account.displayName}
            data-testid="account-avatar-img"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: RADII.full,
              objectFit: 'cover',
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            data-testid="account-avatar-initials"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: RADII.full,
              backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: TYPOGRAPHY.weights.bold,
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        )}

        {/* Identity & Link */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.xs,
              overflow: 'hidden',
            }}
          >
            <h3
              data-testid="account-name"
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {account.displayName}
            </h3>

            {account.accountLink && (
              <a
                href={account.accountLink}
                target="_blank"
                rel="noopener noreferrer"
                title="View Facebook Profile"
                aria-label={`View ${account.displayName}'s Facebook Profile`}
                data-testid="account-profile-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
          </div>

          <span
            data-testid="account-connected-date"
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            Connected {formattedDate}
          </span>
        </div>
      </div>

      {/* Account Metadata Stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          padding: `${SPACING.sm} 0`,
          borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          fontSize: '0.8125rem',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          marginBottom: SPACING.md,
        }}
      >
        <span data-testid="account-pages-count">
          {account.connectedPagesCount}{' '}
          {account.connectedPagesCount === 1 ? 'connected page' : 'connected pages'}
        </span>

        {formattedGender && (
          <>
            <span style={{ color: `var(--border-subtle, ${THEME.default.borders.hairline})` }}>•</span>
            <span data-testid="account-gender">{formattedGender}</span>
          </>
        )}
      </div>

      {/* Re-authentication Warning (Strictly when expired) */}
      {isExpired && (
        <div
          data-testid="account-expired-alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.xs,
            padding: '8px 10px',
            backgroundColor: 'rgba(246, 70, 93, 0.10)',
            border: '1px solid rgba(246, 70, 93, 0.25)',
            borderRadius: RADII.sm,
            fontSize: '0.75rem',
            color: PALETTE.accent3,
            fontWeight: TYPOGRAPHY.weights.medium,
            marginBottom: SPACING.md,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Re-authentication required</span>
        </div>
      )}

      {/* Card Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACING.sm,
          marginTop: 'auto',
        }}
      >
        {isExpired ? (
          <button
            type="button"
            data-testid="account-reconnect-button"
            onClick={() => onReconnect?.(account)}
            style={{
              height: '32px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: PALETTE.primary,
              color: PALETTE.background,
              border: 'none',
              borderRadius: RADII.sm,
              fontWeight: TYPOGRAPHY.weights.semibold,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <span>Reconnect</span>
          </button>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        <button
          type="button"
          data-testid="account-disconnect-button"
          onClick={() => onDisconnect?.(account)}
          style={{
            height: '32px',
            padding: `0 ${SPACING.sm}`,
            backgroundColor: 'transparent',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.sm,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            cursor: 'pointer',
            transition: 'color 0.15s ease, border-color 0.15s ease',
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
