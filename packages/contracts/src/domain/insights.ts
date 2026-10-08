import { z } from 'zod';

export const PageInsightsRangeSchema = z.enum(['7d', '14d', '28d', '90d']);
export type PageInsightsRange = z.infer<typeof PageInsightsRangeSchema>;

export const PageInsightsOverviewSchema = z.object({
  pageName: z.string().nullable().default(null),
  pageImage: z.string().nullable().default(null),
  fanCount: z.number().int().nonnegative().default(0),
  followersCount: z.number().int().nonnegative().default(0),
  totalMediaViews: z.number().int().nonnegative().default(0),
  totalVideoViews: z.number().int().nonnegative().default(0),
  totalPostEngagements: z.number().int().nonnegative().default(0),
});
export type PageInsightsOverview = z.infer<typeof PageInsightsOverviewSchema>;

export const PageInsightsTimeSeriesPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pageFollows: z.number().int().default(0),
  dailyFollowsUnique: z.number().int().default(0),
  dailyUnfollowsUnique: z.number().int().default(0),
  mediaViews: z.number().int().default(0),
  videoViews: z.number().int().default(0),
  videoCompleteViews30s: z.number().int().default(0),
  videoViewTimeMinutes: z.number().default(0),
});
export type PageInsightsTimeSeriesPoint = z.infer<typeof PageInsightsTimeSeriesPointSchema>;

export const PageInsightsReactionsSchema = z.object({
  like: z.number().int().nonnegative().default(0),
  love: z.number().int().nonnegative().default(0),
  wow: z.number().int().nonnegative().default(0),
  haha: z.number().int().nonnegative().default(0),
  sorry: z.number().int().nonnegative().default(0),
  anger: z.number().int().nonnegative().default(0),
  total: z.number().int().nonnegative().default(0),
});
export type PageInsightsReactions = z.infer<typeof PageInsightsReactionsSchema>;

export const DemographicItemSchema = z.object({
  name: z.string(),
  count: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
});
export type DemographicItem = z.infer<typeof DemographicItemSchema>;

export const PageInsightsDemographicsSchema = z.object({
  topCountries: z.array(DemographicItemSchema).default([]),
  topCities: z.array(DemographicItemSchema).default([]),
});
export type PageInsightsDemographics = z.infer<typeof PageInsightsDemographicsSchema>;

export const PageInsightsHealthStatusSchema = z.enum([
  'active',
  'invalid_token',
  '2fa_required_on_BM',
  'fb_verification_required',
  'rate_limited',
  'account_suspended',
]);
export type PageInsightsHealthStatus = z.infer<typeof PageInsightsHealthStatusSchema>;

export const PageInsightsResponseSchema = z.object({
  success: z.literal(true),
  fbPageId: z.string(),
  dateRange: PageInsightsRangeSchema,
  cachedAt: z.string(),
  cacheHit: z.boolean().default(false),
  overview: PageInsightsOverviewSchema,
  timeSeries: z.array(PageInsightsTimeSeriesPointSchema).default([]),
  reactions: PageInsightsReactionsSchema,
  demographics: PageInsightsDemographicsSchema,
  healthStatus: PageInsightsHealthStatusSchema.default('active'),
});
export type PageInsightsResponse = z.infer<typeof PageInsightsResponseSchema>;

export const PageInsightsQuerySchema = z.object({
  range: PageInsightsRangeSchema.default('28d'),
  refresh: z.enum(['true', 'false']).optional().transform((val) => val === 'true'),
});
export type PageInsightsQuery = z.infer<typeof PageInsightsQuerySchema>;
