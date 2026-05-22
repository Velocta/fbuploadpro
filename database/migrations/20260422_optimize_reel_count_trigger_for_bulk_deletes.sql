-- Reduce timeout risk during source updates/page deletes by avoiding
-- row-by-row page counter writes in known bulk-delete paths.
-- Date: 2026-04-22

create or replace function public.update_page_reel_counts()
returns trigger as $$
begin
  -- Allow controlled bulk operations to bypass row-by-row counter writes.
  if current_setting('app.skip_page_reel_count_updates', true) = '1' then
    return null;
  end if;

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
    -- When a page delete cascades into reels deletes, skip expensive counter updates.
    if not exists (select 1 from public.pages where id = old.page_id) then
      return null;
    end if;

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
