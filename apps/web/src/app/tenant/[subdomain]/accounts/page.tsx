'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import { AccountCard, type FacebookAccountItem } from '@/components/accounts/account-card';
import { AccountsEmptyState } from '@/components/accounts/accounts-empty-state';
import { ConnectAccountModal } from '@/components/accounts/connect-account-modal';
import { DisconnectAccountDialog } from '@/components/accounts/disconnect-account-dialog';

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

  // Modal states
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [disconnectingAccount, setDisconnectingAccount] =
    useState<FacebookAccountItem | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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
        message: 'Facebook account successfully connected.',
      });
      // Clean query parameters from URL history
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('connected');
        window.history.replaceState({}, '', url.pathname);
      }
    } else if (error) {
      let message = 'Unable to connect Facebook account. Please try again.';
      if (error === 'access_denied' || error === 'user_cancelled') {
        message = 'Connection request was cancelled.';
      }
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

  // Handle Reconnect (initiates direct OAuth redirect)
  const handleReconnect = (_account: FacebookAccountItem) => {
    window.location.href = '/api/auth/facebook';
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
          message: 'Facebook account disconnected successfully.',
        });
      } else {
        setBannerNotice({
          type: 'error',
          message: 'Failed to disconnect account. Please try again.',
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
    contentNode = <AccountsEmptyState onConnect={() => setIsConnectOpen(true)} />;
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
        {accounts.map((account) => (
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
            Manage your connected personal and business Facebook profiles and access credentials.
          </p>
        </div>

        {accounts.length > 0 && (
          <button
            type="button"
            data-testid="header-connect-button"
            onClick={() => setIsConnectOpen(true)}
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
        <div
          data-testid="oauth-feedback-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACING.sm} ${SPACING.md}`,
            marginBottom: SPACING.lg,
            backgroundColor:
              bannerNotice.type === 'success'
                ? 'rgba(46, 189, 133, 0.12)'
                : 'rgba(246, 70, 93, 0.12)',
            border: `1px solid ${
              bannerNotice.type === 'success'
                ? 'rgba(46, 189, 133, 0.35)'
                : 'rgba(246, 70, 93, 0.35)'
            }`,
            borderRadius: RADII.sm,
            fontSize: '0.875rem',
            color:
              bannerNotice.type === 'success'
                ? PALETTE.accent4
                : PALETTE.accent3,
            fontWeight: TYPOGRAPHY.weights.medium,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
            {bannerNotice.type === 'success' ? (
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
            <span>{bannerNotice.message}</span>
          </div>

          <button
            type="button"
            data-testid="banner-dismiss-btn"
            onClick={() => setBannerNotice(null)}
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
      )}

      {/* Main Content Area */}
      {contentNode}

      {/* Connect Account Modal */}
      <ConnectAccountModal
        subdomain={subdomain}
        open={isConnectOpen}
        onOpenChange={setIsConnectOpen}
        onAccountConnected={fetchAccounts}
        existingAccountIds={accounts.map((a) => a.id)}
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
