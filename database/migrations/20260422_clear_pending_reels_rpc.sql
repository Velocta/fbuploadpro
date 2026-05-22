-- Bulk-clear pending reels for a page without row-by-row counter churn.
-- Date: 2026-04-22

create or replace function public.clear_pending_reels_for_page(p_page_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  v_deleted_count integer := 0;
begin
  perform set_config('app.skip_page_reel_count_updates', '1', true);

  delete from public.reels
  where page_id = p_page_id
    and status = 'pending';

  get diagnostics v_deleted_count = row_count;

  update public.pages p
  set
    pending_reels_count = coalesce(s.pending_count, 0),
    posted_reels_count = coalesce(s.posted_count, 0),
    failed_reels_count = coalesce(s.failed_count, 0)
  from (
    select
      page_id,
      count(*) filter (where status = 'pending') as pending_count,
      count(*) filter (where status = 'posted') as posted_count,
      count(*) filter (where status = 'failed') as failed_count
    from public.reels
    where page_id = p_page_id
    group by page_id
  ) s
  where p.id = p_page_id
    and p.id = s.page_id;

  -- If no reels remain, force counters to 0.
  if not exists (select 1 from public.reels where page_id = p_page_id) then
    update public.pages
    set pending_reels_count = 0,
        posted_reels_count = 0,
        failed_reels_count = 0
    where id = p_page_id;
  end if;

  return v_deleted_count;
end;
$$;

grant execute on function public.clear_pending_reels_for_page(uuid) to authenticated;
grant execute on function public.clear_pending_reels_for_page(uuid) to service_role;
