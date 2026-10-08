import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type {
  PageInsightsResponse,
  PageInsightsOverview,
  PageInsightsTimeSeriesPoint,
  PageInsightsReactions,
  PageInsightsDemographics,
} from '@fbuploadpro/contracts';
import { OverviewKpiCards } from '../../src/components/insights/kpi-scorecards';
import { GrowthChart } from '../../src/components/insights/growth-chart';
import { VideoMetricsChart } from '../../src/components/insights/video-metrics-chart';
import { ReactionsDistributionCard } from '../../src/components/insights/reactions-chart';
import { DemographicsCard } from '../../src/components/insights/demographics-bars';
import { InsightsHeader } from '../../src/components/insights/insights-header';
import { InsightsAlerts } from '../../src/components/insights/insights-alerts';

const mockOverview: PageInsightsOverview = {
  pageName: 'Tech Innovators',
  pageImage: 'https://example.com/page.jpg',
  fanCount: 24500,
  followersCount: 31200,
  totalMediaViews: 185000,
  totalVideoViews: 92400,
  totalPostEngagements: 14300,
};

const mockTimeSeries: PageInsightsTimeSeriesPoint[] = [
  {
    date: '2026-03-01',
    pageFollows: 30000,
    dailyFollowsUnique: 120,
    dailyUnfollowsUnique: 15,
    mediaViews: 6500,
    videoViews: 3200,
    videoCompleteViews30s: 1450,
    videoViewTimeMinutes: 290,
  },
  {
    date: '2026-03-02',
    pageFollows: 30105,
    dailyFollowsUnique: 150,
    dailyUnfollowsUnique: 20,
    mediaViews: 7100,
    videoViews: 3800,
    videoCompleteViews30s: 1800,
    videoViewTimeMinutes: 340,
  },
];

const mockReactions: PageInsightsReactions = {
  like: 540,
  love: 280,
  wow: 45,
  haha: 60,
  sorry: 8,
  anger: 2,
  total: 935,
};

const mockDemographics: PageInsightsDemographics = {
  topCountries: [
    { name: 'United States', count: 1200, percentage: 48.0 },
    { name: 'United Kingdom', count: 500, percentage: 20.0 },
    { name: 'Canada', count: 350, percentage: 14.0 },
  ],
  topCities: [
    { name: 'New York, NY', count: 420, percentage: 42.0 },
    { name: 'London, UK', count: 280, percentage: 28.0 },
  ],
};

const mockResponse: PageInsightsResponse = {
  success: true,
  fbPageId: 'page_12345',
  dateRange: '28d',
  cachedAt: '2026-03-02T12:00:00Z',
  cacheHit: false,
  overview: mockOverview,
  timeSeries: mockTimeSeries,
  reactions: mockReactions,
  demographics: mockDemographics,
  healthStatus: 'active',
};

