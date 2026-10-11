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
}: Readonly<PagesScaleToolbarProps>) {
  return (
    <div
      data-testid="pages-scale-toolbar"
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
        data-testid="pages-search-input"
        placeholder="Search pages by name or category..."
        aria-label="Search pages by name or category"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          ...COMPONENT_STYLES.input(),
          backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
          color: `var(--text-main, ${THEME.default.text.primary})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          minWidth: '240px',
          flex: '1 1 240px',
          maxWidth: '340px',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          flexWrap: 'wrap',
        }}
      >
        <fieldset
          aria-label="Filter pages by status"
          style={{
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACING.xs,
            padding: SPACING.xs,
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.sm,
          }}
        >
          {PAGE_FILTER_TABS.map((tab) => {
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
                  fontWeight: isActive
                    ? TYPOGRAPHY.weights.semibold
                    : TYPOGRAPHY.weights.medium,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </fieldset>

        <select
          data-testid="pages-account-filter"
          aria-label="Filter pages by Facebook account"
          value={accountFilter}
          onChange={(e) => onAccountFilterChange(e.target.value)}
          style={{
            ...COMPONENT_STYLES.input(),
            backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            minWidth: '180px',
            cursor: 'pointer',
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

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PageStatusFilter>('all');
  const [accountFilter, setAccountFilter] = useState('all');

  const fetchPagesAndAccounts = useCallback(async () => {
    if (!subdomain) return;
    try {
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
      setIsLoading(false);
    }
  }, [subdomain]);

  useEffect(() => {
    if (initialPages === undefined) {
      void fetchPagesAndAccounts();
    }
  }, [initialPages, fetchPagesAndAccounts]);

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
            style={{
              margin: 0,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Track follower growth and open any page to manage publishing and
            automation.
          </p>
        </div>

        <button
          type="button"
          data-testid="header-add-page-btn"
          onClick={() => setIsAddModalOpen(true)}
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
          <span>Add Page</span>
        </button>
      </div>

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
      />
    </div>
  );
}
