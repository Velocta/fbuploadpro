'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export interface AccountCardProps {
  account: FacebookAccountItem;
  subdomain?: string | undefined;
  onReconnect?: ((account: FacebookAccountItem) => void) | undefined;
  onDisconnect?: ((account: FacebookAccountItem) => void) | undefined;
  onViewPages?: ((account: FacebookAccountItem) => void) | undefined;
  defaultPagesExpanded?: boolean | undefined;
  forceAvatarError?: boolean | undefined;
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

export function getAccountRingColor(
  status: FacebookAccountItem['status'],
  isExpiringSoon: boolean
): string {
  if (status === 'expired') return PALETTE.accent3; // #f6465d
  if (isExpiringSoon) return PALETTE.primary; // #fad734
  return PALETTE.accent4; // #2ebd85
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
  ringColor,
  onAvatarError,
}: Readonly<{
  profilePictureUrl?: string | null | undefined;
  displayName: string;
  showAvatarImg: boolean;
  initials: string;
  ringColor: string;
  onAvatarError: () => void;
}>) {
  if (showAvatarImg && profilePictureUrl) {
    return (
      <img
        src={profilePictureUrl}
        alt={displayName}
        data-testid="account-avatar-img"
        onError={onAvatarError}
        style={{
          width: '42px',
          height: '42px',
          borderRadius: RADII.full,
          objectFit: 'cover',
          border: `1.5px solid ${ringColor}`,
          boxShadow: `0 0 0 2px ${ringColor}22`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      data-testid="account-avatar-initials"
      style={{
        width: '42px',
        height: '42px',
        borderRadius: RADII.full,
        backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
        border: `1.5px solid ${ringColor}`,
        boxShadow: `0 0 0 2px ${ringColor}22`,
        color: `var(--text-main, ${THEME.default.text.primary})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: TYPOGRAPHY.weights.bold,
        fontSize: '0.875rem',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function AccountLinkedPagesAffordance({
  connectedPagesCount,
  pagesCountLabel,
  onNavigateToPages,
}: Readonly<{
  connectedPagesCount: number;
  pagesCountLabel: string;
  onNavigateToPages: () => void;
}>) {
  if (connectedPagesCount > 0) {
    return (
      <button
        type="button"
        data-testid="account-pages-toggle"
        onClick={onNavigateToPages}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          margin: 0,
          backgroundColor: 'transparent',
          border: '1px solid transparent',
          borderRadius: RADII.xs,
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          fontSize: '0.8125rem',
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `var(--bg-subtle, ${THEME.default.surfaces.subtle})`;
          e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
          e.currentTarget.style.borderColor = `var(--border-subtle, ${THEME.default.borders.hairline})`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = `var(--text-sub, ${THEME.default.text.secondary})`;
          e.currentTarget.style.borderColor = 'transparent';
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
          style={{ opacity: 0.7 }}
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
    );
  }

  return (
    <span
      data-testid="account-pages-count"
      style={{
        fontSize: '0.8125rem',
        color: `var(--text-dim, ${THEME.default.text.muted})`,
        padding: '4px 8px',
      }}
    >
      {pagesCountLabel}
    </span>
  );
}

export function AccountCard({
  account,
  subdomain,
  onReconnect,
  onDisconnect,
  onViewPages,
  defaultPagesExpanded = false,
  forceAvatarError = false,
}: Readonly<AccountCardProps>) {
  const router = useRouter();
  const params = useParams();
  const currentSubdomain = subdomain ?? ((params?.subdomain as string) || '');

  const isExpired = account.status === 'expired';
  const daysRemaining = account.tokenExpiresAt
    ? Math.ceil((new Date(account.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon =
    !isExpired &&
    daysRemaining !== null &&
    daysRemaining > 0 &&
    daysRemaining <= 7;

  const ringColor = getAccountRingColor(account.status, isExpiringSoon);

  const [failedAvatarUrl, setFailedAvatarUrl] = React.useState<string | null>(
    forceAvatarError ? (account.profilePictureUrl ?? '__forced__') : null
  );
  const [isPagesExpanded, setIsPagesExpanded] = React.useState(defaultPagesExpanded);

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(account.createdAt);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_e) {
      return 'recently';
    }
  }, [account.createdAt]);

  const initials = getInitials(account.displayName, 'FB');
  const showAvatarImg =
    Boolean(account.profilePictureUrl) &&
    !forceAvatarError &&
    failedAvatarUrl !== account.profilePictureUrl;

  const linkedPages = account.connectedPages ?? [];
  const pagesCountLabel = `${account.connectedPagesCount} ${
    account.connectedPagesCount === 1 ? 'page linked' : 'pages linked'
  }`;

  const handleNavigateToPages = () => {
    if (onViewPages) {
      onViewPages(account);
      return;
    }
    if (currentSubdomain) {
      router.push(`/tenant/${currentSubdomain}/pages?account=${encodeURIComponent(account.displayName)}`);
    } else {
      setIsPagesExpanded((prev) => !prev);
    }
  };

  return (
    <div
      data-testid={`account-card-${account.id}`}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = isExpired
          ? PALETTE.accent3
          : 'rgba(46, 189, 133, 0.45)';
        e.currentTarget.style.boxShadow = isExpired
          ? '0 8px 24px -4px rgba(246, 70, 93, 0.25), 0 0 0 1px rgba(246, 70, 93, 0.2)'
          : '0 8px 24px -4px rgba(0, 0, 0, 0.35)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = isExpired
          ? PALETTE.accent3
          : `var(--border-subtle, ${THEME.default.borders.hairline})`;
        e.currentTarget.style.boxShadow = `var(--shadow-card, ${THEME.default.shadows.card})`;
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: isExpired
          ? `1px solid ${PALETTE.accent3}`
          : `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        padding: SPACING.lg,
        minHeight: '154px',
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
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
        <AccountAvatar
          profilePictureUrl={account.profilePictureUrl}
          displayName={account.displayName}
          showAvatarImg={showAvatarImg}
          initials={initials}
          ringColor={ringColor}
          onAvatarError={() => setFailedAvatarUrl(account.profilePictureUrl ?? '__error__')}
        />

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
                fontSize: '0.9375rem',
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
                  width="13"
                  height="13"
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

      {/* Blended Linked Pages Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: SPACING.md,
        }}
      >
        <AccountLinkedPagesAffordance
          connectedPagesCount={account.connectedPagesCount}
          pagesCountLabel={pagesCountLabel}
          onNavigateToPages={handleNavigateToPages}
        />
      </div>

      {/* Backward-compatible linked pages list when explicitly expanded in tests/props */}
      {isPagesExpanded && linkedPages.length > 0 && (
        <AccountLinkedPagesList pages={linkedPages} />
      )}

      {/* Session Expired Alert (Only rendered when expired, zero token validity days) */}
      {isExpired && (
        <div
          data-testid="account-expired-alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.xs,
            padding: '6px 10px',
            backgroundColor: 'rgba(246, 70, 93, 0.08)',
            border: '1px solid rgba(246, 70, 93, 0.2)',
            borderRadius: RADII.sm,
            fontSize: '0.75rem',
            color: PALETTE.accent3,
            fontWeight: TYPOGRAPHY.weights.medium,
            marginBottom: SPACING.md,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: RADII.full,
              backgroundColor: PALETTE.accent3,
              display: 'inline-block',
            }}
          />
          <span>Session expired — reconnect to resume publishing</span>
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
        {isExpired || isExpiringSoon ? (
          <button
            type="button"
            data-testid="account-reconnect-button"
            onClick={() => onReconnect?.(account)}
            style={{
              height: '30px',
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
            height: '30px',
            padding: `0 ${SPACING.sm}`,
            backgroundColor: 'transparent',
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            border: '1px solid transparent',
            borderRadius: RADII.sm,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = PALETTE.accent3;
            e.currentTarget.style.borderColor = 'rgba(246, 70, 93, 0.25)';
            e.currentTarget.style.backgroundColor = 'rgba(246, 70, 93, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = `var(--text-dim, ${THEME.default.text.muted})`;
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
