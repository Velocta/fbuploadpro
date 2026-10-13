-- Migration: 20261014110000_hardened_claim_and_settle_rpc.sql
-- Description: Hardens claim_due_queue_items by filtering out paused, checkpointed, and unhealthy pages,
--              recovering items stuck in 'publishing' for >10 minutes, and honoring rate-limit cooldowns.

CREATE OR REPLACE FUNCTION claim_due_queue_items(p_limit INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  fb_page_id UUID,
  media_id UUID,
  caption TEXT,
  first_comment TEXT,
  retry_count INT,
  max_retries INT,
  media_type VARCHAR,
  media_url TEXT,
  storage_key VARCHAR,
  external_page_id VARCHAR,
  encrypted_access_token TEXT,
  page_name VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Recover items stuck in 'publishing' for > 10 minutes back to 'queued'
  UPDATE queue_items
  SET status = 'queued',
      updated_at = now()
  WHERE status = 'publishing'
    AND updated_at <= now() - INTERVAL '10 minutes';

  -- 2. Select and claim due items for active or eligible cooldown pages
  RETURN QUERY
  WITH selected_items AS (
    SELECT qi.id
    FROM queue_items qi
    JOIN facebook_pages fp ON fp.id = qi.fb_page_id AND fp.user_id = qi.user_id
    WHERE qi.status = 'queued'
      AND qi.scheduled_time <= now()
      AND (
        fp.status = 'active'
        OR (fp.status = 'fb_rate_limited' AND fp.updated_at <= now() - INTERVAL '3 days')
      )
    ORDER BY qi.scheduled_time ASC
    LIMIT p_limit
    FOR UPDATE OF qi SKIP LOCKED
  ),
  updated_items AS (
    UPDATE queue_items qi
    SET status = 'publishing',
        updated_at = now()
    FROM selected_items
    WHERE qi.id = selected_items.id
    RETURNING qi.id, qi.user_id, qi.fb_page_id, qi.media_id, qi.caption, qi.first_comment, qi.retry_count, qi.max_retries
  )
  SELECT
    ui.id,
    ui.user_id,
    ui.fb_page_id,
    ui.media_id,
    ui.caption,
    ui.first_comment,
    ui.retry_count,
    ui.max_retries,
    m.media_type,
    m.url AS media_url,
    m.storage_key,
    fp.fb_page_id AS external_page_id,
    fp.encrypted_access_token,
    fp.page_name
  FROM updated_items ui
  JOIN media_items m ON m.id = ui.media_id AND m.user_id = ui.user_id
  JOIN facebook_pages fp ON fp.id = ui.fb_page_id AND fp.user_id = ui.user_id;
END;
$$;
