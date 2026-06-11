-- Remove fb_user_url column from facebook_accounts table
alter table public.facebook_accounts drop column if exists fb_user_url;

-- Recreate bulk_update_facebook_accounts function without fb_user_url
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
    status = coalesce(payload.status, fa.status),
    updated_at = now()
  from payload
  where payload.id is not null
    and fa.id = payload.id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$ language plpgsql security definer;
