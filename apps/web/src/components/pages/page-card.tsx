'use client';

import React from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { getInitials } from '@/components/accounts/account-card';

export type FacebookPageStatus =
  | 'active'
  | 'paused'
  | 'fb_rate_limited'
  | 'page_checkpoint'
  | 'invalid_token'
  | 'disconnected';

export interface FacebookPageItem {
  id: string;
  facebookAccountId: string;
  accountDisplayName?: string | undefined;
  fbPageId: string;
  pageName: string;
  profilePictureUrl?: string | null | undefined;
  category?: string | null | undefined;
  startingFollowers: number;
  currentFollowers: number;
  followersGained: number;
  status: FacebookPageStatus;
  tasks?: string[] | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface PageCardProps {
  page: FacebookPageItem;
  subdomain?: string | undefined;
  onSelectPage?: ((page: FacebookPageItem) => void) | undefined;
  forceAvatarError?: boolean | undefined;
}

export function isPageNeedsAttention(status: FacebookPageStatus): boolean {
  return (
    status === 'invalid_token' ||
    status === 'page_checkpoint' ||
    status === 'fb_rate_limited'
  );
}

export function getPageStatusLabel(status: FacebookPageStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'paused':
      return 'Paused';
    case 'invalid_token':
      return 'Token Expired';
    case 'page_checkpoint':
      return 'Identity Checkpoint';
    case 'fb_rate_limited':
      return 'Rate Limited';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Active';
  }
}

export function getPageAttentionMessage(
  status: FacebookPageStatus
): string | null {
  switch (status) {
    case 'invalid_token':
      return 'Token Expired — Reconnect the parent Facebook account to resume publishing.';
    case 'page_checkpoint':
      return 'Identity Checkpoint — Confirm page identity on Facebook mobile to resume.';
    case 'fb_rate_limited':
      return 'Rate Limited — Facebook temporarily restricted posting (auto-resumes after 3 days).';
    default:
      return null;
  }
}

export function computeFollowersGained(
  page: Pick<FacebookPageItem, 'currentFollowers' | 'startingFollowers'> & {
    followersGained?: number | undefined;
  }
): number {
  if (typeof page.followersGained === 'number') {
    return page.followersGained;
  }
  const current = page.currentFollowers ?? 0;
  const starting = page.startingFollowers ?? current;
  return current - starting;
}

export function formatFollowersGained(gained: number): string {
  if (gained > 0) {
    return `+${gained.toLocaleString('en-US')}`;
  }
  if (gained < 0) {
    return gained.toLocaleString('en-US');
  }
  return '0';
}

export function PageCard({
  page,
  subdomain,
  onSelectPage,
  forceAvatarError = false,
}: Readonly<PageCardProps>) {
  const [failedAvatarUrl, setFailedAvatarUrl] = React.useState<string | null>(
    forceAvatarError ? (page.profilePictureUrl ?? '__forced__') : null
  );

  const needsAttention = isPageNeedsAttention(page.status);
  const attentionMessage = getPageAttentionMessage(page.status);
  const statusLabel = getPageStatusLabel(page.status);

  const currentFollowers = page.currentFollowers ?? 0;
  const gained = computeFollowersGained(page);
  const formattedGained = formatFollowersGained(gained);

  let gainedColor = `var(--text-sub, ${THEME.default.text.secondary})`;
  if (gained > 0) {
    gainedColor = PALETTE.accent4;
  } else if (gained < 0) {
    gainedColor = PALETTE.accent3;
  }

  let statusColor: string = PALETTE.accent4;
  let statusDotType: 'operational' | 'queued' | 'critical' | 'idle' =
    'operational';
  if (needsAttention) {
    statusColor = PALETTE.accent3;
    statusDotType = 'critical';
  } else if (page.status === 'paused') {
    statusColor = PALETTE.primary;
    statusDotType = 'queued';
  } else if (page.status === 'disconnected') {
    statusColor = `var(--text-dim, ${THEME.default.text.muted})`;
    statusDotType = 'idle';
  }

  const initials = getInitials(page.pageName, 'PG');
  const showAvatarImg =
    Boolean(page.profilePictureUrl) &&
    !forceAvatarError &&
    failedAvatarUrl !== page.profilePictureUrl;

  const targetHref = subdomain
    ? `/tenant/${subdomain}/pages/${page.id}`
    : `/pages/${page.id}`;

  const handleActivate = () => {
    if (onSelectPage) {
      onSelectPage(page);
    } else if (typeof window !== 'undefined') {
      window.location.href = targetHref;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      data-testid={`page-card-${page.id}`}
      data-href={targetHref}
      aria-label={`Open ${page.pageName} page details`}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: needsAttention
          ? `1px solid ${PALETTE.accent3}`
          : `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        padding: SPACING.lg,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        outline: 'none',
      }}
    >
      {/* Page Identity Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          marginBottom: SPACING.md,
        }}
      >
        {showAvatarImg ? (
          <img
            src={page.profilePictureUrl!}
            alt={page.pageName}
            data-testid="page-avatar-img"
            onError={() =>
              setFailedAvatarUrl(page.profilePictureUrl ?? '__error__')
            }
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
            data-testid="page-avatar-initials"
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

        <div style={{ minWidth: 0, flex: 1 }}>
          <h3
            data-testid="page-name"
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
            {page.pageName}
          </h3>
          <span
            data-testid="page-category"
            style={{
              display: 'block',
              fontSize: '0.75rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {page.category || 'Facebook Page'}
          </span>
        </div>
      </div>

      {/* Followers Metrics Box */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: SPACING.md,
          padding: `${SPACING.sm} ${SPACING.md}`,
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.sm,
          marginBottom: SPACING.md,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              marginBottom: '2px',
            }}
          >
            Current followers
          </div>
          <div
            data-testid="page-current-followers"
            style={{
              fontSize: '0.9375rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {currentFollowers.toLocaleString('en-US')}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              marginBottom: '2px',
            }}
          >
            Followers gained
          </div>
          <div
            data-testid="page-followers-gained"
            style={{
              fontSize: '0.9375rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              fontVariantNumeric: TYPOGRAPHY.tabularNums,
              color: gainedColor,
            }}
          >
            {formattedGained}
          </div>
        </div>
      </div>

      {/* Rose Attention Standout Banner */}
      {needsAttention && attentionMessage && (
        <div
          data-testid="page-attention-banner"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: SPACING.xs,
            padding: '8px 10px',
            backgroundColor: 'rgba(246, 70, 93, 0.08)',
            border: '1px solid rgba(246, 70, 93, 0.28)',
            borderRadius: RADII.sm,
            fontSize: '0.75rem',
            lineHeight: 1.4,
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
            style={{ flexShrink: 0, marginTop: '1px' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{attentionMessage}</span>
        </div>
      )}

      {/* Footer: Parent Facebook Account & Unboxed Status Signal */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACING.sm,
          marginTop: 'auto',
          paddingTop: SPACING.xs,
          borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          fontSize: '0.75rem',
        }}
      >
        <span
          data-testid="page-parent-account"
          style={{
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Account: {page.accountDisplayName || 'Connected Account'}
        </span>

        <span
          data-testid="page-status"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: statusColor,
            fontWeight: TYPOGRAPHY.weights.semibold,
            flexShrink: 0,
          }}
        >
          <span style={COMPONENT_STYLES.statusDot(statusDotType)} />
          <span>{statusLabel}</span>
        </span>
      </div>
    </div>
  );
}
