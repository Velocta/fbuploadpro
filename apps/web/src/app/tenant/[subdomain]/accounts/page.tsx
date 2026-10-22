'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import {
  getAccountHealth,
  type AccountHealth,
} from '@/components/accounts/account-health';
import { AccountCard, type FacebookAccountItem } from '@/components/accounts/account-card';
import { AccountsEmptyState } from '@/components/accounts/accounts-empty-state';
import { ConnectAccountModal } from '@/components/accounts/connect-account-modal';
import { SocialAccountsList } from '@/components/accounts/social-accounts-list';
import { DisconnectAccountDialog } from '@/components/accounts/disconnect-account-dialog';
import {
  MODAL_BACKDROP_STYLE,
  MODAL_CONTAINER_STYLE,
} from '@/components/pages/dedicated/modal-styles';

type AccountStatusFilter = 'all' | 'active' | 'expiring_soon' | 'expired';

export function sortAccountsExpiredFirst(items: FacebookAccountItem[]): FacebookAccountItem[] {
  return [...items].sort((a, b) => {
    const aExpired = a.status === 'expired' ? 1 : 0;
    const bExpired = b.status === 'expired' ? 1 : 0;
    if (aExpired !== bExpired) {
      return bExpired - aExpired;
    }
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    return bTime - aTime;
  });
}

export function filterAccountsList(
  items: FacebookAccountItem[],
  searchQuery: string,
  statusFilter: AccountStatusFilter
): FacebookAccountItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return items.filter((account) => {
    const matchesSearch =
      normalizedQuery.length === 0 ||
      account.displayName.toLowerCase().includes(normalizedQuery);

    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = account.status === 'active';
    } else if (statusFilter === 'expired') {
      matchesStatus = account.status === 'expired';
    } else if (statusFilter === 'expiring_soon') {
      if (account.status === 'expired' || !account.tokenExpiresAt) {
        matchesStatus = false;
      } else {
        const days = Math.ceil(
          (new Date(account.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        matchesStatus = days > 0 && days <= 7;
      }
    }

    return matchesSearch && matchesStatus;
  });
}

/**
 * Accounts tab subtitle derived from the single account-health model
 * (Spec 102: `getAccountHealth`). Never a blanket "All operational" —
 * the subtitle reflects the real per-account state.
 */
export function computeAccountsSubtitle(
  accounts: FacebookAccountItem[],
  filteredCount: number,
  isFiltered: boolean
): string {
  const totalCount = accounts.length;
  if (totalCount === 0) {
    return 'Connect your first Facebook account to manage pages and publish reels.';
  }
  if (isFiltered) {
    return `Showing ${filteredCount} of ${totalCount} ${
      totalCount === 1 ? 'account' : 'accounts'
    }`;
  }
  const healthCounts: Record<AccountHealth, number> = {
    connected: 0,
    expired: 0,
    error: 0,
  };
  for (const account of accounts) {
    healthCounts[getAccountHealth(account)] += 1;
  }
  const parts: string[] = [`${healthCounts.connected} connected`];
  if (healthCounts.expired > 0) {
    parts.push(
      `${healthCounts.expired} ${
        healthCounts.expired === 1 ? 'session expired' : 'sessions expired'
      }`
    );
  }
  if (healthCounts.error > 0) {
    parts.push(
      `${healthCounts.error} ${
        healthCounts.error === 1 ? 'connection error' : 'connection errors'
      }`
    );
  }
  return parts.join(' · ');
}

/**
 * Connect is gated only when the Facebook App ID and Secret are known to be
 * missing — not while the check is running, and not when the check failed
 * (the retry banner covers that case instead).
 */
export function isConnectGatedByMissingCredentials(status: {
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
}): boolean {
  return !status.isLoading && !status.isConfigured && !status.error;
}

export interface AccountsFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: AccountStatusFilter;
  onStatusFilterChange: (value: AccountStatusFilter) => void;
  attentionCount?: number | undefined;
}

const FILTER_TABS: Array<{ value: AccountStatusFilter; label: string; testId: string }> = [
  { value: 'all', label: 'All', testId: 'accounts-filter-all' },
  { value: 'active', label: 'Active', testId: 'accounts-filter-active' },
  { value: 'expired', label: 'Expired', testId: 'accounts-filter-expired' },
];

