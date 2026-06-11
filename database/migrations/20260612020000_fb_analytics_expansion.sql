-- Add fb_user_url column to facebook_accounts table
alter table public.facebook_accounts add column if not exists fb_user_url text;

-- Create bulk_update_facebook_accounts function
create or replace function public.bulk_update_facebook_accounts(p_updates jsonb)
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
      nullif(item->>'fb_user_name', '') as fb_user_name,
      nullif(item->>'fb_user_image', '') as fb_user_image,
      nullif(item->>'fb_user_url', '') as fb_user_url,
      case
        when coalesce(item->>'status', '') in ('active', 'invalid_token', 'fb_verification_required', '2fa_required_on_BM', 'check_developer_app', 'account_suspended')
        then (item->>'status')::public.profile_status_enum
        else null
      end as status
    from jsonb_array_elements(p_updates) as item
    where item ? 'id'
  )
  update public.facebook_accounts fa
  set
    fb_user_name = coalesce(payload.fb_user_name, fa.fb_user_name),
    fb_user_image = coalesce(payload.fb_user_image, fa.fb_user_image),
    fb_user_url = coalesce(payload.fb_user_url, fa.fb_user_url),
    status = coalesce(payload.status, fa.status),
    updated_at = now()
  from payload
  where payload.id is not null
    and fa.id = payload.id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$ language plpgsql security definer;

-- Replace bulk_update_page_metrics to support updating page_name
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
      nullif(item->>'page_name', '') as page_name,
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
          'account_suspended',
          'creator_suspended',
          'fb_rate_limited',
          'page_not_accessible'
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
    page_name = coalesce(payload.page_name, p.page_name),
    status = coalesce(payload.status, p.status),
    is_followers_updated = coalesce(payload.is_followers_updated, p.is_followers_updated),
    updated_at = now()
  from payload
  where payload.id is not null
    and p.id = payload.id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$ language plpgsql security definer;
