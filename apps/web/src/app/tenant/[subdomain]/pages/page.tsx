'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import {
  PageCard,
  isPageNeedsAttention,
  type FacebookPageItem,
} from '@/components/pages/page-card';
import { PagesEmptyState } from '@/components/pages/pages-empty-state';
import { AddPageModal } from '@/components/pages/add-page-modal';
import type { FacebookAccountItem } from '@/components/accounts/account-card';
import { getAccountHealth } from '@/components/accounts/account-health';
import { buildDirectConnectUrl } from '@/components/accounts/connect-account-modal';

export type PageStatusFilter = 'all' | 'active' | 'needs_attention' | 'paused';

function getStatusSortRank(status: FacebookPageItem['status']): number {
  if (isPageNeedsAttention(status)) return 0;
  if (status === 'paused') return 1;
  if (status === 'active') return 2;
  return 3;
}

export function sortPagesAttentionFirst(
  items: FacebookPageItem[]
): FacebookPageItem[] {
  return [...items].sort((a, b) => {
    const rankDiff = getStatusSortRank(a.status) - getStatusSortRank(b.status);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    return bTime - aTime;
  });
}

export function filterPagesList(
  items: FacebookPageItem[],
  searchQuery: string,
  statusFilter: PageStatusFilter = 'all',
  accountFilter = 'all'
): FacebookPageItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  return items.filter((page) => {
    const matchesSearch =
      normalizedQuery.length === 0 ||
      page.pageName.toLowerCase().includes(normalizedQuery) ||
      (page.category ?? '').toLowerCase().includes(normalizedQuery);

    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = page.status === 'active';
    } else if (statusFilter === 'needs_attention') {
      matchesStatus = isPageNeedsAttention(page.status);
    } else if (statusFilter === 'paused') {
      matchesStatus = page.status === 'paused';
    }

    const matchesAccount =
      !accountFilter ||
      accountFilter === 'all' ||
      page.accountDisplayName === accountFilter ||
      page.facebookAccountId === accountFilter;

    return matchesSearch && matchesStatus && matchesAccount;
  });
}

export interface PagesScaleToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: PageStatusFilter;
  onStatusFilterChange: (value: PageStatusFilter) => void;
  accountFilter: string;
  onAccountFilterChange: (value: string) => void;
  accountOptions: string[];
  attentionCount?: number | undefined;
}

const PAGE_FILTER_TABS: Array<{
  value: PageStatusFilter;
  label: string;
  testId: string;
}> = [
  { value: 'all', label: 'All', testId: 'pages-filter-all' },
  { value: 'active', label: 'Active', testId: 'pages-filter-active' },
  {
    value: 'needs_attention',
    label: 'Needs Attention',
    testId: 'pages-filter-needs-attention',
  },
  { value: 'paused', label: 'Paused', testId: 'pages-filter-paused' },
];

