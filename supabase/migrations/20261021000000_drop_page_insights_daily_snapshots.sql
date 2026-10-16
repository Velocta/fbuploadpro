-- Migration: 20261021000000_drop_page_insights_daily_snapshots.sql
-- Description: Drop page_insights_daily_snapshots table as insights are fetched live from Facebook Graph API v26.0 and cached in client localStorage

DROP TABLE IF EXISTS public.page_insights_daily_snapshots CASCADE;
