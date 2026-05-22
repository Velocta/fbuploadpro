-- Migration: add bulk RPC for updating page followers/image metrics
-- Date: 2026-04-13

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
      (item->>'id')::uuid as id,
      coalesce((item->>'followers_gained')::bigint, 0) as followers_gained,
      nullif(item->>'fb_page_image', '') as fb_page_image
    from jsonb_array_elements(p_updates) as item
    where item ? 'id'
  )
  update public.pages p
  set
    followers_gained = payload.followers_gained,
    fb_page_image = payload.fb_page_image
  from payload
  where p.id = payload.id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$ language plpgsql security definer;
