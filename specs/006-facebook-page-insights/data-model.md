# Phase 1 Data Model: Facebook Page Insights & Snapshots

**Feature**: Dedicated Facebook Page Insights & Analytics Suite
**Spec**: [specs/006-facebook-page-insights/spec.md](spec.md)

---

## 1. Relational Entities & Schema Definitions

### `page_insights_daily_snapshots`

Stores daily historical metrics captured via background worker sync or on-demand cache backfill.

```sql
CREATE TABLE IF NOT EXISTS public.page_insights_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fb_page_id VARCHAR(64) NOT NULL,
  snapshot_date DATE NOT NULL,
  fan_count BIGINT NOT NULL DEFAULT 0,
  followers_count BIGINT NOT NULL DEFAULT 0,
  daily_follows INT NOT NULL DEFAULT 0,
  daily_unfollows INT NOT NULL DEFAULT 0,
  media_views INT NOT NULL DEFAULT 0,
  video_views INT NOT NULL DEFAULT 0,
  video_complete_views_30s INT NOT NULL DEFAULT 0,
  video_view_time_seconds BIGINT NOT NULL DEFAULT 0,
  reactions_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  demographics_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_page_snapshot_date UNIQUE (user_id, fb_page_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_page_insights_user_page_date
ON public.page_insights_daily_snapshots (user_id, fb_page_id, snapshot_date DESC);
```

---

## 2. In-Memory / Transient Data Structures

### `PageInsightsCacheEntry`
- `data`: Complete `PageInsightsResponse` payload
- `expiresAt`: UNIX timestamp (current time + 15 minutes)
- `lastFetchedAt`: ISO-8601 string

---

## 3. Data Integrity & Isolation Rules

1. **Compound Tenant Isolation**:
   Every query to `page_insights_daily_snapshots` MUST include `WHERE user_id = :userId AND fb_page_id = :pageId`.
2. **Idempotent Upsert**:
   Sync worker uses PostgreSQL upsert semantics:
   ```sql
   INSERT INTO public.page_insights_daily_snapshots (
     user_id, fb_page_id, snapshot_date, fan_count, followers_count,
     daily_follows, daily_unfollows, media_views, video_views,
     video_complete_views_30s, video_view_time_seconds,
     reactions_summary, demographics_summary
   ) VALUES (...)
   ON CONFLICT (user_id, fb_page_id, snapshot_date)
   DO UPDATE SET
     fan_count = EXCLUDED.fan_count,
     followers_count = EXCLUDED.followers_count,
     daily_follows = EXCLUDED.daily_follows,
     daily_unfollows = EXCLUDED.daily_unfollows,
     media_views = EXCLUDED.media_views,
     video_views = EXCLUDED.video_views,
     video_complete_views_30s = EXCLUDED.video_complete_views_30s,
     video_view_time_seconds = EXCLUDED.video_view_time_seconds,
     reactions_summary = EXCLUDED.reactions_summary,
     demographics_summary = EXCLUDED.demographics_summary,
     updated_at = now();
   ```
