/**
 * Add Page flow — pure helpers (spec 131 PR-131-2, spec §8.4
 * decomposition). Extracted verbatim from the former 1,233-line
 * add-page modal: the href builders, the account/page selection
 * computations, and the header/button copy computations. Names and
 * behaviour are preserved exactly — the parity suites
 * (tests/ui/pages.test.tsx) import them (re-exported from
 * `add-page-modal.tsx`), and the flow components consume the same
 * functions.
 */
import { getAccountHealth } from '@/components/accounts/account-health';
import type { FacebookAccountItem } from '@/components/accounts/account-card';

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

export type AddPageStep = 'select-account' | 'select-pages';

export function buildAccountsHref(subdomain: string): string {
  return `/tenant/${subdomain}/accounts`;
}

export function buildSettingsFacebookHref(subdomain: string): string {
  return `/tenant/${subdomain}/settings?tab=byoc`;
}

export function getActiveAccounts(
  accounts: FacebookAccountItem[]
): FacebookAccountItem[] {
  return accounts.filter((acc) => getAccountHealth(acc) === 'connected');
}

export function getExpiredAccounts(
  accounts: FacebookAccountItem[]
): FacebookAccountItem[] {
  return accounts.filter((acc) => getAccountHealth(acc) === 'expired');
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

export function computeConfirmButtonText(
  isSubmitting: boolean,
  selectedCount: number
): string {
  if (isSubmitting) return 'Adding Pages...';
  if (selectedCount === 0) return 'Add Selected Pages';
  const unit = selectedCount === 1 ? 'Page' : 'Pages';
  return `Import ${selectedCount} ${unit}`;
}

export function computeHeaderSubtitle(
  step: AddPageStep,
  accountName?: string | null,
  pagesCount = 0
): string {
  if (step === 'select-account') {
    return 'Choose which connected Facebook account you want to import pages from.';
  }
  const name = accountName || 'Connected Account';
  const unit = pagesCount === 1 ? 'page available' : 'pages available';
  return `${name} · ${pagesCount} ${unit}`;
}

export function filterDiscoveredPages(
  pages: DiscoveredPageItem[],
  query: string
): DiscoveredPageItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return pages;
  return pages.filter(
    (p) =>
      p.pageName.toLowerCase().includes(q) ||
      Boolean(p.category?.toLowerCase().includes(q))
  );
}
