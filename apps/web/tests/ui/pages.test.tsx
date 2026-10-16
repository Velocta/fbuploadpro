/**
 * @file pages.test.tsx
 * @description Comprehensive UI & behavioral tests for Spec 032:
 * Dedicated Facebook Pages Management Section, Follower Growth Tracking & Two-Step Page Import.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { THEME, LIGHT_THEME, PALETTE } from '@/lib/theme';
import {
  PageCard,
  computeFollowersGained,
  formatFollowersGained,
  getPageAttentionMessage,
  getPageStatusLabel,
  getPageStatusColor,
  getPageStatusRingBorder,
  isPageNeedsAttention,
  type FacebookPageItem,
} from '@/components/pages/page-card';
import { PagesEmptyState } from '@/components/pages/pages-empty-state';
import {
  AddPageModal,
  getActiveAccounts,
  getSelectablePageIds,
  toggleSelectAllPages,
  type DiscoveredPageItem,
} from '@/components/pages/add-page-modal';
import TenantPagesPage, {
  PagesScaleToolbar,
  filterPagesList,
  sortPagesAttentionFirst,
} from '@/app/tenant/[subdomain]/pages/page';
import TenantDedicatedPageView from '@/app/tenant/[subdomain]/pages/[pageId]/page';
import type { FacebookAccountItem } from '@/components/accounts/account-card';
import { render } from '../components/setup';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useParams: () => ({
    subdomain: 'acme',
    pageId: 'page-uuid-1',
  }),
}));

/**
 * Helper to execute a functional component inside React's server render dispatcher
 * and recursively locate elements by `data-testid` so real event handlers
 * (`onClick`, `onKeyDown`, `onChange`) can be invoked directly.
 */
function findElementByTestId(
  node: React.ReactNode,
  testId: string
): React.ReactElement<Record<string, any>> | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByTestId(child, testId);
      if (found) return found;
    }
    return null;
  }
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, any>;
    if (props['data-testid'] === testId) {
      return node as React.ReactElement<Record<string, any>>;
    }
    if (props.children) {
      return findElementByTestId(props.children, testId);
    }
  }
  return null;
}

function renderAndCaptureTree(
  renderFn: () => React.ReactElement
): React.ReactElement {
  let tree: React.ReactElement | null = null;
  function CaptureWrapper() {
    tree = renderFn();
    return tree;
  }
  render(<CaptureWrapper />);
  if (!tree) {
    throw new Error('Failed to capture React element tree');
  }
  return tree;
}

