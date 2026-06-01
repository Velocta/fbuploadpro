-- ADU two-stage discovery: yt-dlp first, browser fallback via browser_pending queue.

alter type public.sync_status_enum add value if not exists 'browser_pending' after 'pending';

create or replace function public.reset_stuck_pages()
returns void as $$
begin
  update public.pages
  set sync_status = 'browser_pending'
  where sync_status = 'processing'
    and updated_at < now() - interval '1 hour';
end;
$$ language plpgsql security definer;

create or replace function public.get_next_browser_pending_page(p_platform public.source_platform_enum default null)
returns table (id uuid, source_username text, source_platform public.source_platform_enum) as $$
begin
  return query
  update public.pages
  set sync_status = 'processing'
  where public.pages.id = (
    select p.id
    from public.pages p
    where p.sync_status = 'browser_pending'
    and (p_platform is null or p.source_platform = p_platform)
    limit 1
    for update skip locked
  )
  returning public.pages.id, public.pages.source_username, public.pages.source_platform;
end;
$$ language plpgsql security definer;
