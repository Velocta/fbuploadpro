-- Alter facebook_inapp_schedule_pages to add stats counters if they do not exist
ALTER TABLE public.facebook_inapp_schedule_pages
ADD COLUMN IF NOT EXISTS pending_posts_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS posted_posts_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_posts_count integer NOT NULL DEFAULT 0;

-- Create the facebook_inapp_schedule_posting_jobs table
CREATE TABLE IF NOT EXISTS public.facebook_inapp_schedule_posting_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.facebook_inapp_schedule_posts(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.facebook_inapp_schedule_pages(id) ON DELETE CASCADE,
  fb_page_id text,
  fb_page_access_token text,
  media_type text,
  media_object_key text,
  caption text,
  first_comment text,
  status text NOT NULL DEFAULT 'pending_publish' CHECK (status = ANY (ARRAY['pending_publish'::text, 'publishing'::text, 'published'::text, 'failed'::text])),
  retry_count integer NOT NULL DEFAULT 0,
  transient_retry_count integer NOT NULL DEFAULT 0,
  last_error_code text,
  last_error_message text,
  schedule_slot_at timestamp with time zone,
  publish_started_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for unique slots per page
CREATE UNIQUE INDEX IF NOT EXISTS facebook_inapp_schedule_posting_jobs_page_slot_idx 
ON public.facebook_inapp_schedule_posting_jobs (page_id, schedule_slot_at) 
WHERE schedule_slot_at IS NOT NULL;

-- Index for status scanning
CREATE INDEX IF NOT EXISTS facebook_inapp_schedule_posting_jobs_status_idx 
ON public.facebook_inapp_schedule_posting_jobs (status);

-- Enable RLS and define security policies
ALTER TABLE public.facebook_inapp_schedule_posting_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access facebook_inapp_schedule_posting_jobs" ON public.facebook_inapp_schedule_posting_jobs;
CREATE POLICY "Service role full access facebook_inapp_schedule_posting_jobs"
  ON public.facebook_inapp_schedule_posting_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Super Admin read facebook_inapp_schedule_posting_jobs" ON public.facebook_inapp_schedule_posting_jobs;
CREATE POLICY "Super Admin read facebook_inapp_schedule_posting_jobs"
  ON public.facebook_inapp_schedule_posting_jobs
  FOR SELECT
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Agency read own facebook_inapp_schedule_posting_jobs" ON public.facebook_inapp_schedule_posting_jobs;
CREATE POLICY "Agency read own facebook_inapp_schedule_posting_jobs"
  ON public.facebook_inapp_schedule_posting_jobs
  FOR SELECT
  USING (
    page_id IN (
      SELECT id FROM public.facebook_inapp_schedule_pages WHERE agency_id = auth.uid()
    )
  );

-- Alter facebook_inapp_schedule_posts to drop columns that are now stored in the pages table or calculated dynamically
ALTER TABLE public.facebook_inapp_schedule_posts 
DROP COLUMN IF EXISTS scheduled_at,
DROP COLUMN IF EXISTS timezone,
DROP COLUMN IF EXISTS fb_page_id,
DROP COLUMN IF EXISTS fb_page_access_token;

-- Function for real-time post counter synchronization
CREATE OR REPLACE FUNCTION public.update_inapp_page_post_counts()
RETURNS trigger AS $$
BEGIN
  IF (tg_op = 'INSERT') THEN
    IF new.status IN ('pending', 'publishing') THEN
      UPDATE public.facebook_inapp_schedule_pages SET pending_posts_count = pending_posts_count + 1 WHERE id = new.page_id;
    ELSIF new.status = 'published' THEN
      UPDATE public.facebook_inapp_schedule_pages SET posted_posts_count = posted_posts_count + 1 WHERE id = new.page_id;
    ELSIF new.status = 'failed' THEN
      UPDATE public.facebook_inapp_schedule_pages SET failed_posts_count = failed_posts_count + 1 WHERE id = new.page_id;
    END IF;
  ELSIF (tg_op = 'UPDATE') THEN
    IF old.page_id <> new.page_id OR old.status <> new.status THEN
      -- Decrement old status
      IF old.status IN ('pending', 'publishing') THEN
        UPDATE public.facebook_inapp_schedule_pages SET pending_posts_count = pending_posts_count - 1 WHERE id = old.page_id;
      ELSIF old.status = 'published' THEN
        UPDATE public.facebook_inapp_schedule_pages SET posted_posts_count = posted_posts_count - 1 WHERE id = old.page_id;
      ELSIF old.status = 'failed' THEN
        UPDATE public.facebook_inapp_schedule_pages SET failed_posts_count = failed_posts_count - 1 WHERE id = old.page_id;
      END IF;

      -- Increment new status
      IF new.status IN ('pending', 'publishing') THEN
        UPDATE public.facebook_inapp_schedule_pages SET pending_posts_count = pending_posts_count + 1 WHERE id = new.page_id;
      ELSIF new.status = 'published' THEN
        UPDATE public.facebook_inapp_schedule_pages SET posted_posts_count = posted_posts_count + 1 WHERE id = new.page_id;
      ELSIF new.status = 'failed' THEN
        UPDATE public.facebook_inapp_schedule_pages SET failed_posts_count = failed_posts_count + 1 WHERE id = new.page_id;
      END IF;
    END IF;
  ELSIF (tg_op = 'DELETE') THEN
    -- If the page is already deleted, skip
    IF NOT EXISTS (SELECT 1 FROM public.facebook_inapp_schedule_pages WHERE id = old.page_id) THEN
      RETURN NULL;
    END IF;

    IF old.status IN ('pending', 'publishing') THEN
      UPDATE public.facebook_inapp_schedule_pages SET pending_posts_count = pending_posts_count - 1 WHERE id = old.page_id;
    ELSIF old.status = 'published' THEN
      UPDATE public.facebook_inapp_schedule_pages SET posted_posts_count = posted_posts_count - 1 WHERE id = old.page_id;
    ELSIF old.status = 'failed' THEN
      UPDATE public.facebook_inapp_schedule_pages SET failed_posts_count = failed_posts_count - 1 WHERE id = old.page_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_inapp_posts_stats_sync ON public.facebook_inapp_schedule_posts;
CREATE TRIGGER tr_inapp_posts_stats_sync
AFTER INSERT OR UPDATE OR DELETE ON public.facebook_inapp_schedule_posts
FOR EACH ROW EXECUTE FUNCTION public.update_inapp_page_post_counts();

-- Initialize counts on existing pages
UPDATE public.facebook_inapp_schedule_pages p
SET 
  pending_posts_count = (SELECT count(*)::integer FROM public.facebook_inapp_schedule_posts WHERE page_id = p.id AND status IN ('pending', 'publishing')),
  posted_posts_count = (SELECT count(*)::integer FROM public.facebook_inapp_schedule_posts WHERE page_id = p.id AND status = 'published'),
  failed_posts_count = (SELECT count(*)::integer FROM public.facebook_inapp_schedule_posts WHERE page_id = p.id AND status = 'failed');

-- Stored Procedure to resolve active pages' slots and create due posting jobs
CREATE OR REPLACE FUNCTION public.create_due_inapp_posting_jobs(p_mode text DEFAULT 'prod')
RETURNS TABLE (
  job_id uuid,
  post_id uuid,
  page_id uuid,
  fb_page_id text,
  fb_page_access_token text,
  media_type text,
  media_object_key text,
  caption text,
  first_comment text,
  schedule_slot_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH due_pages_with_slot AS (
    SELECT
      p.id AS page_id,
      p.agency_id,
      p.fb_page_id,
      p.fb_page_access_token,
      (
        SELECT min(matched.slot_at)
        from (
          SELECT (local_day.day + t.schedule_time::time) at time zone p.schedule_timezone as slot_at
          from unnest(p.posting_times) as t(schedule_time)
          CROSS JOIN (
            VALUES 
              (date_trunc('day', now() at time zone p.schedule_timezone) - interval '1 day'),
              (date_trunc('day', now() at time zone p.schedule_timezone)),
              (date_trunc('day', now() at time zone p.schedule_timezone) + interval '1 day')
          ) as local_day(day)
        ) matched
        WHERE matched.slot_at BETWEEN date_trunc('minute', now()) and date_trunc('minute', now()) + interval '59 seconds'
      ) as schedule_slot_at
    FROM public.facebook_inapp_schedule_pages p
    JOIN public.users u ON p.agency_id = u.id
    WHERE p.status = 'active'
      AND u.is_active_override = true
  ),
  eligible_due_pages AS (
    SELECT dps.*
    FROM due_pages_with_slot dps
    WHERE dps.schedule_slot_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.facebook_inapp_schedule_posting_jobs aj
        WHERE aj.page_id = dps.page_id
          AND aj.schedule_slot_at = dps.schedule_slot_at
      )
  ),
  candidate_posts AS (
    SELECT
      edp.agency_id,
      edp.page_id,
      edp.fb_page_id,
      edp.fb_page_access_token,
      edp.schedule_slot_at,
      p.id as post_id,
      p.media_type,
      p.media_object_key,
      p.caption,
      p.first_comment
    FROM eligible_due_pages edp
    JOIN LATERAL (
      SELECT pp.*
      FROM public.facebook_inapp_schedule_posts pp
      WHERE pp.page_id = edp.page_id
        AND pp.status = 'pending'
      ORDER BY pp.queue_position ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    ) p ON TRUE
  ),
  inserted_jobs AS (
    INSERT INTO public.facebook_inapp_schedule_posting_jobs (
      job_id,
      post_id,
      page_id,
      fb_page_id,
      fb_page_access_token,
      status,
      media_type,
      media_object_key,
      caption,
      first_comment,
      schedule_slot_at,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      cp.post_id,
      cp.page_id,
      cp.fb_page_id,
      cp.fb_page_access_token,
      'pending_publish',
      cp.media_type,
      cp.media_object_key,
      cp.caption,
      cp.first_comment,
      cp.schedule_slot_at,
      now(),
      now()
    FROM candidate_posts cp
    ON CONFLICT (page_id, schedule_slot_at) WHERE schedule_slot_at IS NOT NULL DO NOTHING
    RETURNING *
  ),
  mark_posts AS (
    UPDATE public.facebook_inapp_schedule_posts p
    SET 
      status = 'publishing',
      updated_at = now()
    WHERE p.id IN (SELECT ij.post_id FROM inserted_jobs ij)
      AND p.status = 'pending'
    RETURNING p.id
  )
  SELECT
    ij.job_id,
    ij.post_id,
    ij.page_id,
    ij.fb_page_id,
    ij.fb_page_access_token,
    ij.media_type,
    ij.media_object_key,
    ij.caption,
    ij.first_comment,
    ij.schedule_slot_at
  FROM inserted_jobs ij;
END;
$$;

-- Stored Procedure to claim pending publishing jobs
CREATE OR REPLACE FUNCTION public.claim_due_inapp_posting_jobs(p_limit int)
RETURNS TABLE (
  job_id uuid,
  post_id uuid,
  page_id uuid,
  fb_page_id text,
  fb_page_access_token text,
  media_type text,
  media_object_key text,
  caption text,
  first_comment text,
  schedule_slot_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  UPDATE public.facebook_inapp_schedule_posting_jobs aj
  SET 
    status = 'publishing',
    publish_started_at = now(),
    updated_at = now()
  FROM (
    SELECT aj2.job_id
    FROM public.facebook_inapp_schedule_posting_jobs aj2
    WHERE aj2.status = 'pending_publish'
      AND aj2.schedule_slot_at <= now()
    ORDER BY aj2.schedule_slot_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) sub
  WHERE aj.job_id = sub.job_id
  RETURNING 
    aj.job_id,
    aj.post_id,
    aj.page_id,
    aj.fb_page_id,
    aj.fb_page_access_token,
    aj.media_type,
    aj.media_object_key,
    aj.caption,
    aj.first_comment,
    aj.schedule_slot_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_due_inapp_posting_jobs(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_inapp_posting_jobs(int) TO service_role;
