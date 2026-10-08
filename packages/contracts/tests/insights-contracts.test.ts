import { describe, it, expect } from 'vitest';
import {
  PageInsightsRangeSchema,
  PageInsightsOverviewSchema,
  PageInsightsTimeSeriesPointSchema,
  PageInsightsReactionsSchema,
  DemographicItemSchema,
  PageInsightsDemographicsSchema,
  PageInsightsResponseSchema,
  PageInsightsQuerySchema,
} from '../src/index.js';

describe('Facebook Page Insights Domain Contracts (T148, T149)', () => {
  describe('PageInsightsRangeSchema', () => {
    it('accepts valid predefined date ranges', () => {
      expect(PageInsightsRangeSchema.safeParse('7d').success).toBe(true);
      expect(PageInsightsRangeSchema.safeParse('14d').success).toBe(true);
      expect(PageInsightsRangeSchema.safeParse('28d').success).toBe(true);
      expect(PageInsightsRangeSchema.safeParse('90d').success).toBe(true);
    });

    it('rejects unsupported date ranges', () => {
      expect(PageInsightsRangeSchema.safeParse('30d').success).toBe(false);
      expect(PageInsightsRangeSchema.safeParse('1y').success).toBe(false);
      expect(PageInsightsRangeSchema.safeParse('').success).toBe(false);
    });
  });

  describe('PageInsightsOverviewSchema', () => {
    it('validates a complete overview object', () => {
      const data = {
        pageName: 'Pro Creator',
        pageImage: 'https://example.com/page.jpg',
        fanCount: 15400,
        followersCount: 18200,
        totalMediaViews: 120500,
        totalVideoViews: 98000,
        totalPostEngagements: 4500,
      };
      const result = PageInsightsOverviewSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fanCount).toBe(15400);
        expect(result.data.followersCount).toBe(18200);
      }
    });

    it('applies sensible defaults for missing fields', () => {
      const result = PageInsightsOverviewSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fanCount).toBe(0);
        expect(result.data.followersCount).toBe(0);
        expect(result.data.pageName).toBeNull();
      }
    });

    it('rejects negative counts', () => {
      expect(PageInsightsOverviewSchema.safeParse({ fanCount: -5 }).success).toBe(false);
    });
  });

  describe('PageInsightsTimeSeriesPointSchema', () => {
    it('accepts valid chronological daily data point', () => {
      const point = {
        date: '2026-10-01',
        pageFollows: 18000,
        dailyFollowsUnique: 45,
        dailyUnfollowsUnique: 5,
        mediaViews: 3200,
        videoViews: 2800,
        videoCompleteViews30s: 1400,
        videoViewTimeMinutes: 450.5,
      };
      const result = PageInsightsTimeSeriesPointSchema.safeParse(point);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date).toBe('2026-10-01');
        expect(result.data.videoCompleteViews30s).toBe(1400);
      }
    });

    it('rejects malformed date strings', () => {
      expect(PageInsightsTimeSeriesPointSchema.safeParse({ date: '10/01/2026' }).success).toBe(false);
      expect(PageInsightsTimeSeriesPointSchema.safeParse({ date: 'invalid-date' }).success).toBe(false);
    });
  });

  describe('PageInsightsReactionsSchema', () => {
    it('validates reaction sentiment breakdown', () => {
      const reactions = {
        like: 120,
        love: 45,
        wow: 12,
        haha: 8,
        sorry: 2,
        anger: 1,
        total: 188,
      };
      const result = PageInsightsReactionsSchema.safeParse(reactions);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.love).toBe(45);
        expect(result.data.total).toBe(188);
      }
    });

    it('applies zeros for omitted reactions', () => {
      const result = PageInsightsReactionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.like).toBe(0);
        expect(result.data.love).toBe(0);
      }
    });
  });

  describe('DemographicItemSchema and PageInsightsDemographicsSchema', () => {
    it('validates demographics ranking items', () => {
      const item = { name: 'United States', count: 1250, percentage: 65.4 };
      expect(DemographicItemSchema.safeParse(item).success).toBe(true);

      const invalidItem = { name: 'Canada', count: -1, percentage: 120 };
      expect(DemographicItemSchema.safeParse(invalidItem).success).toBe(false);
    });

    it('validates top countries and cities container', () => {
      const demo = {
        topCountries: [
          { name: 'US', count: 500, percentage: 50 },
          { name: 'PK', count: 500, percentage: 50 },
        ],
        topCities: [
          { name: 'New York', count: 300, percentage: 60 },
          { name: 'Lahore', count: 200, percentage: 40 },
        ],
      };
      expect(PageInsightsDemographicsSchema.safeParse(demo).success).toBe(true);
    });
  });

  describe('PageInsightsResponseSchema', () => {
    it('validates a complete response envelope', () => {
      const response = {
        success: true,
        fbPageId: 'fb-page-123',
        dateRange: '28d',
        cachedAt: '2026-10-08T06:00:00.000Z',
        cacheHit: true,
        overview: {
          pageName: 'Verified Creator',
          pageImage: null,
          fanCount: 10000,
          followersCount: 12000,
          totalMediaViews: 50000,
          totalVideoViews: 40000,
          totalPostEngagements: 2500,
        },
        timeSeries: [
          {
            date: '2026-10-01',
            pageFollows: 10000,
            dailyFollowsUnique: 20,
            dailyUnfollowsUnique: 2,
            mediaViews: 500,
            videoViews: 400,
            videoCompleteViews30s: 200,
            videoViewTimeMinutes: 60,
          },
        ],
        reactions: {
          like: 100,
          love: 20,
          wow: 5,
          haha: 3,
          sorry: 0,
          anger: 1,
          total: 129,
        },
        demographics: {
          topCountries: [{ name: 'US', count: 100, percentage: 100 }],
          topCities: [{ name: 'New York', count: 100, percentage: 100 }],
        },
        healthStatus: 'active',
      };
      const result = PageInsightsResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('rejects response if success is false', () => {
      const result = PageInsightsResponseSchema.safeParse({ success: false });
      expect(result.success).toBe(false);
    });
  });

  describe('PageInsightsQuerySchema', () => {
    it('defaults range to 28d when omitted', () => {
      const result = PageInsightsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.range).toBe('28d');
        expect(result.data.refresh).toBe(false);
      }
    });

    it('transforms refresh="true" to boolean true', () => {
      const result = PageInsightsQuerySchema.safeParse({ refresh: 'true', range: '7d' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.range).toBe('7d');
        expect(result.data.refresh).toBe(true);
      }
    });
  });
});
