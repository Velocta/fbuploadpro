-- Make pending reel cleanup chunked + skip-locked to avoid statement timeouts
-- during source updates when rows are large/contended.
-- Date: 2026-04-22

create or replace function public.clear_pending_reels_for_page(
  p_page_id uuid,
  p_batch_size integer default 2000
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_count integer := 0;
  v_page_agency_id uuid;
  v_actor_role public.user_role_enum;
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'not_authenticated';
  end if;

  select role into v_actor_role
  from public.users
  where id = v_actor_id;

  select agency_id into v_page_agency_id
  from public.pages
  where id = p_page_id;

  if v_page_agency_id is null then
    raise exception 'page_not_found';
  end if;

  if v_actor_role is distinct from 'super_admin' and v_page_agency_id <> v_actor_id then
    raise exception 'forbidden_page_access';
  end if;

  perform set_config('app.skip_page_reel_count_updates', '1', true);

  with locked_rows as (
    select r.id
    from public.reels r
    where r.page_id = p_page_id
      and r.status = 'pending'
    order by r.id
    for update skip locked
    limit greatest(coalesce(p_batch_size, 2000), 1)
  )
  delete from public.reels d
  using locked_rows l
  where d.id = l.id;

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