describe('Facebook Pages UI Suite (Spec 032)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  const baseActivePage: FacebookPageItem = {
    id: 'page-uuid-1',
    facebookAccountId: 'acc-1',
    accountDisplayName: 'Sarah Connor',
    fbPageId: 'fb_page_101',
    pageName: 'Cyberdyne Reels',
    profilePictureUrl: 'https://graph.facebook.com/v26.0/p101/picture',
    category: 'Science and Tech',
    startingFollowers: 10000,
    currentFollowers: 11200,
    followersGained: 1200,
    status: 'active',
    tasks: ['CREATE_CONTENT', 'MANAGE'],
    createdAt: '2026-10-05T12:00:00.000Z',
  };

  const zeroGrowthPage: FacebookPageItem = {
    ...baseActivePage,
    id: 'page-uuid-zero',
    fbPageId: 'fb_page_102',
    pageName: 'Steady Daily Clips',
    profilePictureUrl: null,
    startingFollowers: 5400,
    currentFollowers: 5400,
    followersGained: 0,
  };

  const negativeGrowthPage: FacebookPageItem = {
    ...baseActivePage,
    id: 'page-uuid-neg',
    fbPageId: 'fb_page_103',
    pageName: 'Resistance Archives',
    startingFollowers: 8000,
    currentFollowers: 7650,
    followersGained: -350,
    status: 'paused',
  };

  const sampleActiveAccount: FacebookAccountItem = {
    id: 'acc-1',
    fbAccountId: 'fb_user_1',
    displayName: 'Sarah Connor',
    profilePictureUrl: 'https://graph.facebook.com/v26.0/u1/picture',
    status: 'active',
    connectedPagesCount: 2,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const sampleExpiredAccount: FacebookAccountItem = {
    id: 'acc-expired',
    fbAccountId: 'fb_user_2',
    displayName: 'John Doe',
    profilePictureUrl: null,
    status: 'expired',
    connectedPagesCount: 1,
    createdAt: '2026-09-15T00:00:00.000Z',
  };

  describe('PageCard Component', () => {
    it('renders avatar, page name, category, currentFollowers, positive followersGained (+1,200), parent account name, and Active status', () => {
      const { hasText, hasAttribute, html } = render(
        <PageCard page={baseActivePage} subdomain="acme" />
      );

      expect(hasAttribute('data-testid', 'page-card-page-uuid-1')).toBe(true);
      expect(hasAttribute('data-testid', 'page-avatar-img')).toBe(true);
      expect(hasAttribute('data-testid', 'page-name')).toBe(true);
      expect(hasText('Cyberdyne Reels')).toBe(true);
      expect(hasAttribute('data-testid', 'page-category')).toBe(true);
      expect(hasText('Science and Tech')).toBe(true);
      expect(hasAttribute('data-testid', 'page-current-followers')).toBe(true);
      expect(hasText('11,200')).toBe(true);
      expect(hasAttribute('data-testid', 'page-followers-gained')).toBe(true);
      expect(hasText('+1,200')).toBe(true);
      expect(hasAttribute('data-testid', 'page-parent-account')).toBe(true);
      expect(hasText('Account: Sarah Connor')).toBe(true);
      expect(hasAttribute('data-testid', 'page-status')).toBe(true);
      expect(hasText('Active')).toBe(true);
      expect(html).toContain(PALETTE.accent4);
      expect(hasAttribute('data-testid', 'page-attention-banner')).toBe(false);
    });

    it('falls back to monogram initials when profilePictureUrl is missing or image errors (forceAvatarError)', () => {
      const noAvatarRender = render(
        <PageCard page={zeroGrowthPage} subdomain="acme" />
      );
      expect(noAvatarRender.hasAttribute('data-testid', 'page-avatar-initials')).toBe(true);
      expect(noAvatarRender.hasText('SD')).toBe(true);

      const errorAvatarRender = render(
        <PageCard
          page={baseActivePage}
          subdomain="acme"
          forceAvatarError={true}
        />
      );
      expect(errorAvatarRender.hasAttribute('data-testid', 'page-avatar-initials')).toBe(true);
      expect(errorAvatarRender.hasAttribute('data-testid', 'page-avatar-img')).toBe(false);
      expect(errorAvatarRender.hasText('CR')).toBe(true);
    });

    it('renders zero followersGained ("0") and negative followersGained ("-350" when currentFollowers < startingFollowers)', () => {
      const zeroRender = render(
        <PageCard page={zeroGrowthPage} subdomain="acme" />
      );
      expect(zeroRender.hasText('5,400')).toBe(true);
      expect(zeroRender.hasText('0')).toBe(true);

      // Verify negative followersGained both from explicit field and computed fallback
      const computedNegativePage: FacebookPageItem = {
        ...negativeGrowthPage,
        followersGained: computeFollowersGained({
          startingFollowers: 8000,
          currentFollowers: 7650,
        }),
      };
      expect(computedNegativePage.followersGained).toBe(-350);
      expect(formatFollowersGained(-350)).toBe('-350');

      const negRender = render(
        <PageCard page={computedNegativePage} subdomain="acme" />
      );
      expect(negRender.hasText('7,650')).toBe(true);
      expect(negRender.hasText('-350')).toBe(true);
      expect(negRender.html).toContain(PALETTE.accent3);
    });

    it('highlights attention-needed statuses (invalid_token, page_checkpoint, fb_rate_limited) with red/rose border and page-attention-banner', () => {
      const attentionStatuses: Array<{
        status: FacebookPageItem['status'];
        expectedLabel: string;
        expectedBannerSnippet: string;
      }> = [
        {
          status: 'invalid_token',
          expectedLabel: 'Token Expired',
          expectedBannerSnippet:
            'Token Expired — Reconnect the parent Facebook account to resume publishing.',
        },
        {
          status: 'page_checkpoint',
          expectedLabel: 'Identity Checkpoint',
          expectedBannerSnippet:
            'Identity Checkpoint — Confirm page identity on Facebook mobile to resume.',
        },
        {
          status: 'fb_rate_limited',
          expectedLabel: 'Rate Limited',
          expectedBannerSnippet:
            'Rate Limited — Facebook temporarily restricted posting',
        },
      ];

      for (const item of attentionStatuses) {
        expect(isPageNeedsAttention(item.status)).toBe(true);
        expect(getPageStatusLabel(item.status)).toBe(item.expectedLabel);
        expect(getPageAttentionMessage(item.status)).toContain(
          item.expectedBannerSnippet
        );

        const { hasAttribute, hasText, hasStyle } = render(
          <PageCard
            page={{ ...baseActivePage, status: item.status }}
            subdomain="acme"
          />
        );

        expect(hasAttribute('data-testid', 'page-attention-banner')).toBe(true);
        expect(hasText(item.expectedLabel)).toBe(true);
        expect(hasText(item.expectedBannerSnippet)).toBe(true);
        expect(hasStyle('border', `1px solid ${PALETTE.accent3}`)).toBe(true);
      }
    });

    it('renders pure typographic status without bullet dot and applies dynamic status ring to avatar across all statuses', () => {
      const allStatuses: Array<{
        status: FacebookPageItem['status'];
        expectedColor: string;
        expectedRing: string;
      }> = [
        {
          status: 'active',
          expectedColor: PALETTE.accent4,
          expectedRing: `1.5px solid ${PALETTE.accent4}`,
        },
        {
          status: 'paused',
          expectedColor: PALETTE.primary,
          expectedRing: `1.5px solid ${PALETTE.primary}`,
        },
        {
          status: 'invalid_token',
          expectedColor: PALETTE.accent3,
          expectedRing: `1.5px solid ${PALETTE.accent3}`,
        },
        {
          status: 'page_checkpoint',
          expectedColor: PALETTE.accent3,
          expectedRing: `1.5px solid ${PALETTE.accent3}`,
        },
        {
          status: 'fb_rate_limited',
          expectedColor: PALETTE.accent3,
          expectedRing: `1.5px solid ${PALETTE.accent3}`,
        },
        {
          status: 'disconnected',
          expectedColor: `var(--text-dim, ${THEME.default.text.muted})`,
          expectedRing: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        },
      ];

      for (const item of allStatuses) {
        expect(getPageStatusColor(item.status)).toBe(item.expectedColor);
        expect(getPageStatusRingBorder(item.status)).toBe(item.expectedRing);

        const { html, hasText } = render(
          <PageCard
            page={{ ...baseActivePage, status: item.status }}
            subdomain="acme"
          />
        );

        // Verify pure typographic status without any bullet/dot character
        expect(html).not.toContain('●');
        expect(html).not.toContain('•');
        expect(hasText(getPageStatusLabel(item.status))).toBe(true);

        // Verify avatar border ring is present in rendered HTML
        expect(html).toContain(item.expectedRing);
      }
    });

    it('navigates to /tenant/{subdomain}/pages/{pageId} on click or Enter/Space key press', () => {
      const selectedPaths: string[] = [];
      const tree = renderAndCaptureTree(() =>
        PageCard({
          page: baseActivePage,
          subdomain: 'acme',
          onSelectPage: (p) => selectedPaths.push(`/tenant/acme/pages/${p.id}`),
        })
      );

      const cardEl = findElementByTestId(tree, 'page-card-page-uuid-1');
      expect(cardEl).not.toBeNull();
      expect(cardEl?.props['data-href']).toBe('/tenant/acme/pages/page-uuid-1');

      // Click activation
      cardEl?.props.onClick();
      expect(selectedPaths).toEqual(['/tenant/acme/pages/page-uuid-1']);

      // Enter key activation
      const enterPreventDefault = vi.fn();
      cardEl?.props.onKeyDown({
        key: 'Enter',
        preventDefault: enterPreventDefault,
      });
      expect(enterPreventDefault).toHaveBeenCalledTimes(1);
      expect(selectedPaths).toHaveLength(2);

      // Space key activation
      const spacePreventDefault = vi.fn();
      cardEl?.props.onKeyDown({
        key: ' ',
        preventDefault: spacePreventDefault,
      });
      expect(spacePreventDefault).toHaveBeenCalledTimes(1);
      expect(selectedPaths).toHaveLength(3);
    });
  });

  describe('AddPageModal (Two-Step Flow)', () => {
    const sampleDiscoveredPages: DiscoveredPageItem[] = [
      {
        fbPageId: 'fb_page_101',
        pageName: 'Cyberdyne Reels',
        profilePictureUrl: 'https://graph.facebook.com/v26.0/p101/picture',
        category: 'Science & Tech',
        currentFollowers: 11200,
        isImported: true,
      },
      {
        fbPageId: 'fb_page_202',
        pageName: 'Skynet AI Daily',
        profilePictureUrl: null,
        category: 'Automation Service',
        currentFollowers: 4300,
        isImported: false,
      },
      {
        fbPageId: 'fb_page_303',
        pageName: 'Future Robotics Hub',
        profilePictureUrl: null,
        category: 'Robotics',
        currentFollowers: 8900,
        isImported: false,
      },
    ];

    it('Step 1 renders active connected Facebook accounts and filters out expired accounts', () => {
      const accounts = [sampleActiveAccount, sampleExpiredAccount];
      expect(getActiveAccounts(accounts)).toEqual([sampleActiveAccount]);

      const { hasText, hasAttribute } = render(
        <AddPageModal
          subdomain="acme"
          open={true}
          onOpenChange={vi.fn()}
          accounts={accounts}
        />
      );

      expect(hasText('Select a Facebook Account')).toBe(true);
      expect(hasAttribute('data-testid', 'select-account-list')).toBe(true);
      expect(hasAttribute('data-testid', 'select-account-acc-1')).toBe(true);
      expect(hasText('Sarah Connor')).toBe(true);
      expect(hasText('2 pages linked')).toBe(true);
      // Expired account should not be listed as an active import source
      expect(hasAttribute('data-testid', 'select-account-acc-expired')).toBe(false);
    });

    it('Step 1 shows "No active Facebook accounts connected" notice when 0 active accounts exist', () => {
      const onNavigateToAccounts = vi.fn();
      const { hasText, hasAttribute } = render(
        <AddPageModal
          subdomain="acme"
          open={true}
          onOpenChange={vi.fn()}
          accounts={[sampleExpiredAccount]}
          onNavigateToAccounts={onNavigateToAccounts}
        />
      );

      expect(hasAttribute('data-testid', 'no-active-accounts-notice')).toBe(true);
      expect(hasText('No active Facebook accounts connected')).toBe(true);
      expect(hasAttribute('data-testid', 'go-to-accounts-btn')).toBe(true);
    });

    it('selecting an account in Step 1 queries GET /api/tenant/{subdomain}/accounts/{accountId}/pages/discover and transitions to Step 2', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accountId: sampleActiveAccount.id,
            accountDisplayName: sampleActiveAccount.displayName,
            pages: sampleDiscoveredPages,
            total: sampleDiscoveredPages.length,
          }),
          { status: 200 }
        )
      );
      global.fetch = fetchMock;

      const tree = renderAndCaptureTree(() =>
        AddPageModal({
          subdomain: 'acme',
          open: true,
          onOpenChange: vi.fn(),
          accounts: [sampleActiveAccount],
        })
      );

      const selectAccountBtn = findElementByTestId(
        tree,
        'select-account-acc-1'
      );
      expect(selectAccountBtn).not.toBeNull();

      await selectAccountBtn?.props.onClick();
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/tenant/acme/accounts/acc-1/pages/discover'
      );
    });

    it('Step 2 displays discovered pages, marks isImported: true pages as "Already added", supports individual selection and "Select All", and submits POST /api/tenant/{subdomain}/pages/import', async () => {
      const step2Render = render(
        <AddPageModal
          subdomain="acme"
          open={true}
          onOpenChange={vi.fn()}
          accounts={[sampleActiveAccount]}
          initialStep="select-pages"
          initialSelectedAccount={sampleActiveAccount}
          initialDiscoveredPages={sampleDiscoveredPages}
          initialSelectedPageIds={['fb_page_202']}
        />
      );

      expect(step2Render.hasText('Select Facebook Pages to Add')).toBe(true);
      expect(step2Render.hasAttribute('data-testid', 'discovered-pages-list')).toBe(true);
      expect(step2Render.hasAttribute('data-testid', 'select-all-pages-btn')).toBe(true);

      // Imported page is marked "Already added" and its checkbox is disabled + checked
      expect(
        step2Render.hasAttribute('data-testid', 'already-added-fb_page_101')
      ).toBe(true);
      expect(step2Render.hasText('Already added')).toBe(true);

      // Verify Select All toggle logic excludes already-imported pages
      expect(getSelectablePageIds(sampleDiscoveredPages)).toEqual([
        'fb_page_202',
        'fb_page_303',
      ]);
      const allSelected = toggleSelectAllPages(sampleDiscoveredPages, [
        'fb_page_202',
      ]);
      expect(allSelected).toEqual(['fb_page_202', 'fb_page_303']);
      const deselectedAll = toggleSelectAllPages(
        sampleDiscoveredPages,
        allSelected
      );
      expect(deselectedAll).toEqual([]);

      // Verify submitting selected pages calls POST /api/tenant/acme/pages/import
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            importedCount: 2,
            pages: [
              { id: 'p-202', fbPageId: 'fb_page_202', pageName: 'Skynet AI Daily' },
              {
                id: 'p-303',
                fbPageId: 'fb_page_303',
                pageName: 'Future Robotics Hub',
              },
            ],
          }),
          { status: 200 }
        )
      );
      global.fetch = fetchMock;

      const onSuccess = vi.fn();
      const onOpenChange = vi.fn();

      const tree = renderAndCaptureTree(() =>
        AddPageModal({
          subdomain: 'acme',
          open: true,
          onOpenChange,
          accounts: [sampleActiveAccount],
          onSuccess,
          initialStep: 'select-pages',
          initialSelectedAccount: sampleActiveAccount,
          initialDiscoveredPages: sampleDiscoveredPages,
          initialSelectedPageIds: ['fb_page_202', 'fb_page_303'],
        })
      );

      const confirmBtn = findElementByTestId(tree, 'confirm-add-pages-btn');
      expect(confirmBtn).not.toBeNull();
      expect(confirmBtn?.props.disabled).toBe(false);

      confirmBtn?.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchMock).toHaveBeenCalledWith('/api/tenant/acme/pages/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc-1',
          selectedPageIds: ['fb_page_202', 'fb_page_303'],
        }),
      });
      expect(onSuccess).toHaveBeenCalledWith(2);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('TenantPagesPage (/tenant/[subdomain]/pages/page.tsx)', () => {
    const pageActive1: FacebookPageItem = {
      ...baseActivePage,
      id: 'p-active-1',
      pageName: 'Alpha Page',
      status: 'active',
      createdAt: '2026-10-01T10:00:00.000Z',
    };
    const pagePaused: FacebookPageItem = {
      ...baseActivePage,
      id: 'p-paused-1',
      pageName: 'Beta Paused Page',
      status: 'paused',
      createdAt: '2026-10-02T10:00:00.000Z',
    };
    const pageInvalidToken: FacebookPageItem = {
      ...baseActivePage,
      id: 'p-invalid-token',
      pageName: 'Gamma Expired Page',
      status: 'invalid_token',
      createdAt: '2026-10-03T10:00:00.000Z',
    };
    const pageCheckpoint: FacebookPageItem = {
      ...baseActivePage,
      id: 'p-checkpoint',
      pageName: 'Delta Checkpoint Page',
      status: 'page_checkpoint',
      createdAt: '2026-10-04T10:00:00.000Z',
    };
    const pageRateLimited: FacebookPageItem = {
      ...baseActivePage,
      id: 'p-rate-limited',
      pageName: 'Epsilon Rate Limited Page',
      accountDisplayName: 'Marcus Wright',
      facebookAccountId: 'acc-2',
      status: 'fb_rate_limited',
      createdAt: '2026-10-05T10:00:00.000Z',
    };

    it('renders PagesEmptyState when 0 pages exist', () => {
      const { hasAttribute, hasText } = render(
        <TenantPagesPage
          subdomainProp="acme"
          initialPages={[]}
          initialAccounts={[sampleActiveAccount]}
        />
      );

      expect(hasAttribute('data-testid', 'pages-empty-state')).toBe(true);
      expect(hasText('No Facebook Pages added yet')).toBe(true);
      expect(hasAttribute('data-testid', 'empty-state-add-page-btn')).toBe(true);
      expect(hasAttribute('data-testid', 'pages-scale-toolbar')).toBe(false);
    });

    it('pins attention-needed pages (invalid_token, page_checkpoint, fb_rate_limited) above paused and active pages', () => {
      const inputPages = [
        pageActive1,
        pagePaused,
        pageInvalidToken,
        pageCheckpoint,
      ];
      const sorted = sortPagesAttentionFirst(inputPages);
      expect(sorted.map((p) => p.id)).toEqual([
        'p-checkpoint',
        'p-invalid-token',
        'p-paused-1',
        'p-active-1',
      ]);

      // With 4 pages (<= 4), scale toolbar is hidden and attention cards render first in the DOM
      const { html, hasAttribute } = render(
        <TenantPagesPage
          subdomainProp="acme"
          initialPages={inputPages}
          initialAccounts={[sampleActiveAccount]}
        />
      );

      expect(hasAttribute('data-testid', 'pages-scale-toolbar')).toBe(false);
      const checkpointIdx = html.indexOf('Delta Checkpoint Page');
      const invalidIdx = html.indexOf('Gamma Expired Page');
      const pausedIdx = html.indexOf('Beta Paused Page');
      const activeIdx = html.indexOf('Alpha Page');

      expect(checkpointIdx).toBeGreaterThan(-1);
      expect(invalidIdx).toBeGreaterThan(checkpointIdx);
      expect(pausedIdx).toBeGreaterThan(invalidIdx);
      expect(activeIdx).toBeGreaterThan(pausedIdx);
    });

    it('renders scale toolbar (pages-scale-toolbar, search input, status filter tabs, and account filter) when pages.length > 4', () => {
      const fivePages = [
        pageActive1,
        pagePaused,
        pageInvalidToken,
        pageCheckpoint,
        pageRateLimited,
      ];

      const { hasAttribute, hasText } = render(
        <TenantPagesPage
          subdomainProp="acme"
          initialPages={fivePages}
          initialAccounts={[sampleActiveAccount]}
        />
      );

      expect(hasAttribute('data-testid', 'pages-scale-toolbar')).toBe(true);
      expect(hasAttribute('data-testid', 'pages-search-input')).toBe(true);
      expect(hasAttribute('data-testid', 'pages-filter-all')).toBe(true);
      expect(hasAttribute('data-testid', 'pages-filter-active')).toBe(true);
      expect(
        hasAttribute('data-testid', 'pages-filter-needs-attention')
      ).toBe(true);
      expect(hasAttribute('data-testid', 'pages-filter-paused')).toBe(true);
      expect(hasAttribute('data-testid', 'pages-account-filter')).toBe(true);
      expect(hasText('Sarah Connor')).toBe(true);
      expect(hasText('Marcus Wright')).toBe(true);

      // Verify filterPagesList logic across search, status tabs, and account filter
      expect(
        filterPagesList(fivePages, 'epsilon', 'all', 'all').map((p) => p.id)
      ).toEqual(['p-rate-limited']);
      expect(
        filterPagesList(fivePages, '', 'needs_attention', 'all').map((p) => p.id)
      ).toEqual(['p-invalid-token', 'p-checkpoint', 'p-rate-limited']);
      expect(
        filterPagesList(fivePages, '', 'active', 'all').map((p) => p.id)
      ).toEqual(['p-active-1']);
      expect(
        filterPagesList(fivePages, '', 'paused', 'all').map((p) => p.id)
      ).toEqual(['p-paused-1']);
      expect(
        filterPagesList(fivePages, '', 'all', 'Marcus Wright').map((p) => p.id)
      ).toEqual(['p-rate-limited']);
    });

    it('renders live situational subtitle based on page operational health and active filter states (Spec 050)', () => {
      // 1. Attention needed scenario (3 of 5 require reconnecting)
      const fivePages = [
        pageActive1,
        pagePaused,
        pageInvalidToken,
        pageCheckpoint,
        pageRateLimited,
      ];
      const attentionRender = render(
        <TenantPagesPage
          subdomainProp="acme"
          initialPages={fivePages}
          initialAccounts={[sampleActiveAccount]}
        />
      );
      expect(
        attentionRender.hasAttribute('data-testid', 'pages-page-subtitle')
      ).toBe(true);
      expect(
        attentionRender.hasText('5 connected pages · 3 require reconnecting')
      ).toBe(true);

      // 2. All operational scenario
      const healthyPages = [pageActive1, pagePaused];
      const healthyRender = render(
        <TenantPagesPage
          subdomainProp="acme"
          initialPages={healthyPages}
          initialAccounts={[sampleActiveAccount]}
        />
      );
      expect(
        healthyRender.hasText('2 connected pages · All operational')
      ).toBe(true);
    });

    it('validates light mode canvas contrast token is #f6f8fa and panel is #ffffff (Spec 050)', () => {
      expect(LIGHT_THEME.surfaces.canvas).toBe('#f6f8fa');
      expect(LIGHT_THEME.surfaces.panel).toBe('#ffffff');
      expect(LIGHT_THEME.surfaces.canvas).not.toBe(LIGHT_THEME.surfaces.panel);
    });
  });

  describe('TenantDedicatedPageView (/tenant/[subdomain]/pages/[pageId]/page.tsx)', () => {
    it('renders the dedicated page placeholder (dedicated-page-placeholder) and "Back to Pages" navigation (back-to-pages-btn)', () => {
      const { hasAttribute, hasText } = render(
        <TenantDedicatedPageView
          subdomainProp="acme"
          pageIdProp="page-uuid-1"
          pageNameProp="Cyberdyne Reels"
        />
      );

      expect(hasAttribute('data-testid', 'dedicated-page-placeholder')).toBe(
        true
      );
      expect(hasAttribute('data-testid', 'back-to-pages-btn')).toBe(true);
      expect(hasText('Back to Pages')).toBe(true);
      expect(hasText('Cyberdyne Reels')).toBe(true);
      expect(hasText('Page reference: page-uuid-1')).toBe(true);
      expect(hasText('Dedicated Page Management Workspace')).toBe(true);

      // Verify clicking "Back to Pages" navigates to /tenant/acme/pages
      const tree = renderAndCaptureTree(() =>
        TenantDedicatedPageView({
          subdomainProp: 'acme',
          pageIdProp: 'page-uuid-1',
          pageNameProp: 'Cyberdyne Reels',
        })
      );
      const backBtn = findElementByTestId(tree, 'back-to-pages-btn');
      expect(backBtn).not.toBeNull();
      expect(backBtn?.props.href).toBe('/tenant/acme/pages');

      const preventDefault = vi.fn();
      backBtn?.props.onClick({ preventDefault });
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/tenant/acme/pages');
    });
  });

  describe('PagesEmptyState Component', () => {
    it('invokes onAddPage when the empty state Add Page button is clicked', () => {
      const onAddPage = vi.fn();
      const tree = renderAndCaptureTree(() =>
        PagesEmptyState({ onAddPage })
      );
      const btn = findElementByTestId(tree, 'empty-state-add-page-btn');
      expect(btn).not.toBeNull();
      btn?.props.onClick();
      expect(onAddPage).toHaveBeenCalledTimes(1);
    });
  });
});
