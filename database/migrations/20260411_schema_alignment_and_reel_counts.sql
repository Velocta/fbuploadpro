-- Migration: Align production schema snapshot with reel count denormalization and RLS intent
-- Date: 2026-04-11

-- 1) Ensure denormalized page reel count columns exist
alter table public.pages
add column if not exists pending_reels_count int not null default 0,
add column if not exists posted_reels_count int not null default 0,
add column if not exists failed_reels_count int not null default 0;

-- 2) Backfill counts from current reels
update public.pages p
set
  pending_reels_count = coalesce((
    select count(*) from public.reels r where r.page_id = p.id and r.status = 'pending'
  ), 0),
  posted_reels_count = coalesce((
    select count(*) from public.reels r where r.page_id = p.id and r.status = 'posted'
  ), 0),
  failed_reels_count = coalesce((
    select count(*) from public.reels r where r.page_id = p.id and r.status = 'failed'
  ), 0);

-- 3) Keep counts in sync on reels mutations
create or replace function public.update_page_reel_counts()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    if new.status = 'pending' then
      update public.pages set pending_reels_count = pending_reels_count + 1 where id = new.page_id;
    elsif new.status = 'posted' then
      update public.pages set posted_reels_count = posted_reels_count + 1 where id = new.page_id;
    elsif new.status = 'failed' then
      update public.pages set failed_reels_count = failed_reels_count + 1 where id = new.page_id;
    end if;
  elsif (tg_op = 'UPDATE') then
    if old.page_id <> new.page_id or old.status <> new.status then
      if old.status = 'pending' then
        update public.pages set pending_reels_count = pending_reels_count - 1 where id = old.page_id;
      elsif old.status = 'posted' then
        update public.pages set posted_reels_count = posted_reels_count - 1 where id = old.page_id;
      elsif old.status = 'failed' then
        update public.pages set failed_reels_count = failed_reels_count - 1 where id = old.page_id;
      end if;

      if new.status = 'pending' then
        update public.pages set pending_reels_count = pending_reels_count + 1 where id = new.page_id;
      elsif new.status = 'posted' then
        update public.pages set posted_reels_count = posted_reels_count + 1 where id = new.page_id;
      elsif new.status = 'failed' then
        update public.pages set failed_reels_count = failed_reels_count + 1 where id = new.page_id;
      end if;
    end if;
  elsif (tg_op = 'DELETE') then
    if old.status = 'pending' then
      update public.pages set pending_reels_count = pending_reels_count - 1 where id = old.page_id;
    elsif old.status = 'posted' then
      update public.pages set posted_reels_count = posted_reels_count - 1 where id = old.page_id;
    elsif old.status = 'failed' then
      update public.pages set failed_reels_count = failed_reels_count - 1 where id = old.page_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists tr_update_page_reel_counts on public.reels;
create trigger tr_update_page_reel_counts
after insert or update or delete on public.reels
for each row execute function public.update_page_reel_counts();

-- 4) Make auth_attempts service role policy explicit
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'auth_attempts'
      and policyname = 'Service role full access'
  ) then
    create policy "Service role full access" on public.auth_attempts
      for all to service_role using (true) with check (true);
  end if;
end $$;
