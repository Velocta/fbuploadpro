import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
  PageTabInsights,
  getCachedInsights,
  setCachedInsights,
  INSIGHTS_CACHE_TTL_MS,
} from '../../src/components/pages/dedicated/tab-insights';
import type { PageInsightsResponse } from '@fbuploadpro/contracts';

const mockPage = {
  id: 'page_12345',
  facebookAccountId: 'acc_1',
  accountDisplayName: 'Alex Account',
  fbPageId: 'fb_page_12345',
  pageName: 'Creator Hub Daily',
  category: 'Creator',
  startingFollowers: 1000,
  currentFollowers: 12000,
  followersGained: 11000,
  status: 'active' as const,
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
  reactions: {
    like: 2500,
    love: 800,
    wow: 200,
    haha: 150,
    sorry: 50,
    anger: 20,
    total: 3720,
  },
  demographics: {
    topCountries: [{ name: 'United States', count: 6000, percentage: 50 }],
    topCities: [{ name: 'New York, NY', count: 2000, percentage: 33.3 }],
  },
  healthStatus: 'active',
};

describe('PageTabInsights Client-Side LocalStorage Caching (Spec 062)', () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getCachedInsights and setCachedInsights Helper Functions', () => {
    it('saves insights in localStorage with 15-minute expiration timestamp', () => {
      const now = 1000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      setCachedInsights(mockPage.id, '28d', mockInsightsData);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `insights:${mockPage.id}:28d`,
        expect.stringContaining('"expiresAt":1900000') // 1000000 + 900000ms
      );
    });

    it('returns cached data if still within 15-minute expiration window', () => {
      const now = 1000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      setCachedInsights(mockPage.id, '28d', mockInsightsData);

      // Advance by 10 minutes (less than 15 min TTL)
      vi.spyOn(Date, 'now').mockReturnValue(now + 10 * 60 * 1000);

      const cached = getCachedInsights(mockPage.id, '28d');
      expect(cached).toBeDefined();
      expect(cached?.overview.followersCount).toBe(12000);
      expect(cached?.fbPageId).toBe('fb_page_12345');
    });

    it('returns null if cached entry has expired (> 15 minutes)', () => {
      const now = 1000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      setCachedInsights(mockPage.id, '28d', mockInsightsData);

      // Advance by 16 minutes (exceeds 15 min TTL)
      vi.spyOn(Date, 'now').mockReturnValue(now + 16 * 60 * 1000);

      const cached = getCachedInsights(mockPage.id, '28d');
      expect(cached).toBeNull();
    });

    it('gracefully handles corrupted JSON in localStorage by removing the entry and returning null', () => {
      localStorageMock[`insights:${mockPage.id}:28d`] = 'invalid-non-json';

      const cached = getCachedInsights(mockPage.id, '28d');
      expect(cached).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(`insights:${mockPage.id}:28d`);
    });
  });

  describe('PageTabInsights Component Rendering & Lifecycle', () => {
    it('renders cached data immediately without issuing a network call when unexpired cache exists', async () => {
      const now = 1000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      setCachedInsights(mockPage.id, '28d', mockInsightsData);

      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      render(<PageTabInsights page={mockPage} subdomain="acme" />);

      // Should render numbers directly from localStorage cache
      await waitFor(() => {
        expect(screen.getByText('12,000')).toBeInTheDocument();
        expect(screen.getByText('42,000')).toBeInTheDocument();
        expect(screen.getByText('3,720')).toBeInTheDocument();
      });

      // Assert zero network requests made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetches from API when cache is missing, renders metrics, and saves to localStorage', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockInsightsData),
      });
      vi.stubGlobal('fetch', mockFetch);

      render(<PageTabInsights page={mockPage} subdomain="acme" />);

      // Loading skeleton should appear initially
      expect(screen.getByTestId('insights-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('12,000')).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/tenant/acme/pages/${mockPage.id}/insights?range=28d`
      );

      // Verified saved to localStorage
      expect(localStorage.setItem).toHaveBeenCalledWith(
        `insights:${mockPage.id}:28d`,
        expect.stringContaining('"followersCount":12000')
      );
    });

    it('bypasses localStorage cache and issues live fetch when Sync button is clicked', async () => {
      // Seed cache
      setCachedInsights(mockPage.id, '28d', mockInsightsData);

      const freshData: PageInsightsResponse = {
        ...mockInsightsData,
        overview: {
          ...mockInsightsData.overview,
          followersCount: 14500,
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(freshData),
      });
      vi.stubGlobal('fetch', mockFetch);

      render(<PageTabInsights page={mockPage} subdomain="acme" />);

      // Initially displays cached 12,000
      expect(await screen.findByText('12,000')).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();

      // Click manual Sync button
      const syncBtn = screen.getByTestId('refresh-insights-btn');
      fireEvent.click(syncBtn);

      // Verify network request includes refresh=true
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/tenant/acme/pages/${mockPage.id}/insights?range=28d&refresh=true`
      );

      // Verify fresh numbers render
      await waitFor(() => {
        expect(screen.getByText('14,500')).toBeInTheDocument();
      });

      // Verify localStorage was updated with fresh numbers
      expect(localStorage.setItem).toHaveBeenCalledWith(
        `insights:${mockPage.id}:28d`,
        expect.stringContaining('"followersCount":14500')
      );
    });

    it('switches ranges and fetches or reads corresponding range cache', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...mockInsightsData, dateRange: '7d' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      render(<PageTabInsights page={mockPage} subdomain="acme" />);

      // Switch to 7D
      const btn7d = screen.getByTestId('range-btn-7d');
      fireEvent.click(btn7d);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/tenant/acme/pages/${mockPage.id}/insights?range=7d`
        );
      });
    });
  });
});
