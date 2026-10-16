import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
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
    const mockStorage = {
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
    };
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', { localStorage: mockStorage });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Cache TTL Constant', () => {
    it('enforces 15-minute TTL (900,000 milliseconds)', () => {
      expect(INSIGHTS_CACHE_TTL_MS).toBe(15 * 60 * 1000);
      expect(INSIGHTS_CACHE_TTL_MS).toBe(900000);
    });
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

    it('handles localStorage quota or security exception gracefully without throwing', () => {
      const failingStorage = {
        getItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', failingStorage);
      vi.stubGlobal('window', { localStorage: failingStorage });

      expect(() => setCachedInsights(mockPage.id, '28d', mockInsightsData)).not.toThrow();
      expect(() => getCachedInsights(mockPage.id, '28d')).not.toThrow();
      expect(getCachedInsights(mockPage.id, '28d')).toBeNull();
    });
  });

  describe('PageTabInsights Static Markup & Component Contract', () => {
    it('renders initial skeleton loading markup on server / initial mount', () => {
      const html = renderToString(<PageTabInsights page={mockPage} subdomain="acme" />);

      // Verify header controls exist
      expect(html).toContain('data-testid="refresh-insights-btn"');
      expect(html).toContain('Sync');
      expect(html).toContain('28D');
      expect(html).toContain('7D');
      expect(html).toContain('14D');
      expect(html).toContain('90D');
      expect(html).toContain('data-testid="insights-loading"');
    });

    it('renders component successfully without crashing', () => {
      expect(() => {
        renderToString(<PageTabInsights page={mockPage} subdomain="acme" />);
      }).not.toThrow();
    });
  });
});
