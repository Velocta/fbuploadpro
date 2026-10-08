# Phase 1 Contract: Facebook Page Insights API

**Feature**: Dedicated Facebook Page Insights & Analytics Suite
**Spec**: [specs/006-facebook-page-insights/spec.md](spec.md)

---

## 1. HTTP Endpoint: `GET /api/tenant/[subdomain]/pages/[pageId]/insights`

### Request Parameters
- **Path Parameters**:
  - `subdomain`: Workspace slug string (must match authenticated user)
  - `pageId`: UUID or Facebook Page ID string
- **Query Parameters**:
  - `range`: Optional enum string (`"7d"` | `"14d"` | `"28d"` | `"90d"`), default `"28d"`
  - `refresh`: Optional boolean string (`"true"` | `"false"`), default `"false"`

---

## 2. Response DTO Contracts (Zod Schemas)

```typescript
import { z } from 'zod';

export const PageInsightsOverviewSchema = z.object({
  pageName: z.string().nullable(),
  pageImage: z.string().nullable(),
  fanCount: z.number().int().nonnegative(),
  followersCount: z.number().int().nonnegative(),
  totalMediaViews: z.number().int().nonnegative(),
  totalVideoViews: z.number().int().nonnegative(),
  totalPostEngagements: z.number().int().nonnegative(),
});

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

export const PageInsightsReactionsSchema = z.object({
  like: z.number().int().nonnegative().default(0),
  love: z.number().int().nonnegative().default(0),
  wow: z.number().int().nonnegative().default(0),
  haha: z.number().int().nonnegative().default(0),
  sorry: z.number().int().nonnegative().default(0),
  anger: z.number().int().nonnegative().default(0),
  total: z.number().int().nonnegative().default(0),
});

export const DemographicItemSchema = z.object({
  name: z.string(),
  count: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
});

export const PageInsightsDemographicsSchema = z.object({
  topCountries: z.array(DemographicItemSchema),
  topCities: z.array(DemographicItemSchema),
});

export const PageInsightsResponseSchema = z.object({
  success: z.literal(true),
  fbPageId: z.string(),
  dateRange: z.enum(['7d', '14d', '28d', '90d']),
  cachedAt: z.string().datetime(),
  cacheHit: z.boolean(),
  overview: PageInsightsOverviewSchema,
  timeSeries: z.array(PageInsightsTimeSeriesPointSchema),
  reactions: PageInsightsReactionsSchema,
  demographics: PageInsightsDemographicsSchema,
  healthStatus: z.enum([
    'active',
    'invalid_token',
    '2fa_required_on_BM',
    'fb_verification_required',
    'rate_limited',
    'account_suspended',
  ]).default('active'),
});
```
