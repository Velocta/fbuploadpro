-- Add graph_post_id column to facebook_inapp_schedule_posting_jobs table
ALTER TABLE public.facebook_inapp_schedule_posting_jobs
ADD COLUMN IF NOT EXISTS graph_post_id text;