export function AccountsFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  attentionCount = 0,
}: Readonly<AccountsFilterBarProps>) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  return (
    <div
      data-testid="accounts-filter-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        paddingBottom: SPACING.md,
        marginBottom: SPACING.xl,
        borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        flexWrap: 'wrap',
      }}
    >
      {/* Ghost Search Input with Inset Icon & Clear Affordance */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          minWidth: '220px',
          flex: '1 1 240px',
          maxWidth: '320px',
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
          style={{
            position: 'absolute',
            left: '10px',
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            pointerEvents: 'none',
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="search"
          data-testid="accounts-search-input"
          placeholder="Search accounts..."
          aria-label="Search accounts"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onSearchChange('');
            }
          }}
          style={{
            width: '100%',
            height: '32px',
            paddingLeft: '32px',
            paddingRight: searchQuery ? '28px' : '10px',
            backgroundColor: 'transparent',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            border: isSearchFocused
              ? `1px solid ${PALETTE.primary}`
              : `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.sm,
            fontSize: '0.8125rem',
            outline: 'none',
            boxShadow: isSearchFocused ? '0 0 0 2px rgba(250, 215, 52, 0.15)' : 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />

        {searchQuery && (
          <button
            type="button"
            aria-label="Clear search query"
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: '8px',
              background: 'none',
              border: 'none',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
              padding: '2px',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Pure Typographic Flat Filter Tabs */}
      <div
        role="tablist"
        aria-label="Filter accounts by status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
        }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = statusFilter === tab.value;
          const isAttention = tab.value === 'expired';
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              data-testid={tab.testId}
              aria-selected={isActive}
              onClick={() => onStatusFilterChange(tab.value)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive
                  ? `2px solid ${PALETTE.primary}`
                  : '2px solid transparent',
                padding: `${SPACING.xs} 0`,
                fontSize: '0.8125rem',
                fontWeight: isActive
                  ? TYPOGRAPHY.weights.semibold
                  : TYPOGRAPHY.weights.medium,
                color: isActive
                  ? `var(--text-main, ${THEME.default.text.primary})`
                  : `var(--text-sub, ${THEME.default.text.secondary})`,
                cursor: 'pointer',
                transition: 'color 0.12s ease, border-color 0.12s ease',
                marginBottom: '-1px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{tab.label}</span>
              {isAttention && tab.value === 'expired' && attentionCount > 0 && (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    color: PALETTE.accent3,
                  }}
                >
                  ({attentionCount})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FeedbackBannerProps {
  notice: { type: 'success' | 'error'; message: string };
  onDismiss: () => void;
}

export function FeedbackBanner({ notice, onDismiss }: Readonly<FeedbackBannerProps>) {
  const isSuccess = notice.type === 'success';
  return (
    <div
      data-testid="oauth-feedback-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${SPACING.sm} ${SPACING.md}`,
        marginBottom: SPACING.lg,
        backgroundColor: isSuccess
          ? 'rgba(46, 189, 133, 0.12)'
          : 'rgba(246, 70, 93, 0.12)',
        border: `1px solid ${
          isSuccess ? 'rgba(46, 189, 133, 0.35)' : 'rgba(246, 70, 93, 0.35)'
        }`,
        borderRadius: RADII.sm,
        fontSize: '0.875rem',
        color: isSuccess ? PALETTE.accent4 : PALETTE.accent3,
        fontWeight: TYPOGRAPHY.weights.medium,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        {isSuccess ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
        <span>{notice.message}</span>
      </div>

      <button
        type="button"
        data-testid="banner-dismiss-btn"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          opacity: 0.8,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function resolveOAuthRedirectNotice(searchParams: {
  get: (key: string) => string | null;
}): {
  notice: { type: 'success' | 'error'; message: string };
  keysToRemove: string[];
} | null {
  const reconnectedMismatch = searchParams.get('reconnected_mismatch');
  if (reconnectedMismatch === '1') {
    const newAccountName = searchParams.get('newAccountName') || 'another account';
    const expectedAccountName = searchParams.get('expectedAccountName') || 'the expired account';
    return {
      notice: {
        type: 'error',
        message: `You signed into ${newAccountName} instead of ${expectedAccountName}. ${expectedAccountName} still needs to be reconnected.`,
      },
      keysToRemove: ['reconnected_mismatch', 'newAccountName', 'expectedAccountName'],
    };
  }

  const connected = searchParams.get('connected');
  if (connected === 'already') {
    const accountName = searchParams.get('accountName') || 'Account';
    return {
      notice: {
        type: 'success',
        message: `This Facebook account (${accountName}) is already connected — its session was refreshed.`,
      },
      keysToRemove: ['connected', 'accountName'],
    };
  }

  if (connected === '1') {
    return {
      notice: {
        type: 'success',
        message: 'Facebook account connected successfully.',
      },
      keysToRemove: ['connected'],
    };
  }

  const error = searchParams.get('error');
  if (error) {
    if (error === 'credentials_required') {
      return {
        notice: {
          type: 'error',
          message:
            'Facebook App credentials are required before connecting accounts. Please configure your App ID and Secret in Workspace Settings.',
        },
        keysToRemove: ['error', 'tab'],
      };
    }
    const isCancelled = error === 'access_denied' || error === 'user_cancelled';
    const message = isCancelled
      ? 'Connection canceled. No changes were made.'
      : "Couldn't connect to Facebook. Check your permissions and try again.";
    return {
      notice: {
        type: 'error',
        message,
      },
      keysToRemove: ['error'],
    };
  }

  return null;
}

interface ByocRequiredBannerProps {
  subdomain: string;
}

export function ByocRequiredBanner({ subdomain }: Readonly<ByocRequiredBannerProps>) {
  // Visible feedback the moment the link is clicked (M8) — Next.js client
  // navigation renders immediately and the new page replaces this one, so
  // the "Opening settings…" state is what the user sees during the hop.
  const [isNavigating, setIsNavigating] = useState(false);
  return (
    <div
      data-testid="byoc-required-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${SPACING.md} ${SPACING.lg}`,
        marginBottom: SPACING.lg,
        backgroundColor: 'rgba(250, 215, 52, 0.08)',
        border: '1px solid rgba(250, 215, 52, 0.25)',
        borderRadius: RADII.sm,
        fontSize: '0.875rem',
        color: `var(--text-main, ${THEME.default.text.primary})`,
        gap: SPACING.md,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flex: '1 1 300px' }}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={PALETTE.primary}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>
          Facebook App credentials are required before connecting accounts. Configure your Facebook App ID and Secret in Workspace Settings.
        </span>
      </div>
      <Link
        href={`/tenant/${subdomain}/settings?tab=byoc`}
        data-testid="byoc-configure-link"
        onClick={() => setIsNavigating(true)}
        aria-disabled={isNavigating}
        style={{
          ...COMPONENT_STYLES.secondaryButton(),
          textDecoration: 'none',
          fontSize: '0.8125rem',
          height: '32px',
          padding: `0 ${SPACING.md}`,
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          color: `var(--text-main, ${THEME.default.text.primary})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          opacity: isNavigating ? 0.6 : 1,
          pointerEvents: isNavigating ? 'none' : 'auto',
        }}
      >
        {isNavigating ? 'Opening settings…' : 'Configure in Settings'}
      </Link>
    </div>
  );
}

interface ByocConfigPromptModalProps {
  subdomain: string;
  open: boolean;
  onClose: () => void;
}

export function ByocConfigPromptModal({
  subdomain,
  open,
  onClose,
}: Readonly<ByocConfigPromptModalProps>) {
  const [isNavigating, setIsNavigating] = useState(false);
  if (!open) return null;

  return (
    <div
      role="presentation"
      data-testid="byoc-config-prompt-modal"
      style={MODAL_BACKDROP_STYLE}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'default',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="byoc-prompt-title"
        style={{
          ...MODAL_CONTAINER_STYLE,
          maxWidth: '480px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: RADII.sm,
              backgroundColor: 'rgba(250, 215, 52, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PALETTE.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h2
              id="byoc-prompt-title"
              data-testid="byoc-prompt-title"
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.bold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Facebook App Credentials Required
            </h2>
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Workspace configuration needed
            </p>
          </div>
        </div>

        <p
          data-testid="byoc-prompt-description"
          style={{
            margin: `${SPACING.sm} 0 0 0`,
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Before connecting Facebook accounts, your workspace must configure its Facebook App ID and App Secret. This ensures all account authorizations and publishing permissions run directly through your own Meta Developer App.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: SPACING.sm,
            marginTop: SPACING.md,
          }}
        >
          <button
            type="button"
            data-testid="byoc-prompt-cancel-btn"
            onClick={onClose}
            style={{
              ...COMPONENT_STYLES.secondaryButton(),
              height: '36px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: 'transparent',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              cursor: 'pointer',
            }}
          >
            Not Now
          </button>
          <Link
            href={`/tenant/${subdomain}/settings?tab=byoc`}
            data-testid="byoc-prompt-settings-link"
            onClick={() => {
              setIsNavigating(true);
              onClose();
            }}
            aria-disabled={isNavigating}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '36px',
              padding: `0 ${SPACING.md}`,
              opacity: isNavigating ? 0.6 : 1,
              pointerEvents: isNavigating ? 'none' : 'auto',
            }}
          >
            {isNavigating ? 'Opening settings…' : 'Configure in Settings'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TenantAccountsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const subdomain = (params?.subdomain as string) || '';

  const [accounts, setAccounts] = useState<FacebookAccountItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerNotice, setBannerNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // BYOC credentials status & advisory modal
  const [byocStatus, setByocStatus] = useState<{
    isConfigured: boolean;
    isLoading: boolean;
    error: string | null;
  }>({ isConfigured: false, isLoading: true, error: null });
  const [isByocPromptOpen, setIsByocPromptOpen] = useState(false);
  const [byocRetryNonce, setByocRetryNonce] = useState(0);

  // Modal & filter states
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [reconnectingAccount, setReconnectingAccount] =
    useState<FacebookAccountItem | null>(null);
  const [disconnectingAccount, setDisconnectingAccount] =
    useState<FacebookAccountItem | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnectHovered, setIsConnectHovered] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>('all');

  // Check BYOC credentials status
  useEffect(() => {
    if (!subdomain) return;
    let isMounted = true;
    async function checkByoc() {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/settings/byoc`);
        if (res.ok) {
          const data = await res.json();
          const isConfigured = Boolean(data.fbAppId && data.hasSecret);
          if (isMounted) {
            setByocStatus({ isConfigured, isLoading: false, error: null });
          }
        } else if (isMounted) {
          setByocStatus((prev) => ({
            isConfigured: prev.isConfigured,
            isLoading: false,
            error: "Couldn't verify your Facebook App credentials. Please try again.",
          }));
        }
      } catch {
        if (isMounted) {
          setByocStatus((prev) => ({
            isConfigured: prev.isConfigured,
            isLoading: false,
            error: "Couldn't verify your Facebook App credentials. Please check your connection.",
          }));
        }
      }
    }
    void checkByoc();
    return () => {
      isMounted = false;
    };
  }, [subdomain, byocRetryNonce]);

  // Fetch accounts list
  const fetchAccounts = useCallback(async () => {
    if (!subdomain) return;
    try {
      const res = await fetch(`/api/tenant/${subdomain}/accounts`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (_err) {
      // Silently fall back to existing state
    } finally {
      setIsLoading(false);
    }
  }, [subdomain]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  // Handle URL query parameters from OAuth returns
  useEffect(() => {
    const resolved = resolveOAuthRedirectNotice(searchParams);
    if (!resolved) return;

    setBannerNotice(resolved.notice);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      for (const key of resolved.keysToRemove) {
        url.searchParams.delete(key);
      }
      window.history.replaceState({}, '', url.pathname);
    }
  }, [searchParams]);

  const handleOpenNewConnect = () => {
    if (byocStatus.isLoading) return;
    if (!byocStatus.isConfigured) {
      setIsByocPromptOpen(true);
      return;
    }
    setReconnectingAccount(null);
    setIsConnectOpen(true);
  };

  // Handle Reconnect (opens ConnectAccountModal with reconnectingAccount context)
  const handleReconnect = (account: FacebookAccountItem) => {
    if (byocStatus.isLoading) return;
    if (!byocStatus.isConfigured) {
      setIsByocPromptOpen(true);
      return;
    }
    setReconnectingAccount(account);
    setIsConnectOpen(true);
  };

  const handleConnectOpenChange = (open: boolean) => {
    setIsConnectOpen(open);
    if (!open) {
      setReconnectingAccount(null);
    }
  };

  // Handle Disconnect confirmation
  const handleConfirmDisconnect = async (accountId: string) => {
    setIsDisconnecting(true);
    try {
      const res = await fetch(
        `/api/tenant/${subdomain}/accounts/${accountId}`,
        {
          method: 'DELETE',
        }
      );
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
        setDisconnectingAccount(null);
        setBannerNotice({
          type: 'success',
          message: 'Account disconnected.',
        });
      } else {
        setBannerNotice({
          type: 'error',
          message: "Couldn't disconnect account. Please refresh and try again.",
        });
      }
    } catch (_err) {
      // Ignored because a user-facing notification is displayed instead of throwing
      setBannerNotice({
        type: 'error',
        message: "Couldn't disconnect the account. Please try again.",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const sortedAccounts = useMemo(() => sortAccountsExpiredFirst(accounts), [accounts]);
  const filteredAccounts = useMemo(
    () => filterAccountsList(sortedAccounts, searchQuery, statusFilter),
    [sortedAccounts, searchQuery, statusFilter]
  );
  const existingAccountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);

  // Connect is gated while the App ID and Secret are known to be missing:
  // the action is disabled and the reason is shown next to it, instead of
  // letting a user start a connect flow that cannot succeed.
  const isConnectGated = isConnectGatedByMissingCredentials(byocStatus);
  const isConnectDisabled = byocStatus.isLoading || isConnectGated;
  const settingsFacebookHref = `/tenant/${subdomain}/settings?tab=byoc`;

  const attentionCount = useMemo(
    () => accounts.filter((a) => a.status === 'expired').length,
    [accounts]
  );
  const isFiltered = searchQuery.trim().length > 0 || statusFilter !== 'all';
  const situationalSubtitle = useMemo(
    () =>
      computeAccountsSubtitle(accounts, filteredAccounts.length, isFiltered),
    [accounts, filteredAccounts.length, isFiltered]
  );

  let contentNode: React.ReactNode;
  if (isLoading) {
    contentNode = (
      <div
        data-testid="accounts-loading-skeleton"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: SPACING.lg,
        }}
      >
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: '180px',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.md,
              opacity: 0.4,
            }}
          />
        ))}
      </div>
    );
  } else if (accounts.length === 0) {
    contentNode = (
      <AccountsEmptyState
        onConnect={handleOpenNewConnect}
        isConnectDisabled={isConnectDisabled}
        credentialsMissing={isConnectGated}
        settingsHref={settingsFacebookHref}
      />
    );
  } else if (filteredAccounts.length === 0) {
    contentNode = (
      <div
        data-testid="accounts-filter-empty"
        style={{
          padding: SPACING.xl,
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: `0 0 ${SPACING.md} 0`,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          No accounts match your search or filter.
        </p>
        <button
          type="button"
          data-testid="accounts-clear-filters-btn"
          onClick={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
          style={{
            height: '34px',
            padding: `0 ${SPACING.md}`,
            backgroundColor: 'transparent',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.sm,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            cursor: 'pointer',
          }}
        >
          Clear filters
        </button>
      </div>
    );
  } else {
    contentNode = (
      <div
        data-testid="accounts-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: SPACING.lg,
        }}
      >
        {filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onReconnect={handleReconnect}
            onDisconnect={(acc) => setDisconnectingAccount(acc)}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid="facebook-accounts-page"
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: SPACING.xl,
        boxSizing: 'border-box',
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: SPACING.md,
          marginBottom: SPACING.xl,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            data-testid="accounts-page-title"
            style={{
              margin: `0 0 ${SPACING.xs} 0`,
              fontSize: '1.5rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              letterSpacing: TYPOGRAPHY.tracking.h1,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Facebook Accounts
          </h1>
          <p
            data-testid="accounts-page-subtitle"
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            {situationalSubtitle}
          </p>
        </div>

        {accounts.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: SPACING.xs,
            }}
          >
          <button
            type="button"
            data-testid="header-connect-button"
            disabled={isConnectDisabled}
            aria-describedby={
              isConnectGated ? 'header-connect-gated-reason' : undefined
            }
            onClick={handleOpenNewConnect}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              height: '34px',
              border: `1px solid ${PALETTE.primary}`,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isConnectDisabled ? 'not-allowed' : 'pointer',
              opacity: isConnectDisabled ? 0.6 : 1,
              boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
              transform: isConnectHovered && !isConnectDisabled ? 'translateY(-1px)' : 'translateY(0)',
              transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            }}
            onMouseEnter={() => setIsConnectHovered(true)}
            onMouseLeave={() => setIsConnectHovered(false)}
          >
            <svg
              width="14"
              height="14"
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
            <span>Connect Account</span>
          </button>
          {isConnectGated && (
            <span
              id="header-connect-gated-reason"
              data-testid="header-connect-gated-reason"
              style={{
                fontSize: '0.75rem',
                lineHeight: 1.4,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Add your App ID and Secret first.{' '}
              <Link
                href={settingsFacebookHref}
                data-testid="header-connect-settings-link"
                style={{
                  color: PALETTE.primary,
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  textDecoration: 'underline',
                }}
              >
                Add them in Settings
              </Link>
            </span>
          )}
          </div>
        )}
      </div>

      {/* Dismissible Feedback Banner */}
      {bannerNotice && (
        <FeedbackBanner
          notice={bannerNotice}
          onDismiss={() => setBannerNotice(null)}
        />
      )}

      {/* BYOC Network / 500 Retry Banner */}
      {byocStatus.error && (
        <div
          data-testid="byoc-retry-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACING.sm} ${SPACING.md}`,
            marginBottom: SPACING.lg,
            backgroundColor: 'rgba(250, 215, 52, 0.08)',
            border: '1px solid rgba(250, 215, 52, 0.25)',
            borderRadius: RADII.sm,
            fontSize: '0.875rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          <span>{byocStatus.error}</span>
          <button
            type="button"
            data-testid="byoc-retry-btn"
            onClick={() => {
              setByocStatus((prev) => ({ ...prev, isLoading: true, error: null }));
              setByocRetryNonce((n) => n + 1);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: PALETTE.primary,
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: TYPOGRAPHY.weights.semibold,
            }}
          >
            Retry Check
          </button>
        </div>
      )}

      {/* BYOC Required Warning Banner */}
      {!byocStatus.isLoading && !byocStatus.isConfigured && !byocStatus.error && (
        <ByocRequiredBanner subdomain={subdomain} />
      )}

      {/* Unified cross-platform accounts list (Spec 123) */}
      <SocialAccountsList subdomain={subdomain} />

      {/* Search & Status Filter Bar */}
      {!isLoading && accounts.length > 0 && (
        <AccountsFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          attentionCount={attentionCount}
        />
      )}

      {/* Main Content Area */}
      {contentNode}

      {/* Connect Account Modal */}
      <ConnectAccountModal
        subdomain={subdomain}
        open={isConnectOpen}
        onOpenChange={handleConnectOpenChange}
        onAccountConnected={fetchAccounts}
        onConnectionNotice={setBannerNotice}
        existingAccountIds={existingAccountIds}
        reconnectingAccount={reconnectingAccount}
        initialAccounts={accounts}
      />

      {/* Disconnect Safety Dialog */}
      <DisconnectAccountDialog
        account={disconnectingAccount}
        open={Boolean(disconnectingAccount)}
        onOpenChange={(open) => !open && setDisconnectingAccount(null)}
        onConfirm={handleConfirmDisconnect}
        isDisconnecting={isDisconnecting}
      />

      {/* BYOC Configuration Advisory Modal */}
      <ByocConfigPromptModal
        subdomain={subdomain}
        open={isByocPromptOpen}
        onClose={() => setIsByocPromptOpen(false)}
      />
    </div>
  );
}
