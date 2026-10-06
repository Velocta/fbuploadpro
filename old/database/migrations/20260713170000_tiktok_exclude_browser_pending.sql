-- Reset all stuck pages to pending instead of browser_pending
create or replace function public.reset_stuck_pages()
returns void as $$
begin
  update public.pages
  set sync_status = 'pending'
  where sync_status = 'processing'
    and updated_at < now() - interval '1 hour';
end;
$$ language plpgsql security definer;
