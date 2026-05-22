-- Migration: add auto-computed changed_followers column on pages
-- Date: 2026-04-13

alter table public.pages
add column if not exists changed_followers bigint
generated always as (coalesce(followers_gained, 0) - coalesce(followers_count, 0)) stored;
