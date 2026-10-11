'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
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

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent style={{ maxWidth: '540px' }} data-testid="add-page-modal">
        <DialogHeader>
          <DialogTitle>
            {step === 'select-account'
              ? 'Select a Facebook Account'
              : 'Select Facebook Pages to Add'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-account'
              ? 'Choose which connected Facebook account you want to import pages from.'
              : 'Select one or more pages to add to your workspace.'}
          </DialogDescription>
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
                    backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    borderRadius: RADII.md,
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
                    gap: SPACING.sm,
                  }}
                >
                  {activeAccounts.map((account) => {
                    const initials = getInitials(account.displayName, 'FB');
                    const pagesLabel = `${account.connectedPagesCount} ${
                      account.connectedPagesCount === 1
                        ? 'page linked'
                        : 'pages linked'
                    }`;
                    return (
                      <button
                        key={account.id}
                        type="button"
                        data-testid={`select-account-${account.id}`}
                        onClick={() => {
                          void handleSelectAccount(account);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: SPACING.md,
                          padding: SPACING.md,
                          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                          borderRadius: RADII.md,
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'border-color 0.15s ease',
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
                                width: '40px',
                                height: '40px',
                                borderRadius: RADII.full,
                                objectFit: 'cover',
                                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: RADII.full,
                                backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
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
                          style={{
                            color: `var(--text-dim, ${THEME.default.text.muted})`,
                            flexShrink: 0,
                          }}
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 'select-pages' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACING.md,
              }}
            >
              {/* Selected Account Bar + Change Account Back Action */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: SPACING.sm,
                  padding: `${SPACING.sm} ${SPACING.md}`,
                  backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  borderRadius: RADII.sm,
                  fontSize: '0.8125rem',
                }}
              >
                <span
                  style={{
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    fontWeight: TYPOGRAPHY.weights.medium,
                  }}
                >
                  Account:{' '}
                  <strong>
                    {selectedAccount?.displayName || 'Connected Account'}
                  </strong>
                </span>

                <button
                  type="button"
                  data-testid="change-account-btn"
                  onClick={handleBackToAccounts}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: PALETTE.primary,
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Change account
                </button>
              </div>

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
                    backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    borderRadius: RADII.md,
                    fontSize: '0.875rem',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  No Facebook Pages were found on this account.
                </div>
              ) : (
                <>
                  {/* Select All Controls */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: `0 ${SPACING.xs}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: `var(--text-sub, ${THEME.default.text.secondary})`,
                      }}
                    >
                      {discoveredPages.length}{' '}
                      {discoveredPages.length === 1
                        ? 'page found'
                        : 'pages found'}
                    </span>

                    {selectableIds.length > 0 && (
                      <button
                        type="button"
                        data-testid="select-all-pages-btn"
                        aria-pressed={allSelectableChecked}
                        onClick={handleSelectAll}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: PALETTE.primary,
                          fontSize: '0.8125rem',
                          fontWeight: TYPOGRAPHY.weights.semibold,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Select All
                      </button>
                    )}
                  </div>

                  {/* Discovered Pages Multi-Select List */}
                  <div
                    data-testid="discovered-pages-list"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACING.xs,
                    }}
                  >
                    {discoveredPages.map((page) => {
                      const isChecked =
                        page.isImported ||
                        selectedPageIds.includes(page.fbPageId);
                      const followers =
                        page.currentFollowers ?? page.followersCount ?? 0;

                      return (
                        <label
                          key={page.fbPageId}
                          data-testid={`discovered-page-row-${page.fbPageId}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: SPACING.md,
                            padding: SPACING.sm,
                            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                            border:
                              !page.isImported && isChecked
                                ? `1px solid ${PALETTE.primary}`
                                : `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                            borderRadius: RADII.sm,
                            cursor: page.isImported
                              ? 'default'
                              : 'pointer',
                            opacity: page.isImported ? 0.65 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            data-testid={`discovered-page-checkbox-${page.fbPageId}`}
                            checked={isChecked}
                            disabled={page.isImported}
                            onChange={() => {
                              if (!page.isImported) {
                                handleTogglePage(page.fbPageId);
                              }
                            }}
                            style={{
                              width: '16px',
                              height: '16px',
                              accentColor: PALETTE.primary,
                              cursor: page.isImported
                                ? 'not-allowed'
                                : 'pointer',
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
                              {page.category || 'Facebook Page'} •{' '}
                              {followers.toLocaleString('en-US')} followers
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
                    })}
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
              {isSubmitting ? 'Adding Pages...' : 'Add Selected Pages'}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
