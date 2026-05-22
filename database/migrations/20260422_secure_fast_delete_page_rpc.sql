-- Delete page with bulk-safe trigger behavior to avoid statement timeout
-- on large reel cascades, with tenant-safe authorization checks.
-- Date: 2026-04-22

create or replace function public.delete_page_with_fast_cleanup(p_page_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid;
  v_actor_role public.user_role_enum;
  v_page_agency_id uuid;
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

  -- Prevent per-row page counter updates while cascade-deleting reels.
  perform set_config('app.skip_page_reel_count_updates', '1', true);

  delete from public.pages
  where id = p_page_id;

  return true;
end;
$$;

grant execute on function public.delete_page_with_fast_cleanup(uuid) to authenticated;
grant execute on function public.delete_page_with_fast_cleanup(uuid) to service_role;
