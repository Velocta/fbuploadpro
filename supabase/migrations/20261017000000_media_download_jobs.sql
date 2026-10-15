-- =============================================================================
-- Migration: 20261017000000_media_download_jobs.sql
-- Purpose:
--   1. Create media_download_job_status enum
--   2. Create media_download_jobs table for asynchronous background ingestion
--   3. Add indexes and Row Level Security (RLS) policies
--   4. Attach updated_at trigger
-- =============================================================================

-- 1. Create media_download_job_status enum
DO $$ BEGIN
  CREATE TYPE public.media_download_job_status AS ENUM (
    'queued',
    'downloading',
    'processing',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create media_download_jobs table
CREATE TABLE IF NOT EXISTS public.media_download_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_platform VARCHAR(32) NOT NULL DEFAULT 'direct',
  target_folder_id UUID REFERENCES public.media_folders(id) ON DELETE SET NULL,
  custom_filename VARCHAR(255) NULL,
  status public.media_download_job_status NOT NULL DEFAULT 'queued',
  progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  total_bytes BIGINT NULL CHECK (total_bytes IS NULL OR total_bytes >= 0),
  downloaded_bytes BIGINT NOT NULL DEFAULT 0 CHECK (downloaded_bytes >= 0),
  media_id UUID REFERENCES public.media_items(id) ON DELETE SET NULL,
  error_code VARCHAR(64) NULL,
  error_message TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add Indexes for performant user queries & worker polling
CREATE INDEX IF NOT EXISTS idx_media_download_jobs_user_status
  ON public.media_download_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_media_download_jobs_user_created_at
  ON public.media_download_jobs(user_id, created_at DESC);

-- 4. Enable Row Level Security & Policies
ALTER TABLE public.media_download_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own download jobs" ON public.media_download_jobs;
CREATE POLICY "Users can view their own download jobs"
  ON public.media_download_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own download jobs" ON public.media_download_jobs;
CREATE POLICY "Users can insert their own download jobs"
  ON public.media_download_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own download jobs" ON public.media_download_jobs;
CREATE POLICY "Users can update their own download jobs"
  ON public.media_download_jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own download jobs" ON public.media_download_jobs;
CREATE POLICY "Users can delete their own download jobs"
  ON public.media_download_jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Attach BEFORE UPDATE trigger for updated_at
DROP TRIGGER IF EXISTS trg_media_download_jobs_updated_at ON public.media_download_jobs;
CREATE TRIGGER trg_media_download_jobs_updated_at
  BEFORE UPDATE ON public.media_download_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
