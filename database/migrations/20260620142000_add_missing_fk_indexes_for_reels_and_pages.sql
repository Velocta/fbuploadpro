-- Migration: Add missing covering indexes for foreign keys referencing public.reels and public.pages.
-- This prevents table-wide sequential scans when deleting reels in bulk/batches, avoiding statement timeouts.

-- Covering indexes for FKs referencing public.reels(id)
CREATE INDEX IF NOT EXISTS idx_errors_reel_id ON public.errors(reel_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_reel_id ON public.token_transactions(reel_id);
CREATE INDEX IF NOT EXISTS idx_posting_jobs_v2_reel_internal_id ON public.posting_jobs_v2(reel_internal_id);
CREATE INDEX IF NOT EXISTS idx_adu_posting_jobs_reel_internal_id ON public.adu_posting_jobs(reel_internal_id);

-- Covering indexes for FKs referencing public.pages(id)
CREATE INDEX IF NOT EXISTS idx_errors_page_id ON public.errors(page_id);
CREATE INDEX IF NOT EXISTS idx_posting_jobs_v2_page_id ON public.posting_jobs_v2(page_id);
