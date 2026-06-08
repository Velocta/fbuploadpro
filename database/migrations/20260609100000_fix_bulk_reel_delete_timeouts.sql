-- Fix statement timeouts when agencies delete pages or change source username.
-- Root cause: row-level reel counter trigger + large REST DELETE batches under default 8s timeout.

create or replace function public.refresh_page_reel_counts(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.pages p
    where p.id = p_page_id
      and (p.agency_id = auth.uid() or public.get_my_role() = 'super_admin')
  ) then
    raise exception 'forbidden';
  end if;

  update public.pages p
  set
    pending_reels_count = c.pending_cnt,
    posted_reels_count = c.posted_cnt,
    failed_reels_count = c.failed_cnt,
    updated_at = now()
  from (
    select
      count(*) filter (where r.status = 'pending') as pending_cnt,
      count(*) filter (where r.status = 'posted') as posted_cnt,
      count(*) filter (where r.status = 'failed') as failed_cnt
    from public.reels r
    where r.page_id = p_page_id
  ) c
  where p.id = p_page_id;
end;
$$;

grant execute on function public.refresh_page_reel_counts(uuid) to authenticated;

-- Clears pending reels for the previous source handle on a page (source change flow).
create or replace function public.delete_old_source_reels_batch(
  p_page_id uuid,
  p_old_username text,
  p_batch_size int default 500
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '180s'
as $$
declare
  v_batch int := greatest(1, least(coalesce(p_batch_size, 500), 2000));
  v_deleted int;
  v_total bigint := 0;
  v_username text := btrim(coalesce(p_old_username, ''));
begin
  if v_username = '' then
    return 0;
  end if;

  if not exists (
    select 1
    from public.pages p
    where p.id = p_page_id
      and (p.agency_id = auth.uid() or public.get_my_role() = 'super_admin')
  ) then
    raise exception 'forbidden';
  end if;

  perform set_config('app.skip_page_reel_count_updates', '1', true);

  begin
    loop
      delete from public.reels r
      where r.id in (
        select r2.id
        from public.reels r2
        where r2.page_id = p_page_id
          and r2.username = v_username
          and r2.status = 'pending'
        order by r2.id
        limit v_batch
      );

      get diagnostics v_deleted = row_count;
      v_total := v_total + v_deleted;
      exit when v_deleted = 0;
    end loop;
  exception
    when others then
      perform set_config('app.skip_page_reel_count_updates', '0', true);
      raise;
  end;

  perform public.refresh_page_reel_counts(p_page_id);
  perform set_config('app.skip_page_reel_count_updates', '0', true);

  return v_total;
end;
$$;

grant execute on function public.delete_old_source_reels_batch(uuid, text, int) to authenticated;

create or replace function public.delete_page_with_reels(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '180s'
as $$
declare
  v_deleted int;
  v_batch int := 500;
begin
  if not exists (
    select 1
    from public.pages p
    where p.id = p_page_id
      and (p.agency_id = auth.uid() or public.get_my_role() = 'super_admin')
  ) then
    raise exception 'forbidden';
  end if;

  perform set_config('app.skip_page_reel_count_updates', '1', true);

  begin
    loop
      delete from public.reels r
      where r.id in (
        select r2.id
        from public.reels r2
        where r2.page_id = p_page_id
        order by r2.id
        limit v_batch
      );

      get diagnostics v_deleted = row_count;
      exit when v_deleted = 0;
    end loop;
  exception
    when others then
      perform set_config('app.skip_page_reel_count_updates', '0', true);
      raise;
  end;

  perform set_config('app.skip_page_reel_count_updates', '0', true);

  delete from public.pages where id = p_page_id;
end;
$$;

grant execute on function public.delete_page_with_reels(uuid) to authenticated;
