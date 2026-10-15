-- =============================================================================
-- Migration: 20261019000000_downloader_and_library_remediation.sql
-- Spec: 046 Downloader and Media Library Audit Remediation
-- Purpose:
--   1. Automated cleanup RPC for stuck download jobs (fail_stuck_download_jobs)
--   2. Ensure index on media_download_jobs for status and updated_at
-- =============================================================================

-- 1. Index on media_download_jobs for stalled job cleanup
CREATE INDEX IF NOT EXISTS idx_media_download_jobs_stuck
  ON public.media_download_jobs (status, updated_at ASC)
  WHERE status IN ('queued', 'downloading', 'processing');

-- 2. Stored procedure: fail_stuck_download_jobs
DROP FUNCTION IF EXISTS public.fail_stuck_download_jobs(INT);
DROP FUNCTION IF EXISTS public.fail_stuck_download_jobs();

CREATE OR REPLACE FUNCTION public.fail_stuck_download_jobs(
  p_timeout_minutes INT DEFAULT 15
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_count INT;
BEGIN
  WITH failed_jobs AS (
    UPDATE public.media_download_jobs
    SET status = 'failed',
        error_message = 'Download timed out after 15 minutes of inactivity.',
        updated_at = now()
    WHERE status IN ('queued', 'downloading', 'processing')
      AND updated_at <= now() - make_interval(mins => GREATEST(1, p_timeout_minutes))
    RETURNING id
  )
  SELECT count(*)::INT INTO v_failed_count FROM failed_jobs;

  RETURN COALESCE(v_failed_count, 0);
END;
$$;
