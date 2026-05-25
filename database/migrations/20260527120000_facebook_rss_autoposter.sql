-- Facebook RSS Auto Poster: pages, items, dedup (7-day), slot posting RPCs

-- facebook_rss_autoposter_pages
create table if not exists public.facebook_rss_autoposter_pages (
  id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.users(id) on delete cascade not null,
  facebook_account_id uuid references public.facebook_accounts(id) on delete cascade not null,
  fb_page_id text not null,
  fb_page_name text,
  fb_page_image text,
  fb_page_access_token text not null,
  rss_feed_url text not null,
  status text not null default 'active' check (status in ('active', 'paused')),
  timezone text not null default 'UTC',
  posts_per_day int not null default 1 check (posts_per_day >= 0 and posts_per_day <= 12),
  schedule_type public.schedule_type_enum not null default 'dailyrandom',
  posting_times jsonb not null default '[]'::jsonb,
  template_definition jsonb not null default '{}'::jsonb,
  template_preset_key text,
  canvas_aspect_ratio text not null default '4:5' check (canvas_aspect_ratio in ('4:5', '1:1', '16:9')),
  brand_logo_object_key text,
  brand_site_url text,
  first_comment text,
  last_fetch_error text,
  feed_etag text,
  feed_last_modified text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_fb_rss_page_per_agency unique (agency_id, fb_page_id),
  constraint facebook_rss_autoposter_pages_posting_times_check
    check (public.is_valid_posting_times(posting_times))
);

create index if not exists idx_facebook_rss_autoposter_pages_status
  on public.facebook_rss_autoposter_pages (status);

drop trigger if exists tr_facebook_rss_autoposter_pages_updated_at on public.facebook_rss_autoposter_pages;
create trigger tr_facebook_rss_autoposter_pages_updated_at
before update on public.facebook_rss_autoposter_pages
for each row execute procedure public.update_updated_at_column();

alter table public.facebook_rss_autoposter_pages enable row level security;

drop policy if exists "Agencies manage own facebook_rss_autoposter_pages" on public.facebook_rss_autoposter_pages;
create policy "Agencies manage own facebook_rss_autoposter_pages"
  on public.facebook_rss_autoposter_pages for all
  using (agency_id = auth.uid())
  with check (agency_id = auth.uid());

drop policy if exists "Super Admin read facebook_rss_autoposter_pages" on public.facebook_rss_autoposter_pages;
create policy "Super Admin read facebook_rss_autoposter_pages"
  on public.facebook_rss_autoposter_pages for select
  using (public.get_my_role() = 'super_admin');

drop policy if exists "Service role full access facebook_rss_autoposter_pages" on public.facebook_rss_autoposter_pages;
create policy "Service role full access facebook_rss_autoposter_pages"
  on public.facebook_rss_autoposter_pages for all to service_role
  using (true) with check (true);

