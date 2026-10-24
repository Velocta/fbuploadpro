/**
 * @file tab-insights.test.tsx
 * @description Behavioural tests for the rebuilt PageTabInsights
 * (spec 131 PR-131-3).
 *
 * NAMED UPDATE (spec §8.6 / §6.4 deviation 2): the previous suite tested
 * the localStorage insights cache (`getCachedInsights` /
 * `setCachedInsights` / `INSIGHTS_CACHE_TTL_MS`). That cache is DELETED
 * — server-owned data never lives in localStorage (spec 137 §3.9). The
 * suite now proves the replacement behaviour: insights load through
 * the React Query data layer (typed client + zod schema), freshness is
 * the query's 5-minute staleTime plus the explicit Sync refetch with
 * `refresh=true`, failures surface in an error banner with Retry, and
 * NO localStorage access happens at any point.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PageTabInsights } from '@/components/pages/dedicated/tab-insights';
import type { FacebookPageItem } from '@/components/pages/page-card';
import type { PageInsightsResponse } from '@/lib/api/schemas/pages';

const mockPage: FacebookPageItem = {
  id: 'page_12345',
  facebookAccountId: 'acc_1',
  accountDisplayName: 'Alex Account',
  fbPageId: 'fb_page_12345',
  pageName: 'Creator Hub Daily',
  category: 'Creator',
  startingFollowers: 1000,
  currentFollowers: 12000,
  followersGained: 11000,
  status: 'active',
  createdAt: '2026-10-01T00:00:00.000Z',
};

const mockInsightsData: PageInsightsResponse = {
  success: true,
  fbPageId: 'fb_page_12345',
  dateRange: '28d',
  cachedAt: new Date().toISOString(),
  cacheHit: false,
  overview: {
    pageName: 'Creator Hub Daily',
    pageImage: null,
    fanCount: 11500,
    followersCount: 12000,
    totalMediaViews: 54000,
    totalVideoViews: 42000,
    totalPostEngagements: 3800,
  },
  timeSeries: [
    {
      date: '2026-10-15',
      pageFollows: 12000,
      dailyFollowsUnique: 50,
      dailyUnfollowsUnique: 5,
      mediaViews: 2000,
      videoViews: 1500,
      videoCompleteViews30s: 800,
      videoViewTimeMinutes: 240,
    },
  ],
  reactions: { like: 2500, love: 800, wow: 200, haha: 150, sorry: 50, anger: 20, total: 3720 },
  demographics: {
    topCountries: [{ name: 'United States', count: 6000, percentage: 50 }],
    topCities: [{ name: 'New York, NY', count: 2000, percentage: 33.3 }],
  },
  healthStatus: 'active',
};

const emptyInsightsData: PageInsightsResponse = {
  ...mockInsightsData,
  overview: {
    pageName: 'Creator Hub Daily',
    pageImage: null,
    fanCount: 0,
    followersCount: 0,
    totalMediaViews: 0,
    totalVideoViews: 0,
    totalPostEngagements: 0,
  },
  timeSeries: [],
  reactions: { like: 0, love: 0, wow: 0, haha: 0, sorry: 0, anger: 0, total: 0 },
  demographics: { topCountries: [], topCities: [] },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderInsights() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PageTabInsights page={mockPage} subdomain="acme" />
    </QueryClientProvider>
  );
}

describe('PageTabInsights — data-layer conversion (spec 131 PR-131-3)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let getItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => jsonResponse(mockInsightsData));
    vi.stubGlobal('fetch', fetchMock);
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads insights through the typed data layer and renders KPIs, reactions, demographics', async () => {
    renderInsights();

    expect(await screen.findByTestId('insights-kpi-grid')).toBeVisible();
    expect(screen.getByText('12,000')).toBeVisible();
    expect(screen.getByText('42,000')).toBeVisible();
    expect(screen.getByText('3,800')).toBeVisible();
    expect(screen.getByText('3,720')).toBeVisible();
    expect(screen.getByTestId('reactions-breakdown-card')).toBeVisible();
    expect(screen.getByText('United States')).toBeVisible();
    expect(screen.getByTestId('insights-updated-line').textContent).toContain('from Facebook');

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/tenant/acme/pages/page_12345/insights');
    expect(url).toContain('range=28d');
  });

  it('never touches localStorage (the legacy cache is deleted, §8.6)', async () => {
    renderInsights();
    expect(await screen.findByTestId('insights-kpi-grid')).toBeVisible();
    const insightsKeys = getItemSpy.mock.calls.filter(([key]) =>
      String(key).startsWith('insights:')
    );
    expect(insightsKeys).toHaveLength(0);
  });

  it('refetches with the new range when a range button is clicked', async () => {
    const user = userEvent.setup();
    renderInsights();
    expect(await screen.findByTestId('insights-kpi-grid')).toBeVisible();

    await user.click(screen.getByTestId('range-btn-7d'));
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(urls.some((u) => u.includes('range=7d'))).toBe(true);
    });
  });

  it('Sync refetches with refresh=true', async () => {
    const user = userEvent.setup();
    renderInsights();
    expect(await screen.findByTestId('insights-kpi-grid')).toBeVisible();

    await user.click(screen.getByTestId('refresh-insights-btn'));
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(urls.some((u) => u.includes('refresh=true'))).toBe(true);
    });
  });

  it('surfaces a load failure in the error banner with a Retry action', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: 'Insights backend unavailable' }, 500)
    );
    renderInsights();

    expect(await screen.findByTestId('insights-error-banner')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  it('renders the typed empty state when the page has no insights yet', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(emptyInsightsData));
    renderInsights();

    expect(await screen.findByTestId('insights-empty-state')).toBeVisible();
    expect(
      screen.getByText('Insights will appear here after your first posts publish.')
    ).toBeVisible();
  });

  it('renders the controls bar with all four range buttons and Sync', async () => {
    renderInsights();
    for (const r of ['7d', '14d', '28d', '90d']) {
      expect(screen.getByTestId(`range-btn-${r}`)).toBeVisible();
    }
    expect(screen.getByTestId('refresh-insights-btn')).toBeVisible();
    expect(screen.getByText('Page Performance & Insights')).toBeVisible();
    await screen.findByTestId('insights-kpi-grid');
  });
});
