-- Raise local statement timeout for cleanup RPC and simplify chunk delete path.
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
  -- Keep this local to the current transaction invoked by this RPC call.
  perform set_config('statement_timeout', '120s', true);

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

  with rows_to_delete as (
    select r.id
    from public.reels r
    where r.page_id = p_page_id
      and r.status = 'pending'
    order by r.id
    limit greatest(coalesce(p_batch_size, 2000), 1)
  )
  delete from public.reels d
  using rows_to_delete x
  where d.id = x.id;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;
