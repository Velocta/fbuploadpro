'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import {
  getInitials,
  type FacebookAccountItem,
} from '@/components/accounts/account-card';

export interface DiscoveredPageItem {
  fbPageId: string;
  pageName: string;
  profilePictureUrl?: string | null | undefined;
  category?: string | null | undefined;
  currentFollowers?: number | undefined;
  followersCount?: number | undefined;
  tasks?: string[] | undefined;
  isImported: boolean;
}

export interface AddPageModalProps {
  subdomain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts?: FacebookAccountItem[] | undefined;
  onSuccess?: ((importedCount: number) => void) | undefined;
  onNavigateToAccounts?: (() => void) | undefined;
  initialStep?: 'select-account' | 'select-pages' | undefined;
  initialSelectedAccount?: FacebookAccountItem | null | undefined;
  initialDiscoveredPages?: DiscoveredPageItem[] | undefined;
  initialSelectedPageIds?: string[] | undefined;
}

export function getActiveAccounts(
  accounts: FacebookAccountItem[]
): FacebookAccountItem[] {
  return accounts.filter((acc) => acc.status === 'active');
}

export function getSelectablePageIds(pages: DiscoveredPageItem[]): string[] {
  return pages.filter((p) => !p.isImported).map((p) => p.fbPageId);
}

export function toggleSelectAllPages(
  pages: DiscoveredPageItem[],
  currentSelectedIds: string[]
): string[] {
  const selectableIds = getSelectablePageIds(pages);
  if (selectableIds.length === 0) {
    return [];
  }
  const currentSet = new Set(currentSelectedIds);
  const allSelected = selectableIds.every((id) => currentSet.has(id));
  return allSelected ? [] : selectableIds;
}

function ArrowLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SearchIcon() {
  return (
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
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function DiscoveredPageAvatar({
  pageName,
  profilePictureUrl,
}: Readonly<{
  pageName: string;
  profilePictureUrl?: string | null | undefined;
}>) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImg =
    Boolean(profilePictureUrl) && failedUrl !== profilePictureUrl;
  const initials = getInitials(pageName, 'PG');

  if (showImg) {
    return (
      <img
        src={profilePictureUrl!}
        alt={pageName}
        onError={() => setFailedUrl(profilePictureUrl ?? '__error__')}
        style={{
          width: '36px',
          height: '36px',
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
      style={{
        width: '36px',
        height: '36px',
        borderRadius: RADII.full,
        backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        color: `var(--text-main, ${THEME.default.text.primary})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: TYPOGRAPHY.weights.bold,
        fontSize: '0.75rem',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function AccountOptionItem({
  account,
  onSelect,
}: Readonly<{
  account: FacebookAccountItem;
  onSelect: (account: FacebookAccountItem) => void;
}>) {
  const initials = getInitials(account.displayName, 'FB');
  const pagesLabel = `${account.connectedPagesCount} ${
    account.connectedPagesCount === 1 ? 'page linked' : 'pages linked'
  }`;

  return (
    <button
      key={account.id}
      type="button"
      data-testid={`select-account-${account.id}`}
      onClick={() => onSelect(account)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        padding: '12px 14px',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: RADII.sm,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          minWidth: 0,
        }}
      >
        {account.profilePictureUrl ? (
          <img
            src={account.profilePictureUrl}
            alt={account.displayName}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: RADII.full,
              objectFit: 'cover',
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: RADII.full,
              backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: TYPOGRAPHY.weights.bold,
              fontSize: '0.8125rem',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: TYPOGRAPHY.weights.semibold,
              fontSize: '0.9375rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {account.displayName}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              marginTop: '2px',
            }}
          >
            {pagesLabel}
          </div>
        </div>
      </div>

      <div
        style={{
          color: `var(--text-dim, ${THEME.default.text.muted})`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <ChevronRightIcon />
      </div>
    </button>
  );
}

function DiscoveredPageRowItem({
  page,
  isChecked,
  onToggle,
}: Readonly<{
  page: DiscoveredPageItem;
  isChecked: boolean;
  onToggle: (fbPageId: string) => void;
}>) {
  const followers = page.currentFollowers ?? page.followersCount ?? 0;
  const isSelected = !page.isImported && isChecked;

  return (
    <label
      key={page.fbPageId}
      data-testid={`discovered-page-row-${page.fbPageId}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        padding: '10px 12px',
        backgroundColor: isSelected
          ? `var(--bg-subtle, ${THEME.default.surfaces.subtle})`
          : 'transparent',
        borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.xs,
        cursor: page.isImported ? 'default' : 'pointer',
        opacity: page.isImported ? 0.6 : 1,
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!page.isImported && !isSelected) {
          e.currentTarget.style.backgroundColor = `var(--bg-hover, ${THEME.default.surfaces.hover})`;
        }
      }}
      onMouseLeave={(e) => {
        if (!page.isImported && !isSelected) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <input
        type="checkbox"
        data-testid={`discovered-page-checkbox-${page.fbPageId}`}
        checked={isChecked}
        disabled={page.isImported}
        onChange={() => {
          if (!page.isImported) {
            onToggle(page.fbPageId);
          }
        }}
        style={{
          width: '16px',
          height: '16px',
          accentColor: PALETTE.primary,
          cursor: page.isImported ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}
      />

      <DiscoveredPageAvatar
        pageName={page.pageName}
        profilePictureUrl={page.profilePictureUrl}
      />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontWeight: TYPOGRAPHY.weights.semibold,
            fontSize: '0.875rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {page.pageName}
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            marginTop: '2px',
          }}
        >
          {page.category || 'Facebook Page'} • {followers.toLocaleString('en-US')}{' '}
          followers
        </div>
      </div>

      {page.isImported && (
        <span
          data-testid={`already-added-${page.fbPageId}`}
          style={{
            fontSize: '0.75rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            flexShrink: 0,
          }}
        >
          Already added
        </span>
      )}
    </label>
  );
}

function DiscoveredPagesToolbar({
  searchQuery,
  onSearchChange,
  totalFound,
  selectableCount,
  allChecked,
  onToggleSelectAll,
}: Readonly<{
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalFound: number;
  selectableCount: number;
  allChecked: boolean;
  onToggleSelectAll: () => void;
}>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        marginBottom: SPACING.xs,
        padding: `0 2px`,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          maxWidth: '240px',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: '9px',
            color: 'var(--text-dim)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <SearchIcon />
        </span>
        <input
          type="text"
          data-testid="modal-page-search-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter pages..."
          style={{
            width: '100%',
            height: '30px',
            paddingLeft: '28px',
            paddingRight: '8px',
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            borderRadius: RADII.sm,
            color: 'var(--text-main)',
            fontSize: '0.75rem',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
        <span
          style={{
            fontSize: '0.75rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          {totalFound} {totalFound === 1 ? 'page found' : 'pages found'}
        </span>

        {selectableCount > 0 && (
          <button
            type="button"
            data-testid="select-all-pages-btn"
            aria-pressed={allChecked}
            onClick={onToggleSelectAll}
            style={{
              background: 'none',
              border: 'none',
              color: PALETTE.primary,
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {allChecked ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>
    </div>
  );
}

export function AddPageModal({
  subdomain,
  open,
  onOpenChange,
  accounts,
  onSuccess,
  onNavigateToAccounts,
  initialStep = 'select-account',
  initialSelectedAccount = null,
  initialDiscoveredPages = [],
  initialSelectedPageIds = [],
}: Readonly<AddPageModalProps>) {
  const [step, setStep] = useState<'select-account' | 'select-pages'>(
    initialStep
  );
  const [fetchedAccounts, setFetchedAccounts] = useState<
    FacebookAccountItem[] | null
  >(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  const [selectedAccount, setSelectedAccount] =
    useState<FacebookAccountItem | null>(initialSelectedAccount);
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPageItem[]>(
    initialDiscoveredPages
  );
  const [pageSearchQuery, setPageSearchQuery] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>(
    initialSelectedPageIds
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveAccounts = fetchedAccounts ?? accounts ?? [];
  const activeAccounts = getActiveAccounts(effectiveAccounts);

  const fetchAccountsIfNeeded = useCallback(async () => {
    if (!subdomain || accounts !== undefined) return;
    setIsLoadingAccounts(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/accounts`);
      if (res.ok) {
        const data = await res.json();
        setFetchedAccounts(data.accounts || []);
      }
    } catch (_err) {
      // Keep fallback empty accounts state
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [subdomain, accounts]);

  useEffect(() => {
    if (open && accounts === undefined) {
      void fetchAccountsIfNeeded();
    }
  }, [open, accounts, fetchAccountsIfNeeded]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep('select-account');
      setSelectedAccount(null);
      setDiscoveredPages([]);
      setSelectedPageIds([]);
      setPageSearchQuery('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSelectAccount = async (account: FacebookAccountItem) => {
    setSelectedAccount(account);
    setStep('select-pages');
    setDiscoveredPages([]);
    setSelectedPageIds([]);
    setPageSearchQuery('');
    setErrorMessage(null);
    setIsDiscovering(true);

    try {
      const res = await fetch(
        `/api/tenant/${subdomain}/accounts/${account.id}/pages/discover`
      );
      if (!res.ok) {
        setErrorMessage(
          "Couldn't load pages from this Facebook account. Please check the account connection and try again."
        );
        return;
      }
      const data = await res.json();
      setDiscoveredPages(data.pages || []);
    } catch (_err) {
      setErrorMessage(
        'An error occurred while loading pages from Facebook. Please try again.'
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleBackToAccounts = () => {
    setStep('select-account');
    setSelectedAccount(null);
    setDiscoveredPages([]);
    setSelectedPageIds([]);
    setPageSearchQuery('');
    setErrorMessage(null);
  };

  const handleTogglePage = (fbPageId: string) => {
    setSelectedPageIds((prev) =>
      prev.includes(fbPageId)
        ? prev.filter((id) => id !== fbPageId)
        : [...prev, fbPageId]
    );
  };

  const handleSelectAll = () => {
    setSelectedPageIds((prev) => toggleSelectAllPages(discoveredPages, prev));
  };

  const handleConfirmImport = async () => {
    if (!selectedAccount || selectedPageIds.length === 0 || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/tenant/${subdomain}/pages/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount.id,
          selectedPageIds,
        }),
      });

      if (!res.ok) {
        setErrorMessage(
          "Couldn't add the selected pages. Please try again."
        );
        return;
      }

      const data = await res.json();
      const importedCount =
        typeof data.importedCount === 'number'
          ? data.importedCount
          : selectedPageIds.length;

      onSuccess?.(importedCount);
      handleDialogOpenChange(false);
    } catch (_err) {
      setErrorMessage(
        'An error occurred while adding your pages. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToAccounts = () => {
    handleDialogOpenChange(false);
    if (onNavigateToAccounts) {
      onNavigateToAccounts();
    } else if (typeof window !== 'undefined') {
      window.location.href = `/tenant/${subdomain}/accounts`;
    }
  };

  const selectableIds = getSelectablePageIds(discoveredPages);
  const allSelectableChecked =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedPageIds.includes(id));

  const filteredDiscoveredPages = useMemo(() => {
    const q = pageSearchQuery.trim().toLowerCase();
    if (!q) return discoveredPages;
    return discoveredPages.filter(
      (p) =>
        p.pageName.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [discoveredPages, pageSearchQuery]);

  const confirmButtonText = isSubmitting
    ? 'Adding Pages...'
    : selectedPageIds.length > 0
      ? `Import ${selectedPageIds.length} ${
          selectedPageIds.length === 1 ? 'Page' : 'Pages'
        }`
      : 'Add Selected Pages';

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent style={{ maxWidth: '540px' }} data-testid="add-page-modal">
        <DialogHeader>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: SPACING.sm,
            }}
          >
            {step === 'select-pages' && (
              <button
                type="button"
                data-testid="change-account-btn"
                onClick={handleBackToAccounts}
                aria-label="Back to account selection"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-sub)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: '4px',
                  marginTop: '2px',
                  borderRadius: RADII.xs,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-main)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-sub)';
                }}
              >
                <ArrowLeftIcon />
              </button>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <DialogTitle>
                {step === 'select-account'
                  ? 'Select a Facebook Account'
                  : 'Select Facebook Pages to Add'}
              </DialogTitle>
              <DialogDescription>
                {step === 'select-account'
                  ? 'Choose which connected Facebook account you want to import pages from.'
                  : `${selectedAccount?.displayName || 'Connected Account'} · ${
                      discoveredPages.length
                    } ${
                      discoveredPages.length === 1
                        ? 'page available'
                        : 'pages available'
                    }`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          {errorMessage && (
            <div
              data-testid="add-page-error"
              style={{
                padding: '8px 12px',
                marginBottom: SPACING.md,
                backgroundColor: 'rgba(246, 70, 93, 0.10)',
                border: '1px solid rgba(246, 70, 93, 0.28)',
                borderRadius: RADII.sm,
                fontSize: '0.8125rem',
                color: PALETTE.accent3,
              }}
            >
              {errorMessage}
            </div>
          )}

          {step === 'select-account' && (
            <div>
              {isLoadingAccounts ? (
                <div
                  data-testid="loading-accounts-state"
                  style={{
                    padding: SPACING.lg,
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  Loading connected Facebook accounts...
                </div>
              ) : activeAccounts.length === 0 ? (
                <div
                  data-testid="no-active-accounts-notice"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: SPACING.xl,
                  }}
                >
                  <div
                    style={{
                      fontWeight: TYPOGRAPHY.weights.semibold,
                      fontSize: '0.9375rem',
                      color: `var(--text-main, ${THEME.default.text.primary})`,
                      marginBottom: SPACING.xs,
                    }}
                  >
                    No active Facebook accounts connected
                  </div>
                  <p
                    style={{
                      margin: `0 0 ${SPACING.md} 0`,
                      fontSize: '0.8125rem',
                      color: `var(--text-sub, ${THEME.default.text.secondary})`,
                      lineHeight: 1.4,
                      maxWidth: '320px',
                    }}
                  >
                    Connect a Facebook account first so you can discover and add
                    its pages to your workspace.
                  </p>
                  <button
                    type="button"
                    data-testid="go-to-accounts-btn"
                    onClick={handleGoToAccounts}
                    style={{
                      ...COMPONENT_STYLES.primaryButton,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: SPACING.xs,
                    }}
                  >
                    Go to Facebook Accounts
                  </button>
                </div>
              ) : (
                <div
                  data-testid="select-account-list"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {activeAccounts.map((account) => (
                    <AccountOptionItem
                      key={account.id}
                      account={account}
                      onSelect={(acc) => {
                        void handleSelectAccount(acc);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'select-pages' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACING.sm,
              }}
            >
              {isDiscovering ? (
                <div
                  data-testid="discovering-pages-state"
                  style={{
                    padding: SPACING.xl,
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  Finding Facebook Pages on this account...
                </div>
              ) : discoveredPages.length === 0 ? (
                <div
                  data-testid="no-discovered-pages-state"
                  style={{
                    padding: SPACING.xl,
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  No Facebook Pages were found on this account.
                </div>
              ) : (
                <>
                  <DiscoveredPagesToolbar
                    searchQuery={pageSearchQuery}
                    onSearchChange={setPageSearchQuery}
                    totalFound={discoveredPages.length}
                    selectableCount={selectableIds.length}
                    allChecked={allSelectableChecked}
                    onToggleSelectAll={handleSelectAll}
                  />

                  <div
                    data-testid="discovered-pages-list"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      maxHeight: '340px',
                      overflowY: 'auto',
                      borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    }}
                  >
                    {filteredDiscoveredPages.map((page) => (
                      <DiscoveredPageRowItem
                        key={page.fbPageId}
                        page={page}
                        isChecked={
                          page.isImported ||
                          selectedPageIds.includes(page.fbPageId)
                        }
                        onToggle={handleTogglePage}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            data-testid="cancel-add-pages-btn"
            onClick={() => handleDialogOpenChange(false)}
            style={{
              height: '38px',
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
            Cancel
          </button>

          {step === 'select-pages' && (
            <button
              type="button"
              data-testid="confirm-add-pages-btn"
              disabled={selectedPageIds.length === 0 || isSubmitting}
              onClick={() => {
                void handleConfirmImport();
              }}
              style={{
                ...COMPONENT_STYLES.primaryButton,
                opacity:
                  selectedPageIds.length === 0 || isSubmitting ? 0.5 : 1,
                cursor:
                  selectedPageIds.length === 0 || isSubmitting
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {confirmButtonText}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
