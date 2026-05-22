-- Platform features: token costs, Facebook direct post/schedule/inapp schedule tables + claim RPC

-- token_cost_rules
create table if not exists public.token_cost_rules (
  id uuid default gen_random_uuid() primary key,
  feature text not null,
  platform text not null,
  media_type text not null default '*',
  source_platform text,
  token_cost int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists ux_token_cost_rules_lookup
  on public.token_cost_rules (feature, platform, media_type, coalesce(source_platform, ''));

drop trigger if exists tr_token_cost_rules_updated_at on public.token_cost_rules;
create trigger tr_token_cost_rules_updated_at
before update on public.token_cost_rules
for each row execute procedure public.update_updated_at_column();

alter table public.token_cost_rules enable row level security;

drop policy if exists "Viewable by everyone token_cost_rules" on public.token_cost_rules;
create policy "Viewable by everyone token_cost_rules"
  on public.token_cost_rules for select using (true);

drop policy if exists "Manageable by Super Admin token_cost_rules" on public.token_cost_rules;
create policy "Manageable by Super Admin token_cost_rules"
  on public.token_cost_rules for all
  using (public.get_my_role() = 'super_admin')
  with check (public.get_my_role() = 'super_admin');

insert into public.token_cost_rules (feature, platform, media_type, source_platform, token_cost)
select v.feature, v.platform, v.media_type, v.source_platform, v.token_cost
from (values
  ('auto_download_upload'::text, 'facebook'::text, '*'::text, 'instagram'::text, 1),
  ('auto_download_upload', 'facebook', '*', 'youtube', 2),
  ('auto_download_upload', 'facebook', '*', 'tiktok', 2),
  ('direct_post', 'facebook', '*', null::text, 0),
  ('direct_schedule', 'facebook', '*', null, 0),
  ('inapp_schedule', 'facebook', '*', null, 1)
) as v(feature, platform, media_type, source_platform, token_cost)
where not exists (
  select 1 from public.token_cost_rules r
  where r.feature = v.feature
    and r.platform = v.platform
    and r.media_type = v.media_type
    and coalesce(r.source_platform, '') = coalesce(v.source_platform, '')
);

-- facebook_direct_posts
create table if not exists public.facebook_direct_posts (
  id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.users(id) on delete cascade not null,
  facebook_account_id uuid references public.facebook_accounts(id) on delete set null,
  fb_page_id text not null,
  fb_page_name text,
  media_type text not null check (media_type in ('text', 'image', 'video')),
  caption text,
  first_comment text,
  graph_post_id text,
  status text not null default 'published' check (status in ('published', 'failed')),
  error_message text,
  tokens_charged int not null default 0,
  created_at timestamptz default now()
);

alter table public.facebook_direct_posts enable row level security;

drop policy if exists "Agencies manage own facebook_direct_posts" on public.facebook_direct_posts;
create policy "Agencies manage own facebook_direct_posts"
  on public.facebook_direct_posts for all
  using (agency_id = auth.uid())
  with check (agency_id = auth.uid());

drop policy if exists "Super Admin read facebook_direct_posts" on public.facebook_direct_posts;
create policy "Super Admin read facebook_direct_posts"
  on public.facebook_direct_posts for select
  using (public.get_my_role() = 'super_admin');

drop policy if exists "Service role full access facebook_direct_posts" on public.facebook_direct_posts;
create policy "Service role full access facebook_direct_posts"
  on public.facebook_direct_posts for all to service_role
  using (true) with check (true);

-- facebook_direct_schedule_pages
create table if not exists public.facebook_direct_schedule_pages (
  id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.users(id) on delete cascade not null,
  facebook_account_id uuid references public.facebook_accounts(id) on delete cascade not null,
  fb_page_id text not null,
  fb_page_name text,
  fb_page_image text,
  fb_page_access_token text not null,
  created_at timestamptz default now(),
  constraint unique_fb_ds_page_per_agency unique (agency_id, fb_page_id)
);

alter table public.facebook_direct_schedule_pages enable row level security;

drop policy if exists "Agencies manage own facebook_direct_schedule_pages" on public.facebook_direct_schedule_pages;
create policy "Agencies manage own facebook_direct_schedule_pages"
  on public.facebook_direct_schedule_pages for all
  using (agency_id = auth.uid())
  with check (agency_id = auth.uid());

drop policy if exists "Super Admin read facebook_direct_schedule_pages" on public.facebook_direct_schedule_pages;
create policy "Super Admin read facebook_direct_schedule_pages"
  on public.facebook_direct_schedule_pages for select
  using (public.get_my_role() = 'super_admin');

-- facebook_inapp_schedule_pages
create table if not exists public.facebook_inapp_schedule_pages (
  id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.users(id) on delete cascade not null,
  facebook_account_id uuid references public.facebook_accounts(id) on delete cascade not null,
  fb_page_id text not null,
  fb_page_name text,
  fb_page_image text,
  fb_page_access_token text not null,
  created_at timestamptz default now(),
  constraint unique_fb_is_page_per_agency unique (agency_id, fb_page_id)
);

alter table public.facebook_inapp_schedule_pages enable row level security;

drop policy if exists "Agencies manage own facebook_inapp_schedule_pages" on public.facebook_inapp_schedule_pages;
create policy "Agencies manage own facebook_inapp_schedule_pages"
  on public.facebook_inapp_schedule_pages for all
  using (agency_id = auth.uid())
  with check (agency_id = auth.uid());

drop policy if exists "Super Admin read facebook_inapp_schedule_pages" on public.facebook_inapp_schedule_pages;
create policy "Super Admin read facebook_inapp_schedule_pages"
  on public.facebook_inapp_schedule_pages for select
  using (public.get_my_role() = 'super_admin');

-- facebook_direct_schedule_posts
create table if not exists public.facebook_direct_schedule_posts (
  id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.users(id) on delete cascade not null,
  page_id uuid references public.facebook_direct_schedule_pages(id) on delete cascade not null,
  fb_page_id text not null,
  media_type text not null check (media_type in ('text', 'image', 'video')),
  media_object_key text,
  caption text,
  scheduled_publish_time timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'scheduled' check (status in ('scheduled', 'published', 'cancelled', 'failed')),
  graph_post_id text,
  facebook_schedule_id text,
  tokens_charged int not null default 0,
  error_message text,
  created_at timestamptz default now()
);

alter table public.facebook_direct_schedule_posts enable row level security;

drop policy if exists "Agencies manage own facebook_direct_schedule_posts" on public.facebook_direct_schedule_posts;
create policy "Agencies manage own facebook_direct_schedule_posts"
  on public.facebook_direct_schedule_posts for all
  using (agency_id = auth.uid())
  with check (agency_id = auth.uid());

drop policy if exists "Super Admin read facebook_direct_schedule_posts" on public.facebook_direct_schedule_posts;
create policy "Super Admin read facebook_direct_schedule_posts"
  on public.facebook_direct_schedule_posts for select
  using (public.get_my_role() = 'super_admin');

-- facebook_inapp_schedule_posts
create table if not exists public.facebook_inapp_schedule_posts (
  id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.users(id) on delete cascade not null,
  page_id uuid references public.facebook_inapp_schedule_pages(id) on delete cascade not null,
  fb_page_id text not null,
  fb_page_access_token text not null,
  media_type text not null check (media_type in ('text', 'image', 'video')),
  media_object_key text,
  caption text,
  first_comment text,
  scheduled_at timestamptz not null,
  timezone text not null default 'UTC',
  status text not null default 'pending' check (status in ('pending', 'publishing', 'published', 'failed')),
  retry_count int not null default 0,
  graph_post_id text,
  tokens_charged int not null default 0,
  published_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_facebook_inapp_schedule_posts_status_scheduled
  on public.facebook_inapp_schedule_posts (status, scheduled_at);

drop trigger if exists tr_facebook_inapp_schedule_posts_updated_at on public.facebook_inapp_schedule_posts;
create trigger tr_facebook_inapp_schedule_posts_updated_at
before update on public.facebook_inapp_schedule_posts
for each row execute procedure public.update_updated_at_column();

alter table public.facebook_inapp_schedule_posts enable row level security;

drop policy if exists "Agencies manage own facebook_inapp_schedule_posts" on public.facebook_inapp_schedule_posts;
create policy "Agencies manage own facebook_inapp_schedule_posts"
  on public.facebook_inapp_schedule_posts for all
  using (agency_id = auth.uid())
  with check (agency_id = auth.uid());

drop policy if exists "Super Admin read facebook_inapp_schedule_posts" on public.facebook_inapp_schedule_posts;
create policy "Super Admin read facebook_inapp_schedule_posts"
  on public.facebook_inapp_schedule_posts for select
  using (public.get_my_role() = 'super_admin');

drop policy if exists "Service role full access facebook_inapp_schedule_posts" on public.facebook_inapp_schedule_posts;
create policy "Service role full access facebook_inapp_schedule_posts"
  on public.facebook_inapp_schedule_posts for all to service_role
  using (true) with check (true);

-- Claim RPC for inapp schedule worker
create or replace function public.claim_due_facebook_inapp_schedule_posts(p_limit int default 10)
returns setof public.facebook_inapp_schedule_posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select p.id
    from public.facebook_inapp_schedule_posts p
    where p.status = 'pending'
      and p.scheduled_at <= now()
    order by p.scheduled_at asc
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update skip locked
  ),
  claimed as (
    update public.facebook_inapp_schedule_posts t
    set status = 'publishing', updated_at = now()
    from due
    where t.id = due.id
    returning t.*
  )
  select * from claimed;
end;
$$;

revoke all on function public.claim_due_facebook_inapp_schedule_posts(int) from public;
grant execute on function public.claim_due_facebook_inapp_schedule_posts(int) to service_role;
