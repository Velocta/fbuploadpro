-- Migration: Auto Download/Upload (ADU) Performance Optimizations
-- Created: 2026-06-18

-- 1. Create missing indexes for adu_posting_jobs to optimize Hub and Details page queries
CREATE INDEX IF NOT EXISTS idx_adu_posting_jobs_agency_status_updated 
ON public.adu_posting_jobs (agency_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_adu_posting_jobs_page_status_updated 
ON public.adu_posting_jobs (page_id, status, updated_at DESC);

-- 2. Optimize the RLS policy on the reels table (2.3M rows)
DROP POLICY IF EXISTS "Agencies manage own reels" ON public.reels;

CREATE POLICY "Agencies manage own reels" ON public.reels
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.pages p
    WHERE p.id = reels.page_id 
      AND p.agency_id = auth.uid()
  )
);
