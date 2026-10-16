# Data Model: Live Facebook Insights & Client LocalStorage Caching

**Feature**: [spec.md](./spec.md)
**Date**: 2026-10-16

---

## 1. Client LocalStorage Cache Entity

### `PageInsightsLocalStorageEntry`
Stored in the browser `window.localStorage` under key `insights:${pageId}:${range}`.

| Field | Type | Description |
| :--- | :--- | :--- |
| `data` | `PageInsightsResponse` | Validated analytical payload matching `@fbuploadpro/contracts` |
| `cachedAt` | `number` | Unix epoch millisecond timestamp when the data was saved |
| `expiresAt` | `number` | Unix epoch millisecond timestamp when the cache expires (`cachedAt + 900000`) |

#### Cache Invalidation Rules:
- **Time-based**: If `Date.now() >= expiresAt`, entry is considered stale. The client issues a fresh fetch and overwrites.
- **Manual Sync**: If user clicks the "Sync" button, `localStorage` is bypassed, live Graph API is called with `refresh=true`, and on success `localStorage` is overwritten with a new `expiresAt`.
- **Corrupted Data**: If JSON parse fails or data is missing mandatory fields, the key is removed from `localStorage` and a fresh fetch is initiated.

---

## 2. API Contract Entity (`PageInsightsResponse`)

Preserved and validated by `@fbuploadpro/contracts` [insights.ts](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/pull_latest_main_code/packages/contracts/src/domain/insights.ts):

| Field | Type | Description |
| :--- | :--- | :--- |
| `success` | `true` | Success discriminator |
| `fbPageId` | `string` | Facebook Page ID |
| `dateRange` | `'7d' \| '14d' \| '28d' \| '90d'` | Queried time range |
| `cachedAt` | `string` | ISO 8601 timestamp of data generation |
| `cacheHit` | `boolean` | False for live fetches |
| `overview` | `PageInsightsOverview` | Follower counts, views, and engagements |
| `timeSeries` | `PageInsightsTimeSeriesPoint[]` | Daily time-series datapoints |
| `reactions` | `PageInsightsReactions` | Sentiments: like, love, wow, haha, sorry, anger, total |
| `demographics` | `PageInsightsDemographics` | Top countries and cities distributions |
| `healthStatus` | `PageInsightsHealthStatus` | `'active'`, `'invalid_token'`, `'rate_limited'`, etc. |

---

## 3. Database Schema Deletions

### Table Dropped: `public.page_insights_daily_snapshots`
- Dropped via forward migration `supabase/migrations/20261021000000_drop_page_insights_daily_snapshots.sql`.
- Associated index `idx_page_insights_user_page_date` and unique constraint `uq_page_insights_user_page_date` dropped automatically with the table.
- Removed from `@fbuploadpro/contracts/src/domain/database.ts`.
