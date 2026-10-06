-- Create public.site_stats view for landing page stats
create or replace view public.site_stats 
with (security_invoker = true) as
select 
  (
    select coalesce(sum(followers_gained), 0)::bigint 
    from public.pages
  ) + (
    select coalesce(sum(followers_gained), 0)::bigint 
    from public.facebook_inapp_schedule_pages
  ) as total_followers_gained,
  (
    select count(*)::bigint 
    from public.users
  ) as total_users;

grant select on public.site_stats to anon, authenticated;
