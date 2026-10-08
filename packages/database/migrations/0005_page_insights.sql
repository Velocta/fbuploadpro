-- Migration: 0005_page_insights.sql
-- Description: Create page_insights_daily_snapshots table for Facebook Page Insights with compound tenant isolation

CREATE TABLE IF NOT EXISTS public.page_insights_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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
  CONSTRAINT fk_page_insights_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT uq_page_insights_user_page_date UNIQUE (user_id, fb_page_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_page_insights_user_page_date
ON public.page_insights_daily_snapshots (user_id, fb_page_id, snapshot_date DESC);