describe('User Story 4 - Insights Dashboard UI Components', () => {
  describe('OverviewKpiCards (T168)', () => {
    it('renders key performance metrics accurately', () => {
      const html = renderToString(<OverviewKpiCards overview={mockOverview} />);
      expect(html).toContain('31,200');
      expect(html).toContain('24,500');
      expect(html).toContain('185,000');
      expect(html).toContain('92,400');
      expect(html).toContain('14,300');
      expect(html).toContain('Followers');
      expect(html).toContain('Page Fans');
      expect(html).toContain('Video Views');
    });

    it('renders empty fallback values when overview has 0 values', () => {
      const emptyOverview: PageInsightsOverview = {
        pageName: null,
        pageImage: null,
        fanCount: 0,
        followersCount: 0,
        totalMediaViews: 0,
        totalVideoViews: 0,
        totalPostEngagements: 0,
      };
      const html = renderToString(<OverviewKpiCards overview={emptyOverview} />);
      expect(html).toContain('0');
    });
  });

  describe('GrowthChart (T169)', () => {
    it('renders audience growth time-series visualization', () => {
      const html = renderToString(<GrowthChart data={mockTimeSeries} />);
      expect(html).toContain('Audience Growth &amp; Churn');
      expect(html).toContain('recharts');
    });

    it('renders empty state when time series data is empty', () => {
      const html = renderToString(<GrowthChart data={[]} />);
      expect(html).toContain('No follower growth data available');
    });
  });

  describe('VideoMetricsChart (T170)', () => {
    it('renders video views and retention analytics', () => {
      const html = renderToString(<VideoMetricsChart data={mockTimeSeries} />);
      expect(html).toContain('Video Performance &amp; Retention');
      expect(html).toContain('recharts');
    });

    it('renders empty state when video metrics are empty', () => {
      const html = renderToString(<VideoMetricsChart data={[]} />);
      expect(html).toContain('No video performance data available');
    });
  });

  describe('ReactionsDistributionCard (T171)', () => {
    it('renders sentiment reaction breakdown with percentages', () => {
      const html = renderToString(<ReactionsDistributionCard reactions={mockReactions} />);
      expect(html).toContain('Audience Reactions');
      expect(html).toContain('935');
      expect(html).toContain('540'); // like
      expect(html).toContain('280'); // love
      expect(html).toContain('Like');
      expect(html).toContain('Love');
      expect(html).toContain('Wow');
    });
  });

  describe('DemographicsCard (T171)', () => {
    it('renders top countries and top cities with percentage bars', () => {
      const html = renderToString(<DemographicsCard demographics={mockDemographics} />);
      expect(html).toContain('Audience Demographics');
      expect(html).toContain('United States');
      expect(html).toContain('48%');
      expect(html).toContain('New York, NY');
      expect(html).toContain('42%');
    });

    it('renders empty fallback when demographic data is empty', () => {
      const emptyDemo: PageInsightsDemographics = {
        topCountries: [],
        topCities: [],
      };
      const html = renderToString(<DemographicsCard demographics={emptyDemo} />);
      expect(html).toContain('No demographic data available');
    });
  });

  describe('InsightsHeader & InsightsAlerts (T172)', () => {
    it('renders header with page info, range selector, and back link', () => {
      const onRangeChange = vi.fn();
      const onRefresh = vi.fn();
      const html = renderToString(
        <InsightsHeader
          subdomain="agency1"
          pageId="page_12345"
          pageName="Tech Innovators"
          pageImage="https://example.com/page.jpg"
          dateRange="28d"
          onRangeChange={onRangeChange}
          onRefresh={onRefresh}
          isRefreshing={false}
          cachedAt="2026-03-02T12:00:00Z"
          cacheHit={true}
        />
      );
      expect(html).toContain('Tech Innovators');
      expect(html).toContain('Back to Facebook Channels');
      expect(html).toContain('/tenant/agency1/accounts');
      expect(html).toContain('28d');
      expect(html).toContain('Cached');
    });

    it('renders actionable warning alert when health status is invalid_token', () => {
      const html = renderToString(
        <InsightsAlerts
          healthStatus="invalid_token"
          subdomain="agency1"
        />
      );
      expect(html).toContain('Access Token Expired');
      expect(html).toContain('Reconnect Account');
      expect(html).toContain('/api/auth/facebook?subdomain=agency1');
    });

    it('renders rate limit warning alert when health status is rate_limited', () => {
      const html = renderToString(
        <InsightsAlerts
          healthStatus="rate_limited"
          subdomain="agency1"
        />
      );
      expect(html).toContain('Facebook Rate Limited');
    });

    it('renders nothing when health status is active', () => {
      const html = renderToString(
        <InsightsAlerts
          healthStatus="active"
          subdomain="agency1"
        />
      );
      expect(html).toBe('');
    });
  });

  describe('InsightsLoadingSkeleton (T173)', () => {
    it('renders zero-CLS skeleton placeholder cards', async () => {
      const { default: InsightsLoadingSkeleton } = await import(
        '../../src/app/tenant/[subdomain]/pages/[pageId]/insights/loading'
      );
      const html = renderToString(<InsightsLoadingSkeleton />);
      expect(html).toContain('max-width:1280px');
      expect(html).toContain('border-radius:12px');
    });
  });

  describe('Accounts List "View Insights" Link (T173)', () => {
    it('renders Insights link in connected accounts page', async () => {
      const { default: TenantAccountsPage } = await import(
        '../../src/app/tenant/[subdomain]/accounts/page'
      );

      // Mock fetch returning a connected page
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/tenant/acme/accounts')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ accounts: [] }),
          });
        }
        if (url.includes('/api/tenant/acme/pages')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                pages: [
                  {
                    id: 'page_db_111',
                    fbPageId: 'fb_page_222',
                    pageName: 'Acme Brand',
                    category: 'Brand',
                    followersCount: 5000,
                    status: 'active',
                  },
                ],
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const pageJsx = React.createElement(TenantAccountsPage, {
        params: { subdomain: 'acme' },
      });
      const html = renderToString(pageJsx);
      expect(html).toContain('Facebook Social Channels');
      expect(html).toContain('Discover Pages');
    });
  });

  describe('PageInsightsDashboard Route (T173)', () => {
    it('renders initial insights dashboard loading state or shell', async () => {
      const { default: PageInsightsDashboard } = await import(
        '../../src/app/tenant/[subdomain]/pages/[pageId]/insights/page'
      );

      // Mock fetch returning insights
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/insights')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const pageJsx = React.createElement(PageInsightsDashboard, {
        params: { subdomain: 'acme', pageId: 'page_12345' },
      });
      const html = renderToString(pageJsx);
      expect(html).toContain('max-width:1280px');
    });
  });
});

