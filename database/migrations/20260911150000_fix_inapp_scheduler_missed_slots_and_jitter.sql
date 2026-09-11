-- Fix in-app scheduler missing posting slots due to cron jitter and lack of lookahead/lookback recovery.
-- 1. Replace rigid 59-second calendar minute window with rolling window:
--    - Lookahead: up to now() + interval '1 minute' to avoid missing whole-hour transitions due to seconds drift.
--    - Lookback: up to now() - interval '24 hours' to recover missed slots from cron delays or queue additions.
-- 2. Ensure NOT EXISTS check happens per slot inside min() calculation so oldest unposted slot is chosen.
-- 3. Guard against concurrent in-flight publishing per page (status IN ('pending_publish', 'publishing')).
-- 4. Add partial index on facebook_inapp_schedule_posts for fast queue position lookups.

CREATE INDEX IF NOT EXISTS idx_facebook_inapp_schedule_posts_queue_claim
  ON public.facebook_inapp_schedule_posts (page_id, queue_position ASC)
  WHERE status = 'pending';

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
        FROM (
          SELECT (local_day.day + t.schedule_time::time) AT TIME ZONE p.schedule_timezone AS slot_at
          FROM unnest(p.posting_times) AS t(schedule_time)
          CROSS JOIN (
            VALUES 
              (date_trunc('day', now() AT TIME ZONE p.schedule_timezone) - interval '1 day'),
              (date_trunc('day', now() AT TIME ZONE p.schedule_timezone)),
              (date_trunc('day', now() AT TIME ZONE p.schedule_timezone) + interval '1 day')
          ) AS local_day(day)
        ) matched
        WHERE matched.slot_at >= now() - interval '24 hours'
          AND matched.slot_at <= now() + interval '1 minute'
          AND NOT EXISTS (
            SELECT 1
            FROM public.facebook_inapp_schedule_posting_jobs aj
            WHERE aj.page_id = p.id
              AND aj.schedule_slot_at = matched.slot_at
          )
      ) AS schedule_slot_at
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
        FROM public.facebook_inapp_schedule_posting_jobs active_j
        WHERE active_j.page_id = dps.page_id
          AND active_j.status IN ('pending_publish', 'publishing')
      )
  ),
  candidate_posts AS (
    SELECT
      edp.agency_id,
      edp.page_id,
      edp.fb_page_id,
      edp.fb_page_access_token,
      edp.schedule_slot_at,
      p.id AS post_id,
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
      ORDER BY pp.queue_position ASC NULLS LAST
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

GRANT EXECUTE ON FUNCTION public.create_due_inapp_posting_jobs(text) TO service_role;
