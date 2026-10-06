-- Create agency_page_stats view
create or replace view public.agency_page_stats 
with (security_invoker = true) as
with adu_stats as (
  select 
    agency_id, 
    count(*) as adu_total, 
    count(*) filter (where status = 'active') as adu_active,
    sum(coalesce(followers_gained, 0)) as adu_followers_gained,
    sum(coalesce(changed_followers, 0)) as adu_changed_followers
  from public.pages 
  group by agency_id
),
inapp_stats as (
  select 
    agency_id, 
    count(*) as inapp_total, 
    count(*) filter (where status = 'active') as inapp_active,
    sum(coalesce(followers_gained, 0)) as inapp_followers_gained,
    sum(coalesce(changed_followers, 0)) as inapp_changed_followers
  from public.facebook_inapp_schedule_pages 
  group by agency_id
)
select 
  u.id as agency_id,
  coalesce(a.adu_total, 0) as adu_total_pages,
  coalesce(a.adu_active, 0) as adu_active_pages,
  coalesce(a.adu_followers_gained, 0)::bigint as adu_followers_gained,
  coalesce(a.adu_changed_followers, 0)::bigint as adu_changed_followers,
  coalesce(i.inapp_total, 0) as inapp_total_pages,
  coalesce(i.inapp_active, 0) as inapp_active_pages,
  coalesce(i.inapp_followers_gained, 0)::bigint as inapp_followers_gained,
  coalesce(i.inapp_changed_followers, 0)::bigint as inapp_changed_followers
from public.users u
left join adu_stats a on a.agency_id = u.id
left join inapp_stats i on i.agency_id = u.id;

grant select on public.agency_page_stats to authenticated;
