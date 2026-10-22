'use client';

import React from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
} from '@/lib/theme';
import { getUserInitials } from '@/lib/user-initials';

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
  timezone?: string | undefined;
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

export function getPageStatusColor(status: FacebookPageStatus): string {
  if (isPageNeedsAttention(status)) {
    return PALETTE.accent3;
  }
  if (status === 'paused') {
    return PALETTE.primary;
  }
  if (status === 'active') {
    return PALETTE.accent4;
  }
  return `var(--text-dim, ${THEME.default.text.muted})`;
}

export function getPageStatusRingBorder(status: FacebookPageStatus): string {
  if (isPageNeedsAttention(status)) {
    return `1.5px solid ${PALETTE.accent3}`;
  }
  if (status === 'paused') {
    return `1.5px solid ${PALETTE.primary}`;
  }
  if (status === 'active') {
    return `1.5px solid ${PALETTE.accent4}`;
  }
  return `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`;
}

/**
 * Short, human-comparable form of a page's Facebook Page ID.
 * Pages can share a display name (and even followers and category), so the
 * ID suffix is the distinguishing line that tells two same-named pages apart.
 */
export function formatPageIdSuffix(fbPageId: string): string {
  const trimmed = fbPageId.trim();
  if (!trimmed) return '';
  return trimmed.length <= 6 ? trimmed : `…${trimmed.slice(-6)}`;
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
  const statusColor = getPageStatusColor(page.status);
  const statusRingBorder = getPageStatusRingBorder(page.status);

  const currentFollowers = page.currentFollowers ?? 0;
  const gained = computeFollowersGained(page);
  const formattedGained = formatFollowersGained(gained);

  let gainedColor = `var(--text-sub, ${THEME.default.text.secondary})`;
  if (gained > 0) {
    gainedColor = PALETTE.accent4;
  } else if (gained < 0) {
    gainedColor = PALETTE.accent3;
  }

  const rawPageName = page.pageName.trim();
  const initials = rawPageName ? getUserInitials(rawPageName) : 'PG';
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
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = needsAttention
          ? PALETTE.accent3
          : 'rgba(46, 189, 133, 0.4)';
        e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(0, 0, 0, 0.35)';
        const arrow = e.currentTarget.querySelector(
          '.page-card-arrow'
        ) as HTMLElement | null;
        if (arrow) {
          arrow.style.color = `var(--text-main, ${THEME.default.text.primary})`;
          arrow.style.transform = 'translate(2px, -2px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = needsAttention
          ? PALETTE.accent3
          : `var(--border-subtle, ${THEME.default.borders.hairline})`;
        e.currentTarget.style.boxShadow = `var(--shadow-card, ${THEME.default.shadows.card})`;
        const arrow = e.currentTarget.querySelector(
          '.page-card-arrow'
        ) as HTMLElement | null;
        if (arrow) {
          arrow.style.color = `var(--text-dim, ${THEME.default.text.muted})`;
          arrow.style.transform = 'translate(0, 0)';
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: needsAttention
          ? `1px solid ${PALETTE.accent3}`
          : `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        padding: SPACING.lg,
        cursor: 'pointer',
        transition:
          'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        outline: 'none',
        minHeight: '154px',
      }}
    >
      {/* Top Section: Avatar with Dynamic Status Ring + Identity + Affordance */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.md,
            marginBottom: SPACING.md,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.md,
              minWidth: 0,
              flex: 1,
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
                  width: '42px',
                  height: '42px',
                  borderRadius: RADII.full,
                  objectFit: 'cover',
                  border: statusRingBorder,
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                data-testid="page-avatar-initials"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: RADII.full,
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  border: statusRingBorder,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: TYPOGRAPHY.weights.bold,
                  fontSize: '0.9375rem',
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
                  fontSize: '0.9375rem',
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
                data-testid="page-followers-line"
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
                <span
                  data-testid="page-current-followers"
                  style={{
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    fontVariantNumeric: TYPOGRAPHY.tabularNums,
                  }}
                >
                  {currentFollowers.toLocaleString('en-US')}
                </span>{' '}
                followers
                <span data-testid="page-category">
                  {' '}
                  · {page.category || 'Facebook Page'}
                </span>
              </span>
              {formatPageIdSuffix(page.fbPageId) && (
                <span
                  data-testid="page-id-line"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: `var(--text-dim, ${THEME.default.text.muted})`,
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Page ID {formatPageIdSuffix(page.fbPageId)}
                </span>
              )}
            </div>
          </div>

          <div
            aria-hidden="true"
            className="page-card-arrow"
            style={{
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              fontSize: '1rem',
              lineHeight: 1,
              transition: 'color 0.15s ease, transform 0.15s ease',
              flexShrink: 0,
            }}
          >
            ↗
          </div>
        </div>

        {/* Rose Attention Standout Banner (if needs attention) */}
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
              marginBottom: SPACING.sm,
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
      </div>

      {/* Symmetrical Two-Column Data Row (Precision Editorial) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: SPACING.md,
          marginTop: SPACING.md,
          paddingTop: SPACING.xs,
        }}
      >
        {/* Left Column: Followers Gain (rendered only when non-zero) */}
        <div style={{ minWidth: 0 }}>
          {gained !== 0 && (
            <div
              data-testid="page-followers-gained"
              style={{
                fontSize: '0.75rem',
                color: gainedColor,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
                marginTop: '2px',
              }}
            >
              {formattedGained}
            </div>
          )}
        </div>

        {/* Right Column: Pure Typographic Status (NO DOT) & Parent Account */}
        <div
          style={{
            textAlign: 'right',
            minWidth: 0,
            flexShrink: 0,
          }}
        >
          <div
            data-testid="page-status"
            style={{
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: statusColor,
              letterSpacing: '0.02em',
            }}
          >
            {statusLabel}
          </div>

          <div
            data-testid="page-parent-account"
            style={{
              fontSize: '0.75rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              marginTop: '2px',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Account: {page.accountDisplayName || 'Connected Account'}
          </div>
        </div>
      </div>
    </div>
  );
}
