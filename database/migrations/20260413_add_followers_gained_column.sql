-- Migration: add followers_gained column for page growth tracking
-- Date: 2026-04-13

alter table public.pages
add column if not exists followers_gained bigint not null default 0;
