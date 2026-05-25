-- Bulk queue batch grouping for facebook_inapp_schedule_posts
alter table public.facebook_inapp_schedule_posts
  add column if not exists bulk_batch_id uuid null;

create index if not exists idx_fb_inapp_schedule_posts_bulk_batch_id
  on public.facebook_inapp_schedule_posts (bulk_batch_id)
  where bulk_batch_id is not null;
