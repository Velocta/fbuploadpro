-- One-time repair: re-queue ADU reels stuck in failed / download_failed / processing
-- back to pending so claim_adu_buffer_downloads can pick them up again.
--
-- Scope: active, synced pages with posts_per_day > 0 (downloader-eligible).
-- Pause the downloader worker before applying to avoid racing in-flight jobs.

select set_config('app.skip_page_reel_count_updates', '1', true);

update public.reels r
set
  status = 'pending',
  download_retries = 0,
  download_claimed_at = null,
  download_failed_at = null,
  media_object_key = null,
  media_size_bytes = null,
  media_content_type = null,
  media_sha256 = null,
  downloaded_at = null
from public.pages p
where p.id = r.page_id
  and p.status = 'active'
  and p.sync_status = 'synced'
  and coalesce(p.posts_per_day, 0) > 0
  and r.status in ('failed', 'download_failed', 'processing');

with counts as (
  select
    p.id as page_id,
    count(*) filter (where r.status = 'pending') as pending_cnt,
    count(*) filter (where r.status = 'posted') as posted_cnt,
    count(*) filter (where r.status = 'failed') as failed_cnt
  from public.pages p
  left join public.reels r on r.page_id = p.id
  where p.status = 'active'
    and p.sync_status = 'synced'
    and coalesce(p.posts_per_day, 0) > 0
  group by p.id
)
update public.pages p
set
  pending_reels_count = c.pending_cnt,
  posted_reels_count = c.posted_cnt,
  failed_reels_count = c.failed_cnt,
  updated_at = now()
from counts c
where p.id = c.page_id;

select set_config('app.skip_page_reel_count_updates', '0', true);
