-- Alter facebook_inapp_schedule_pages to add slot columns if they do not exist
ALTER TABLE public.facebook_inapp_schedule_pages
ADD COLUMN IF NOT EXISTS posts_per_day integer NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS posting_times text[] NOT NULL DEFAULT ARRAY['09:00 AM', '03:00 PM'],
ADD COLUMN IF NOT EXISTS schedule_timezone text NOT NULL DEFAULT 'UTC';

-- Alter facebook_inapp_schedule_posts to add queue_position if it does not exist
ALTER TABLE public.facebook_inapp_schedule_posts
ADD COLUMN IF NOT EXISTS queue_position integer;

-- Update existing rows to have default queue_positions based on scheduled_at (if they are NULL)
WITH numbered_posts AS (
  SELECT id, row_number() OVER (PARTITION BY page_id ORDER BY scheduled_at ASC) - 1 as new_pos
  FROM public.facebook_inapp_schedule_posts
  WHERE queue_position IS NULL
)
UPDATE public.facebook_inapp_schedule_posts p
SET queue_position = n.new_pos
FROM numbered_posts n
WHERE p.id = n.id AND p.queue_position IS NULL;