export function PagesScaleToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  accountFilter,
  onAccountFilterChange,
  accountOptions,
  attentionCount = 0,
}: Readonly<PagesScaleToolbarProps>) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  return (
    <div
      data-testid="pages-scale-toolbar"
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
          data-testid="pages-search-input"
          placeholder="Filter by name or category..."
          aria-label="Filter pages by name or category"
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

      {/* Pure Typographic Flat Filter Tabs & Account Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.lg,
          flexWrap: 'wrap',
        }}
      >
        <div
          role="tablist"
          aria-label="Filter pages by status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.md,
          }}
        >
          {PAGE_FILTER_TABS.map((tab) => {
            const isActive = statusFilter === tab.value;
            const isAttention = tab.value === 'needs_attention';
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
                {isAttention && attentionCount > 0 && (
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

        {/* Account Selector */}
        <select
          data-testid="pages-account-filter"
          aria-label="Filter pages by Facebook account"
          value={accountFilter}
          onChange={(e) => onAccountFilterChange(e.target.value)}
          style={{
            height: '32px',
            padding: `0 ${SPACING.sm}`,
            backgroundColor: 'transparent',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.sm,
            fontSize: '0.8125rem',
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.15s ease',
          }}
        >
          <option value="all">All accounts</option>
          {accountOptions.map((accountName) => (
            <option key={accountName} value={accountName}>
              {accountName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function computeSituationalSubtitle(
  totalCount: number,
  filteredCount: number,
  attentionCount: number,
  isFiltered: boolean
): React.ReactNode {
  if (totalCount === 0) {
    return 'Connect your first Facebook Page to start managing content and tracking follower growth.';
  }
  if (isFiltered) {
    return `Showing ${filteredCount} of ${totalCount} ${
      totalCount === 1 ? 'page' : 'pages'
    }`;
  }
  if (attentionCount > 0) {
    return (
      <span>
        {totalCount} connected {totalCount === 1 ? 'page' : 'pages'} ·{' '}
        <span
          style={{
            color: PALETTE.accent3,
            fontWeight: TYPOGRAPHY.weights.medium,
          }}
        >
          {attentionCount} {attentionCount === 1 ? 'requires' : 'require'}{' '}
          reconnecting
        </span>
      </span>
    );
  }
  return `${totalCount} connected ${
    totalCount === 1 ? 'page' : 'pages'
  }`;
}

export interface TenantPagesPageProps {
  initialPages?: FacebookPageItem[] | undefined;
  initialAccounts?: FacebookAccountItem[] | undefined;
  subdomainProp?: string | undefined;
}

export default function TenantPagesPage({
  initialPages,
  initialAccounts,
  subdomainProp,
}: Readonly<TenantPagesPageProps> = {}) {
  const params = useParams();
  const router = useRouter();
  const subdomain = subdomainProp ?? ((params?.subdomain as string) || '');

  const [pages, setPages] = useState<FacebookPageItem[]>(initialPages ?? []);
  const [accounts, setAccounts] = useState<FacebookAccountItem[]>(
    initialAccounts ?? []
  );
  const [isLoading, setIsLoading] = useState(initialPages === undefined);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Workspace Facebook-app credentials — checked only when an expired
  // account needs reconnecting, to decide whether OAuth can start directly.
  const [byocStatus, setByocStatus] = useState<{
    isConfigured: boolean;
    isLoading: boolean;
  }>({ isConfigured: false, isLoading: false });

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddHovered, setIsAddHovered] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PageStatusFilter>('all');
  const [accountFilter, setAccountFilter] = useState('all');

  const fetchPagesAndAccounts = useCallback(async () => {
    try {
      if (!subdomain) return;
      const [pagesRes, accountsRes] = await Promise.all([
        fetch(`/api/tenant/${subdomain}/pages`),
        fetch(`/api/tenant/${subdomain}/accounts`),
      ]);

      if (pagesRes.ok) {
        const pagesData = await pagesRes.json();
        setPages(pagesData.pages || []);
      }

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.accounts || []);
      }
    } catch (_err) {
      // Preserve existing state on network error
    } finally {
      // Always clear the loading state so the skeleton can never hang,
      // including the no-subdomain early return above.
      setIsLoading(false);
    }
  }, [subdomain]);

  useEffect(() => {
    if (initialPages === undefined) {
      void fetchPagesAndAccounts();
    }
  }, [initialPages, fetchPagesAndAccounts]);

  const expiredAccount = useMemo(
    () => accounts.find((a) => getAccountHealth(a) === 'expired') ?? null,
    [accounts]
  );

  // Check workspace Facebook-app credentials only while an expired account
  // is present, so Reconnect can start OAuth directly when possible.
  useEffect(() => {
    if (!subdomain || !expiredAccount) return;
    let isMounted = true;
    setByocStatus({ isConfigured: false, isLoading: true });
    async function checkByoc() {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/settings/byoc`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setByocStatus({
              isConfigured: Boolean(data.fbAppId && data.hasSecret),
              isLoading: false,
            });
          }
        } else if (isMounted) {
          setByocStatus({ isConfigured: false, isLoading: false });
        }
      } catch {
        if (isMounted) {
          setByocStatus({ isConfigured: false, isLoading: false });
        }
      }
    }
    void checkByoc();
    return () => {
      isMounted = false;
    };
  }, [subdomain, expiredAccount]);

  const handleReconnect = useCallback(
    (account: FacebookAccountItem) => {
      if (byocStatus.isLoading) return;
      if (!byocStatus.isConfigured) {
        // No workspace app credentials: send the user to Settings → Facebook,
        // which explains why the app details are needed before reconnecting.
        router.push(`/tenant/${subdomain}/settings?tab=byoc&notice=reconnect`);
        return;
      }
      // Credentials present: start the OAuth reconnect immediately.
      window.location.href = buildDirectConnectUrl({
        id: account.id,
        fbAccountId: account.fbAccountId,
        displayName: account.displayName,
        status: account.status,
        updatedAt: account.updatedAt,
      });
    },
    [byocStatus, router, subdomain]
  );

  const sortedPages = useMemo(() => sortPagesAttentionFirst(pages), [pages]);

  const accountOptions = useMemo(() => {
    const names = new Set<string>();
    for (const p of pages) {
      if (p.accountDisplayName) {
        names.add(p.accountDisplayName);
      }
    }
    for (const a of accounts) {
      if (a.displayName) {
        names.add(a.displayName);
      }
    }
    return Array.from(names);
  }, [pages, accounts]);

  const filteredPages = useMemo(
    () =>
      filterPagesList(sortedPages, searchQuery, statusFilter, accountFilter),
    [sortedPages, searchQuery, statusFilter, accountFilter]
  );

  const attentionCount = useMemo(
    () => pages.filter((p) => isPageNeedsAttention(p.status)).length,
    [pages]
  );

  const isFiltered =
    searchQuery.trim().length > 0 ||
    statusFilter !== 'all' ||
    accountFilter !== 'all';

  const situationalSubtitle = useMemo(
    () =>
      computeSituationalSubtitle(
        pages.length,
        filteredPages.length,
        attentionCount,
        isFiltered
      ),
    [pages.length, filteredPages.length, attentionCount, isFiltered]
  );

  const handleSelectPage = (page: FacebookPageItem) => {
    router.push(`/tenant/${subdomain}/pages/${page.id}`);
  };

  const handlePagesImported = (importedCount: number) => {
    setBannerMessage(
      `${importedCount} ${
        importedCount === 1 ? 'Facebook Page' : 'Facebook Pages'
      } added to your workspace.`
    );
    void fetchPagesAndAccounts();
  };

  let contentNode: React.ReactNode;
  if (isLoading) {
    contentNode = (
      <div
        data-testid="pages-loading-skeleton"
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
              height: '200px',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.md,
              opacity: 0.4,
            }}
          />
        ))}
      </div>
    );
  } else if (pages.length === 0) {
    contentNode = (
      <PagesEmptyState onAddPage={() => setIsAddModalOpen(true)} />
    );
  } else if (filteredPages.length === 0) {
    contentNode = (
      <div
        data-testid="pages-filter-empty"
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
          No Facebook Pages match your search or filter.
        </p>
        <button
          type="button"
          data-testid="pages-clear-filters-btn"
          onClick={() => {
            setSearchQuery('');
            setStatusFilter('all');
            setAccountFilter('all');
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
        data-testid="pages-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: SPACING.lg,
        }}
      >
        {filteredPages.map((page) => (
          <PageCard
            key={page.id}
            page={page}
            subdomain={subdomain}
            onSelectPage={handleSelectPage}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid="facebook-pages-page"
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
            data-testid="pages-page-title"
            style={{
              margin: `0 0 ${SPACING.xs} 0`,
              fontSize: '1.5rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              letterSpacing: TYPOGRAPHY.tracking.h1,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Facebook Pages
          </h1>
          <p
            data-testid="pages-page-subtitle"
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            {situationalSubtitle}
          </p>
        </div>

        <button
          type="button"
          data-testid="header-add-page-btn"
          onClick={() => setIsAddModalOpen(true)}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            height: '34px',
            border: `1px solid ${PALETTE.primary}`,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
            transform: isAddHovered ? 'translateY(-1px)' : 'translateY(0)',
            transition: 'transform 0.12s ease, box-shadow 0.12s ease',
          }}
          onMouseEnter={() => setIsAddHovered(true)}
          onMouseLeave={() => setIsAddHovered(false)}
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
          <span>Add Page</span>
        </button>
      </div>

      {/* Expired connection banner */}
      {expiredAccount && (
        <div
          data-testid="pages-expired-connection-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.md,
            flexWrap: 'wrap',
            padding: `${SPACING.md} ${SPACING.lg}`,
            marginBottom: SPACING.lg,
            backgroundColor: 'rgba(246, 70, 93, 0.08)',
            border: '1px solid rgba(246, 70, 93, 0.25)',
            borderRadius: RADII.sm,
          }}
        >
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Your Facebook connection expired. Reconnect to resume publishing.
          </span>
          <button
            type="button"
            data-testid="pages-reconnect-btn"
            disabled={byocStatus.isLoading}
            onClick={() => handleReconnect(expiredAccount)}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              height: '34px',
              fontSize: '0.8125rem',
              opacity: byocStatus.isLoading ? 0.6 : 1,
              cursor: byocStatus.isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {byocStatus.isLoading ? 'Checking…' : 'Reconnect'}
          </button>
        </div>
      )}

      {/* Confirmation Banner */}
      {bannerMessage && (
        <div
          data-testid="pages-feedback-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACING.sm} ${SPACING.md}`,
            marginBottom: SPACING.lg,
            backgroundColor: 'rgba(46, 189, 133, 0.12)',
            border: '1px solid rgba(46, 189, 133, 0.35)',
            borderRadius: RADII.sm,
            fontSize: '0.875rem',
            color: PALETTE.accent4,
            fontWeight: TYPOGRAPHY.weights.medium,
          }}
        >
          <span>{bannerMessage}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            aria-label="Dismiss notification"
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Scale Toolbar when > 4 Pages exist */}
      {!isLoading && pages.length > 4 && (
        <PagesScaleToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          accountFilter={accountFilter}
          onAccountFilterChange={setAccountFilter}
          accountOptions={accountOptions}
          attentionCount={attentionCount}
        />
      )}

      {/* Main Content */}
      {contentNode}

      {/* Two-Step Add Page Modal */}
      <AddPageModal
        subdomain={subdomain}
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        accounts={accounts}
        onSuccess={handlePagesImported}
        onNavigateToAccounts={() =>
          router.push(`/tenant/${subdomain}/accounts`)
        }
        onReconnectAccount={handleReconnect}
      />
    </div>
  );
}
