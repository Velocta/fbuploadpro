-- Add follower refresh cycle flag and include it in bulk page updates.
-- Date: 2026-04-23

alter table if exists public.pages
  add column if not exists is_followers_updated boolean not null default false;

create index if not exists idx_pages_active_followers_cycle
  on public.pages (status, is_followers_updated, updated_at);

create or replace function public.bulk_update_page_metrics(p_updates jsonb)
returns integer as $$
declare
  v_updated_count integer := 0;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) = 0 then
    return 0;
  end if;

  with payload as (
    select
      case
        when coalesce(item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (item->>'id')::uuid
        else null
      end as id,
      case
        when coalesce(item->>'followers_gained', '') ~ '^-?[0-9]+$'
        then (item->>'followers_gained')::bigint
        else null
      end as followers_gained,
      nullif(item->>'fb_page_image', '') as fb_page_image,
      case
        when coalesce(item->>'status', '') in (
          'active',
          'inactive',
          'fb_verification_required',
          'invalid_token',
          'invalid_username',
          'completed',
          '2fa_required_on_BM',
          'check_developer_app',
          'account_suspended'
        )
        then (item->>'status')::public.profile_status_enum
        else null
      end as status,
      case
        when lower(coalesce(item->>'is_followers_updated', '')) in ('true', 'false')
        then (item->>'is_followers_updated')::boolean
        else null
      end as is_followers_updated
    from jsonb_array_elements(p_updates) as item
    where item ? 'id'
  )
  update public.pages p
  set
    followers_gained = coalesce(payload.followers_gained, p.followers_gained),
    fb_page_image = coalesce(payload.fb_page_image, p.fb_page_image),
    status = coalesce(payload.status, p.status),
    is_followers_updated = coalesce(payload.is_followers_updated, p.is_followers_updated)
  from payload
  where payload.id is not null
    and p.id = payload.id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$ language plpgsql security definer;