-- facebook_rss_autoposter_items
create table if not exists public.facebook_rss_autoposter_items (
  id uuid default gen_random_uuid() primary key,
  page_id uuid references public.facebook_rss_autoposter_pages(id) on delete cascade not null,
  agency_id uuid references public.users(id) on delete cascade not null,
  item_guid text not null,
  title text,
  description text,
  link text,
  source_image_url text,
  status text not null default 'rendering' check (status in (
    'rendering', 'pending_publish', 'published', 'failed', 'skipped'
  )),
  scheduled_at timestamptz not null default now(),
  rendered_object_key text,
  graph_post_id text,
  tokens_charged int not null default 0,
  error_message text,
  retry_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_facebook_rss_autoposter_items_status_scheduled
  on public.facebook_rss_autoposter_items (status, scheduled_at);

create index if not exists idx_facebook_rss_autoposter_items_dedup
  on public.facebook_rss_autoposter_items (page_id, item_guid, created_at desc);

create index if not exists idx_facebook_rss_autoposter_items_page_created
  on public.facebook_rss_autoposter_items (page_id, created_at desc);

drop trigger if exists tr_facebook_rss_autoposter_items_updated_at on public.facebook_rss_autoposter_items;
create trigger tr_facebook_rss_autoposter_items_updated_at
before update on public.facebook_rss_autoposter_items
for each row execute procedure public.update_updated_at_column();

alter table public.facebook_rss_autoposter_items enable row level security;

drop policy if exists "Agencies manage own facebook_rss_autoposter_items" on public.facebook_rss_autoposter_items;
create policy "Agencies manage own facebook_rss_autoposter_items"
  on public.facebook_rss_autoposter_items for all
  using (agency_id = auth.uid())
  with check (agency_id = auth.uid());

drop policy if exists "Super Admin read facebook_rss_autoposter_items" on public.facebook_rss_autoposter_items;
create policy "Super Admin read facebook_rss_autoposter_items"
  on public.facebook_rss_autoposter_items for select
  using (public.get_my_role() = 'super_admin');

drop policy if exists "Service role full access facebook_rss_autoposter_items" on public.facebook_rss_autoposter_items;
create policy "Service role full access facebook_rss_autoposter_items"
  on public.facebook_rss_autoposter_items for all to service_role
  using (true) with check (true);

-- Token cost
insert into public.token_cost_rules (feature, platform, media_type, source_platform, token_cost)
select v.feature, v.platform, v.media_type, v.source_platform, v.token_cost
from (values
  ('rss_autoposter'::text, 'facebook'::text, 'image'::text, null::text, 1)
) as v(feature, platform, media_type, source_platform, token_cost)
where not exists (
  select 1 from public.token_cost_rules r
  where r.feature = v.feature
    and r.platform = v.platform
    and r.media_type = v.media_type
    and coalesce(r.source_platform, '') = coalesce(v.source_platform, '')
);

-- Dedup helper
create or replace function public.is_rss_item_posted_in_window(
  p_page_id uuid,
  p_item_guid text,
  p_days int default 7
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.facebook_rss_autoposter_items i
    where i.page_id = p_page_id
      and i.item_guid = p_item_guid
      and i.created_at >= now() - make_interval(days => greatest(1, coalesce(p_days, 7)))
      and i.status in ('rendering', 'pending_publish', 'published', 'skipped')
  );
$$;

revoke all on function public.is_rss_item_posted_in_window(uuid, text, int) from public;
grant execute on function public.is_rss_item_posted_in_window(uuid, text, int) to service_role;

-- Pages due for current posting minute
create or replace function public.get_facebook_rss_autoposter_pages_due_posting()
returns setof public.facebook_rss_autoposter_pages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select p.*
  from public.facebook_rss_autoposter_pages p
  join public.users u on p.agency_id = u.id
  where p.status = 'active'
    and p.posts_per_day > 0
    and u.is_active_override = true
    and u.tokens_balance >= 1
    and exists (
      select 1
      from jsonb_array_elements_text(p.posting_times) as t(schedule_time)
      where schedule_time::time between now()::time and (now() + interval '1 minute')::time
    );
end;
$$;

revoke all on function public.get_facebook_rss_autoposter_pages_due_posting() from public;
grant execute on function public.get_facebook_rss_autoposter_pages_due_posting() to service_role;

-- Claim page for slot (avoid double post same minute)
create or replace function public.claim_facebook_rss_autoposter_page(p_page_id uuid)
returns public.facebook_rss_autoposter_pages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page public.facebook_rss_autoposter_pages;
begin
  select * into v_page
  from public.facebook_rss_autoposter_pages
  where id = p_page_id
    and status = 'active'
  for update skip locked;

  if not found then
    return null;
  end if;

  return v_page;
end;
$$;

revoke all on function public.claim_facebook_rss_autoposter_page(uuid) from public;
grant execute on function public.claim_facebook_rss_autoposter_page(uuid) to service_role;

-- Finalize published item
create or replace function public.finalize_facebook_rss_autoposter_item(
  p_item_id uuid,
  p_graph_post_id text,
  p_rendered_object_key text,
  p_tokens_charged int default 0
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.facebook_rss_autoposter_items
  set
    status = 'published',
    graph_post_id = p_graph_post_id,
    rendered_object_key = coalesce(p_rendered_object_key, rendered_object_key),
    tokens_charged = coalesce(p_tokens_charged, 0),
    published_at = now(),
    error_message = null,
    updated_at = now()
  where id = p_item_id;
end;
$$;

revoke all on function public.finalize_facebook_rss_autoposter_item(uuid, text, text, int) from public;
grant execute on function public.finalize_facebook_rss_autoposter_item(uuid, text, text, int) to service_role;

-- Purge terminal items older than 7 days
create or replace function public.cleanup_old_facebook_rss_autoposter_items()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
begin
  with deleted as (
    delete from public.facebook_rss_autoposter_items
    where created_at < now() - interval '7 days'
      and status in ('published', 'failed', 'skipped')
    returning id
  )
  select count(*)::int into v_deleted from deleted;
  return coalesce(v_deleted, 0);
end;
$$;

revoke all on function public.cleanup_old_facebook_rss_autoposter_items() from public;
grant execute on function public.cleanup_old_facebook_rss_autoposter_items() to service_role;

select cron.schedule(
  'cleanup-rss-autoposter-items',
  '0 3 * * *',
  'select public.cleanup_old_facebook_rss_autoposter_items()'
);
