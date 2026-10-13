-- Migration: 20261014100000_performance_indexes.sql
-- Description: Add missing performance indexes for publishing queue recovery and case-insensitive workspace subdomains (Audit Issue 14).

-- 1. Partial index on queue_items for stale publishing item recovery and monitoring
CREATE INDEX IF NOT EXISTS idx_queue_items_publishing_stale
    ON public.queue_items (status, updated_at)
    WHERE status = 'publishing';

-- 2. Functional index on workspaces for case-insensitive subdomain resolution
CREATE INDEX IF NOT EXISTS idx_workspaces_lower_subdomain
    ON public.workspaces (LOWER(subdomain));
