'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import { AccountCard, type FacebookAccountItem } from '@/components/accounts/account-card';
import { AccountsEmptyState } from '@/components/accounts/accounts-empty-state';
import { ConnectAccountModal } from '@/components/accounts/connect-account-modal';
import { DisconnectAccountDialog } from '@/components/accounts/disconnect-account-dialog';

type AccountStatusFilter = 'all' | 'active' | 'expired';

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
    const matchesStatus =
      statusFilter === 'all' || account.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
}

interface AccountsFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: AccountStatusFilter;
  onStatusFilterChange: (value: AccountStatusFilter) => void;
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
}: Readonly<AccountsFilterBarProps>) {
  return (
    <div
      data-testid="accounts-filter-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        marginBottom: SPACING.lg,
        flexWrap: 'wrap',
      }}
    >
      <input
        type="search"
        data-testid="accounts-search-input"
        placeholder="Search accounts..."
        aria-label="Search accounts"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          ...COMPONENT_STYLES.input(),
          backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
          color: `var(--text-main, ${THEME.default.text.primary})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          minWidth: '240px',
          flex: '1 1 240px',
          maxWidth: '360px',
        }}
      />

      <div
        role="group"
        aria-label="Filter accounts by status"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACING.xs,
          padding: SPACING.xs,
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.sm,
        }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              data-testid={tab.testId}
              aria-pressed={isActive}
              onClick={() => onStatusFilterChange(tab.value)}
              style={{
                height: '30px',
                padding: `0 ${SPACING.md}`,
                backgroundColor: isActive
                  ? `var(--bg-panel, ${THEME.default.surfaces.panel})`
                  : 'transparent',
                color: isActive
                  ? `var(--text-main, ${THEME.default.text.primary})`
                  : `var(--text-sub, ${THEME.default.text.secondary})`,
                border: isActive
                  ? `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`
                  : '1px solid transparent',
                borderRadius: RADII.xs,
                fontSize: '0.8125rem',
                fontWeight: isActive ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.medium,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              {tab.label}
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

function FeedbackBanner({ notice, onDismiss }: Readonly<FeedbackBannerProps>) {
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

  // Modal & filter states
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [reconnectingAccount, setReconnectingAccount] =
    useState<FacebookAccountItem | null>(null);
  const [disconnectingAccount, setDisconnectingAccount] =
    useState<FacebookAccountItem | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>('all');

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
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected === '1') {
      setBannerNotice({
        type: 'success',
        message: 'Facebook account connected successfully.',
      });
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('connected');
        window.history.replaceState({}, '', url.pathname);
      }
    } else if (error) {
      const isCancelled = error === 'access_denied' || error === 'user_cancelled';
      const message = isCancelled
        ? 'Connection canceled. No changes were made.'
        : "Couldn't connect to Facebook. Check your permissions and try again.";
      setBannerNotice({
        type: 'error',
        message,
      });
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  }, [searchParams]);

  const handleOpenNewConnect = () => {
    setReconnectingAccount(null);
    setIsConnectOpen(true);
  };

  // Handle Reconnect (opens ConnectAccountModal with reconnectingAccount context)
  const handleReconnect = (account: FacebookAccountItem) => {
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
        message: 'An error occurred while disconnecting the account.',
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
    contentNode = <AccountsEmptyState onConnect={handleOpenNewConnect} />;
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
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Connect your Facebook accounts to manage pages
          </p>
        </div>

        {accounts.length > 0 && (
          <button
            type="button"
            data-testid="header-connect-button"
            onClick={handleOpenNewConnect}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACING.xs,
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
        )}
      </div>

      {/* Dismissible Feedback Banner */}
      {bannerNotice && (
        <FeedbackBanner
          notice={bannerNotice}
          onDismiss={() => setBannerNotice(null)}
        />
      )}

      {/* Search & Status Filter Bar (> 4 accounts) */}
      {!isLoading && accounts.length > 4 && (
        <AccountsFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
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
    </div>
  );
}
