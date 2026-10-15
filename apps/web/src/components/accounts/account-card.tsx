'use client';

import React from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export interface FacebookAccountLinkedPageItem {
  id: string;
  pageName: string;
  profilePictureUrl?: string | null | undefined;
}

export interface FacebookAccountItem {
  id: string;
  fbAccountId: string;
  displayName: string;
  profilePictureUrl?: string | null | undefined;
  gender?: string | null | undefined;
  accountLink?: string | null | undefined;
  status: 'active' | 'disconnected' | 'expired';
  tokenExpiresAt?: string | null | undefined;
  connectedPagesCount: number;
  connectedPages?: FacebookAccountLinkedPageItem[] | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

interface AccountCardProps {
  account: FacebookAccountItem;
  onReconnect?: (account: FacebookAccountItem) => void;
  onDisconnect?: (account: FacebookAccountItem) => void;
  defaultPagesExpanded?: boolean;
  forceAvatarError?: boolean;
}

export function getInitials(name: string, fallback = 'FB'): string {
  return (name || fallback)
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function LinkedPageRow({ page }: Readonly<{ page: FacebookAccountLinkedPageItem }>) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const showImg = Boolean(page.profilePictureUrl) && failedUrl !== page.profilePictureUrl;
  const pageInitials = getInitials(page.pageName, 'PG');

  return (
    <div
      data-testid={`account-linked-page-${page.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
        padding: '4px 0',
        fontSize: '0.8125rem',
        color: `var(--text-main, ${THEME.default.text.primary})`,
      }}
    >
      {showImg ? (
        <img
          src={page.profilePictureUrl!}
          alt={page.pageName}
          onError={() => setFailedUrl(page.profilePictureUrl ?? '__error__')}
          style={{
            width: '22px',
            height: '22px',
            borderRadius: RADII.full,
            objectFit: 'cover',
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: '22px',
            height: '22px',
            borderRadius: RADII.full,
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.625rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            flexShrink: 0,
          }}
        >
          {pageInitials}
        </div>
      )}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {page.pageName}
      </span>
    </div>
  );
}

export function AccountLinkedPagesList({
  pages,
}: Readonly<{ pages: FacebookAccountLinkedPageItem[] }>) {
  return (
    <div
      data-testid="account-linked-pages-list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: `${SPACING.xs} ${SPACING.sm}`,
        marginBottom: SPACING.md,
        backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.sm,
      }}
    >
      {pages.map((page) => (
        <LinkedPageRow key={page.id} page={page} />
      ))}
    </div>
  );
}

function AccountAvatar({
  profilePictureUrl,
  displayName,
  showAvatarImg,
  initials,
  onAvatarError,
}: {
  profilePictureUrl: string | null;
  displayName: string;
  showAvatarImg: boolean;
  initials: string;
  onAvatarError: () => void;
}) {
  if (showAvatarImg && profilePictureUrl) {
    return (
      <img
        src={profilePictureUrl}
        alt={displayName}
        data-testid="account-avatar-img"
        onError={onAvatarError}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: RADII.full,
          objectFit: 'cover',
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
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
  );
}

function AccountStatusAlerts({
  isExpired,
  isExpiringSoon,
  daysRemaining,
}: {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number | null;
}) {
  if (isExpired) {
    return (
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
        <span>Session expired — reconnect to resume publishing</span>
      </div>
    );
  }

  if (isExpiringSoon) {
    return (
      <div
        data-testid="account-expiring-soon-alert"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.xs,
          padding: '8px 10px',
          backgroundColor: 'rgba(250, 215, 52, 0.10)',
          border: '1px solid rgba(250, 215, 52, 0.25)',
          borderRadius: RADII.sm,
          fontSize: '0.75rem',
          color: PALETTE.primary,
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
        <span>Access token expires in {daysRemaining} day{daysRemaining === 1 ? '' : 's'} — reconnect soon</span>
      </div>
    );
  }

  return null;
}

export function AccountCard({
  account,
  onReconnect,
  onDisconnect,
  defaultPagesExpanded = false,
  forceAvatarError = false,
}: Readonly<AccountCardProps>) {
  const isExpired = account.status === 'expired';
  const daysRemaining = account.tokenExpiresAt
    ? Math.ceil((new Date(account.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon =
    !isExpired &&
    daysRemaining !== null &&
    daysRemaining > 0 &&
    daysRemaining <= 7;
  const [failedAvatarUrl, setFailedAvatarUrl] = React.useState<string | null>(
    forceAvatarError ? (account.profilePictureUrl ?? '__forced__') : null
  );
  const [isPagesExpanded, setIsPagesExpanded] = React.useState(defaultPagesExpanded);

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
      return 'recently';
    }
  }, [account.createdAt]);

  const initials = getInitials(account.displayName, 'FB');

  const formattedGender = account.gender
    ? account.gender.charAt(0).toUpperCase() + account.gender.slice(1)
    : null;

  const showAvatarImg =
    Boolean(account.profilePictureUrl) &&
    !forceAvatarError &&
    failedAvatarUrl !== account.profilePictureUrl;

  const linkedPages = account.connectedPages ?? [];
  const pagesCountLabel = `${account.connectedPagesCount} ${
    account.connectedPagesCount === 1 ? 'page linked' : 'pages linked'
  }`;

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
        <AccountAvatar
          profilePictureUrl={account.profilePictureUrl}
          displayName={account.displayName}
          showAvatarImg={showAvatarImg}
          initials={initials}
          onAvatarError={() => setFailedAvatarUrl(account.profilePictureUrl ?? '__error__')}
        />

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
        {account.connectedPagesCount > 0 ? (
          <button
            type="button"
            data-testid="account-pages-toggle"
            aria-expanded={isPagesExpanded}
            onClick={() => setIsPagesExpanded((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
              padding: 0,
              background: 'none',
              border: 'none',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span data-testid="account-pages-count">{pagesCountLabel}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{
                transform: isPagesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        ) : (
          <span data-testid="account-pages-count">{pagesCountLabel}</span>
        )}

        {formattedGender && (
          <>
            <span style={{ color: `var(--border-subtle, ${THEME.default.borders.hairline})` }}>•</span>
            <span data-testid="account-gender">{formattedGender}</span>
          </>
        )}
      </div>

      {/* Expandable Linked Pages List */}
      {isPagesExpanded && linkedPages.length > 0 && (
        <AccountLinkedPagesList pages={linkedPages} />
      )}

      {/* Status Alerts */}
      <AccountStatusAlerts
        isExpired={isExpired}
        isExpiringSoon={isExpiringSoon}
        daysRemaining={daysRemaining}
      />

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
        {isExpired || isExpiringSoon ? (
          <button
            type="button"
            data-testid="account-reconnect-button"
            onClick={() => onReconnect?.(account)}
            style={{
              height: '32px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: isExpired ? PALETTE.primary : 'transparent',
              color: isExpired ? PALETTE.background : `var(--text-main, ${THEME.default.text.primary})`,
              border: isExpired ? 'none' : `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              fontWeight: TYPOGRAPHY.weights.semibold,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
            }}
          >
            <span>{isExpired ? 'Reconnect account' : 'Refresh token'}</span>
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
