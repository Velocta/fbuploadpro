-- FBUploadPro - Canonical production schema (consolidated 2026-05-22)
-- Single source of truth for Supabase PostgreSQL. Apply to fresh DBs or use as reference.
-- Includes: core tables, RLS, posting_jobs_v2 pipeline RPCs, pg_cron jobs.
-- Historical migrations were merged into this file; new changes add files under database/migrations/.

-- 0. Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- 1. Custom Enums
create type public.user_role_enum as enum ('super_admin', 'agency');
create type public.subscription_type_enum as enum ('new', 'renewal', 'upgrade', 'correction');
create type public.schedule_type_enum as enum ('fixed', 'randomfixed', 'dailyrandom');
create type public.reel_status_enum as enum ('pending', 'posted', 'failed', 'processing', 'downloaded', 'download_failed');
create type public.sync_status_enum as enum ('pending', 'browser_pending', 'synced', 'processing', 'error');
create type public.profile_status_enum as enum ('active', 'inactive', 'fb_verification_required', 'invalid_token', 'invalid_username', 'completed', '2fa_required_on_BM', 'check_developer_app', 'account_suspended', 'creator_suspended');
create type public.platform_enum as enum ('instagram', 'youtube', 'tiktok', 'facebook');
create type public.source_platform_enum as enum ('instagram', 'youtube', 'tiktok', 'facebook');
create type public.auth_attempt_type as enum ('login', 'forgot_password', 'otp', 'signup', 'resend');
create type public.token_transaction_type as enum ('purchase', 'usage', 'refund', 'adjustment');

create or replace function public.is_valid_posting_times(p_times jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(p_times) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements_text(p_times) as t(v)
      where t.v !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    );
$$;

-- 2. Tables

-- Users Table (Extends auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  name text,
  phone_number text not null default '',
  subdomain text unique,
  role user_role_enum not null default 'agency',
  tokens_balance bigint default 0,
  is_active_override boolean default true,
  rss_autoposter_enabled boolean not null default false,

  -- Agency-Level BYOC Facebook App Credentials
  fb_app_id text unique default null,
  fb_app_name text,
  fb_app_secret text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.users is 'Unified users table. Tokens are now non-expiring. Posting is restricted only by tokens_balance.';
comment on column public.users.rss_autoposter_enabled is 'When true, agency can access RSS Auto Poster UI and APIs.';



-- Facebook Accounts Table (Connected User Identities)
create table public.facebook_accounts (
  id uuid default uuid_generate_v4() primary key,
  agency_id uuid references public.users(id) on delete cascade not null,
  
  -- Facebook specific data
  fb_user_id text not null,
  fb_user_name text,
  fb_user_image text,
  fb_user_access_token text not null, -- Long-lived token
  status profile_status_enum not null default 'invalid_token',

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint unique_fb_user_per_agency unique (agency_id, fb_user_id)
);

-- Pages Table (Managed Destinations)
create table public.pages (
  id uuid default uuid_generate_v4() primary key,
  agency_id uuid references public.users(id) on delete cascade not null,
  facebook_account_id uuid references public.facebook_accounts(id) on delete cascade,
  
  -- Identifiers
  page_name text not null,
  fb_page_id text not null,
  fb_page_access_token text,
  fb_page_image text,
  status profile_status_enum default 'active',
  
  -- Source Configuration
  source_platform source_platform_enum default 'instagram',
  source_username text not null,
  sync_status sync_status_enum default 'pending',
  
  -- Scheduling
  followers_count bigint default 0,
  followers_gained bigint not null default 0,
  changed_followers bigint generated always as (coalesce(followers_gained, 0) - coalesce(followers_count, 0)) stored,
  pending_reels_count int default 0,
  posted_reels_count int default 0,
  failed_reels_count int default 0,
  is_followers_updated boolean not null default false,
  posts_per_day int default 0 check (posts_per_day <= 12),
  schedule_type schedule_type_enum default 'dailyrandom',
  posting_times jsonb default '[]'::jsonb,
  timezone text not null default 'UTC',
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Constraints
  constraint unique_page_per_account unique (facebook_account_id, fb_page_id),
  constraint unique_source_username_per_agency unique (agency_id, source_username),
  constraint pages_posting_times_hhmm_check check (public.is_valid_posting_times(posting_times))
);

-- Reels Table
create table public.reels (
  id bigint generated by default as identity primary key,
  page_id uuid references public.pages(id) on delete cascade not null,
  platform platform_enum default 'instagram',
  username text not null,
  reel_id text not null,
  status reel_status_enum default 'pending',
  media_object_key text,
  media_size_bytes bigint,
  media_content_type text,
  media_sha256 text,
  reel_caption text,
  downloaded_at timestamptz,
  graph_post_id text,
  download_retries int not null default 0,
  download_claimed_at timestamptz,
  download_failed_at timestamptz,

  constraint unique_reel_per_page unique (page_id, reel_id)
);

create index if not exists idx_reels_page_download_failed_at
  on public.reels (page_id, download_failed_at desc)
  where status = 'download_failed';

create index if not exists idx_reels_page_status_buffer
  on public.reels (page_id, status, id)
  where status in ('pending', 'downloaded', 'processing');
-- Token Transactions Table
create table public.token_transactions (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    amount int not null, -- negative for usage (-1 per post), positive for purchase
    type public.token_transaction_type not null,
    reel_id bigint references public.reels(id) on delete set null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);
-- Subscription Logs
create table public.subscription_logs (
  id uuid default uuid_generate_v4() primary key,
  agency_id uuid references public.users(id) on delete set null,
  amount_paid decimal(10,2) not null default 0,
  
  -- Snapshots
  previous_tokens_snapshot int,
  tokens_allocated_snapshot int,
  agency_name_snapshot text,
  
  type subscription_type_enum not null,
  notes text,
  created_at timestamptz default now()
);

-- Auth Attempts (Rate Limiting)
create table public.auth_attempts (
  id uuid default uuid_generate_v4() primary key,
  email text not null,
  ip_address text,
  type auth_attempt_type not null,
  success boolean not null default false,
  created_at timestamptz default now()
);

-- Errors Table
create table public.errors (
  id uuid default gen_random_uuid() primary key,
  agency_id uuid references public.users(id) on delete cascade,
  page_id uuid references public.pages(id) on delete cascade,
  reel_id bigint references public.reels(id) on delete set null,
  error_message text not null,
  stack_trace text,
  error_phase text,
  retry_count int default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- System Settings
create table public.system_settings (
    id int primary key default 1,
    token_price_pkr decimal(10,2) not null default 5.00,
    updated_at timestamptz default now(),
    constraint singleton_check check (id = 1)
);

-- 3. Security (Functions & RLS)

-- Secure Role Check Function
create or replace function public.get_my_role()
returns public.user_role_enum as $$
  select role from public.users where id = auth.uid();
$$ language sql security definer;

-- Super-admin: aggregate token usage since a timestamp (PKT day boundary passed from app)
create or replace function public.get_tokens_used_since(p_since timestamptz)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_total bigint;
begin
    if public.get_my_role() is distinct from 'super_admin' then
        raise exception 'forbidden';
    end if;

    select coalesce(sum(abs(amount)), 0)::bigint
      into v_total
      from public.token_transactions
     where type = 'usage'
       and created_at >= p_since;

    return v_total;
end;
$$;

revoke all on function public.get_tokens_used_since(timestamptz) from public;
grant execute on function public.get_tokens_used_since(timestamptz) to authenticated;

-- Updated at trigger function
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
   new.updated_at = now();
   return new;
end;
$$ language 'plpgsql';

-- Auth Role Sync Function (Crucial for Login)
-- Syncs the 'role' from public.users to auth.users.raw_app_meta_data
create or replace function public.handle_user_role_update()
returns trigger as $$
begin
  update auth.users
  set raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

-- Auto-create public.users on auth.signup
-- Strictly enforces 'agency' role for all public registrations
-- Helper to sanitize subdomain
CREATE OR REPLACE FUNCTION public.sanitize_subdomain(email TEXT)
RETURNS TEXT AS $$
DECLARE
    sub TEXT;
BEGIN
    -- Extract part before @
    sub := split_part(email, '@', 1);
    -- Lowercase
    sub := lower(sub);
    -- Remove non-alphanumeric (replace with nothing or hyphen)
    sub := regexp_replace(sub, '[^a-z0-9]', '', 'g');
    -- Ensure it's not empty and has a reasonable length
    IF length(sub) < 3 THEN
        sub := sub || 'hub'; -- Fallback suffix
    END IF;
    RETURN left(sub, 20);
END;
$$ LANGUAGE plpgsql;

-- Auto-create public.users on auth.signup
-- Strictly enforces 'agency' role for all public registrations
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, phone_number, role, subdomain)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    coalesce(new.raw_user_meta_data->>'phone_number', ''),
    'agency',
    public.sanitize_subdomain(new.email)
  );
  return new;
end;
$$ language plpgsql security definer;

-- Atomic Posting & Deduction RPC
create or replace function public.resolve_token_cost(
  p_feature text,
  p_platform text default 'facebook',
  p_media_type text default '*',
  p_source_platform text default null
)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_cost int;
begin
  select r.token_cost
  into v_cost
  from public.token_cost_rules r
  where r.feature = p_feature
    and r.platform = p_platform
    and r.media_type = p_media_type
    and coalesce(r.source_platform, '') = coalesce(p_source_platform, '')
  limit 1;

  if v_cost is null and p_media_type is distinct from '*' then
    select r.token_cost
    into v_cost
    from public.token_cost_rules r
    where r.feature = p_feature
      and r.platform = p_platform
      and r.media_type = '*'
      and coalesce(r.source_platform, '') = coalesce(p_source_platform, '')
    limit 1;
  end if;

  if v_cost is null then
    raise exception 'token_cost_rule_not_found feature=% platform=% media_type=% source_platform=%',
      p_feature, p_platform, p_media_type, p_source_platform;
  end if;

  return v_cost;
end;
$$;

grant execute on function public.resolve_token_cost(text, text, text, text) to authenticated;

create or replace function public.mark_reel_posted_with_token(p_reel_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid;
    v_current_tokens bigint;
    v_source_platform public.platform_enum;
    v_deduction int;
begin
    select p.agency_id, r.platform into v_user_id, v_source_platform
    from public.pages p
    join public.reels r on r.page_id = p.id
    where r.id = p_reel_id;

    if not found then
        raise exception 'Reel or linked Agency not found';
    end if;

    v_deduction := public.resolve_token_cost(
        'auto_download_upload',
        'facebook',
        '*',
        v_source_platform::text
    );

    select tokens_balance into v_current_tokens
    from public.users where id = v_user_id;

    update public.reels
    set status = 'posted'
    where id = p_reel_id
      and status != 'posted';

    if not found then
        return false;
    end if;

    if coalesce(v_current_tokens, 0) >= v_deduction then
        update public.users
        set tokens_balance = tokens_balance - v_deduction
        where id = v_user_id;

        insert into public.token_transactions (user_id, amount, type, reel_id, metadata)
        values (
            v_user_id,
            -v_deduction,
            'usage',
            p_reel_id,
            jsonb_build_object(
                'feature', 'auto_download_upload',
                'platform', v_source_platform,
                'reel_id_internal', p_reel_id
            )
        );
    end if;

    return true;
exception
    when others then
        raise;
end;
$$;

-- Token Balance Protection Trigger Function
create or replace function public.protect_user_tokens_balance()
returns trigger as $$
begin
    -- Fix: Use auth.role() to check for service_role, not current_user (which is DB user)
    if NEW.tokens_balance is distinct from OLD.tokens_balance 
       and (select auth.role()) != 'service_role' 
       and public.get_my_role() != 'super_admin' then
        NEW.tokens_balance := OLD.tokens_balance;
    end if;
    return new;
end;
$$ language plpgsql security definer;

create or replace function public.update_page_reel_counts()
returns trigger as $$
begin
  -- Allow controlled bulk operations to bypass row-by-row counter writes.
  if current_setting('app.skip_page_reel_count_updates', true) = '1' then
    return null;
  end if;

  if (tg_op = 'INSERT') then
    if new.status = 'pending' then
      update public.pages set pending_reels_count = pending_reels_count + 1 where id = new.page_id;
    elsif new.status = 'posted' then
      update public.pages set posted_reels_count = posted_reels_count + 1 where id = new.page_id;
    elsif new.status = 'failed' then
      update public.pages set failed_reels_count = failed_reels_count + 1 where id = new.page_id;
    end if;
  elsif (tg_op = 'UPDATE') then
    if old.page_id <> new.page_id or old.status <> new.status then
      if old.status = 'pending' then
        update public.pages set pending_reels_count = pending_reels_count - 1 where id = old.page_id;
      elsif old.status = 'posted' then
        update public.pages set posted_reels_count = posted_reels_count - 1 where id = old.page_id;
      elsif old.status = 'failed' then
        update public.pages set failed_reels_count = failed_reels_count - 1 where id = old.page_id;
      end if;

      if new.status = 'pending' then
        update public.pages set pending_reels_count = pending_reels_count + 1 where id = new.page_id;
      elsif new.status = 'posted' then
        update public.pages set posted_reels_count = posted_reels_count + 1 where id = new.page_id;
      elsif new.status = 'failed' then
        update public.pages set failed_reels_count = failed_reels_count + 1 where id = new.page_id;
      end if;
    end if;
  elsif (tg_op = 'DELETE') then
    -- When a page delete cascades into reels deletes, skip expensive counter updates.
    if not exists (select 1 from public.pages where id = old.page_id) then
      return null;
    end if;

    if old.status = 'pending' then
      update public.pages set pending_reels_count = pending_reels_count - 1 where id = old.page_id;
    elsif old.status = 'posted' then
      update public.pages set posted_reels_count = posted_reels_count - 1 where id = old.page_id;
    elsif old.status = 'failed' then
      update public.pages set failed_reels_count = failed_reels_count - 1 where id = old.page_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql;

-- Enable RLS
alter table public.users enable row level security;
alter table public.facebook_accounts enable row level security;
alter table public.pages enable row level security;
alter table public.reels enable row level security;
alter table public.subscription_logs enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.token_transactions enable row level security;
alter table public.errors enable row level security;
alter table public.system_settings enable row level security;

-- USERS Policies
create policy "Read own record" on public.users for select using (id = auth.uid());
create policy "Update own record" on public.users for update using (id = auth.uid()) 
  with check (
    (case when (public.get_my_role() = 'super_admin') then true else (role = (select role from public.users where id = auth.uid()) and tokens_balance = (select tokens_balance from public.users where id = auth.uid())) end)
  );
create policy "Super Admin manage all" on public.users for all using (public.get_my_role() = 'super_admin');

-- TOKEN_TRANSACTIONS Policies
create policy "Users see own transactions" on public.token_transactions for select using (user_id = auth.uid());
create policy "Super Admin manage transactions" on public.token_transactions for all using (public.get_my_role() = 'super_admin');

-- FACEBOOK_ACCOUNTS Policies
create policy "Agencies manage own fb accounts" on public.facebook_accounts for all using (agency_id = auth.uid());
create policy "Super Admin see all fb accounts" on public.facebook_accounts for select using (public.get_my_role() = 'super_admin');

-- PAGES Policies
create policy "Super Admin see all pages" on public.pages for select using (public.get_my_role() = 'super_admin');
create policy "Agencies manage own pages" on public.pages for all using (agency_id = auth.uid());

-- REELS Policies
create policy "Super Admin see all reels" on public.reels for select using (public.get_my_role() = 'super_admin');
create policy "Agencies manage own reels" on public.reels for all using (page_id in (select id from public.pages where agency_id = auth.uid()));

-- SUBSCRIPTION_LOGS Policies
create policy "Super Admin see all logs" on public.subscription_logs for select using (public.get_my_role() = 'super_admin');

-- AUTH_ATTEMPTS Policies
create policy "Service role full access" on public.auth_attempts for all to service_role using (true) with check (true);

-- ERRORS Policies
create policy "Service role full access" on public.errors for all to service_role using (true) with check (true);

-- PIPELINE_EVENTS Policies

-- SYSTEM_SETTINGS Policies
create policy "Viewable by everyone" on public.system_settings for select using (true);
create policy "Manageable by Super Admin" on public.system_settings for all using (public.get_my_role() = 'super_admin');

-- 4. Indices, Triggers & Maintenance

-- Triggers
create trigger update_users_updated_at before update on public.users for each row execute procedure public.update_updated_at_column();
create trigger update_facebook_accounts_updated_at before update on public.facebook_accounts for each row execute procedure public.update_updated_at_column();
create trigger update_pages_updated_at before update on public.pages for each row execute procedure public.update_updated_at_column();
create trigger on_user_role_update after insert or update of role on public.users for each row execute procedure public.handle_user_role_update();
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create trigger tr_protect_user_tokens_balance before update on public.users for each row execute procedure public.protect_user_tokens_balance();
create trigger tr_update_page_reel_counts after insert or update or delete on public.reels for each row execute procedure public.update_page_reel_counts();

create or replace function public.cascade_page_invalid_token_to_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'invalid_token'
     and old.status is distinct from 'invalid_token'
     and new.facebook_account_id is not null then
    update public.facebook_accounts
    set status = 'invalid_token', updated_at = now()
    where id = new.facebook_account_id;

    update public.pages
    set status = 'invalid_token', updated_at = now()
    where facebook_account_id = new.facebook_account_id
      and id <> new.id
      and status not in ('fb_verification_required', 'completed', 'invalid_token');
  end if;

  return new;
end;
$$;

create trigger tr_cascade_page_invalid_token
  after update of status on public.pages
  for each row
  execute procedure public.cascade_page_invalid_token_to_account();

-- Indices
create index idx_auth_attempts_email_type_created on public.auth_attempts(email, type, created_at);
create index idx_reels_page_id_status on public.reels(page_id, status);
create index idx_pages_agency_id_status on public.pages(agency_id, status);
create index idx_facebook_accounts_agency_id on public.facebook_accounts(agency_id);
create index idx_facebook_accounts_agency_status on public.facebook_accounts(agency_id, status);
create index idx_subscription_logs_agency_id on public.subscription_logs(agency_id);
create index idx_pages_facebook_account_id on public.pages(facebook_account_id);
create index if not exists idx_pages_active_followers_cycle on public.pages(status, is_followers_updated, updated_at);
create index if not exists idx_pages_status_sync_agency on public.pages(status, sync_status, agency_id);
create index if not exists idx_users_subscription_status on public.users(is_active_override);
create index if not exists idx_reels_pending_fetch on public.reels(page_id, username, status, id);
create index idx_token_transactions_user_id on public.token_transactions(user_id);
create index if not exists idx_token_transactions_usage_created_at
  on public.token_transactions (created_at desc)
  where type = 'usage';

-- Cleanup Functions
create or replace function public.cleanup_old_auth_attempts()
returns void as $$
begin
  delete from public.auth_attempts where created_at < now() - interval '24 hours';
end;
$$ language plpgsql security definer;

create or replace function public.reset_stuck_pages()
returns void as $$
begin
  update public.pages
  set sync_status = 'browser_pending'
  where sync_status = 'processing'
    and updated_at < now() - interval '1 hour';
end;
$$ language plpgsql security definer;

-- Worker Functions
create or replace function public.get_next_pending_page(p_platform public.source_platform_enum default null)
returns table (id uuid, source_username text, source_platform public.source_platform_enum) as $$
begin
  return query
  update public.pages
  set sync_status = 'processing'
  where public.pages.id = (
    select p.id
    from public.pages p
    where p.sync_status = 'pending'
    and (p_platform is null or p.source_platform = p_platform)
    limit 1
    for update skip locked
  )
  returning public.pages.id, public.pages.source_username, public.pages.source_platform;
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

-- Auto-Trigger for Cron (1-minute dynamic check)
create or replace function public.get_pages_due_posting()
returns table (
  id uuid,
  agency_id uuid,
  fb_page_id text,
  fb_page_access_token text,
  source_username text,
  source_platform public.source_platform_enum
) as $$
begin
  return query
  select
    p.id,
    p.agency_id,
    p.fb_page_id,
    p.fb_page_access_token,
    p.source_username,
    p.source_platform
  from
    public.pages p
    join public.users u on p.agency_id = u.id
  where
    p.status = 'active'
    and p.sync_status = 'synced'
    and u.is_active_override = true
    and u.tokens_balance >= 60 -- Ensure enough for at least one max-cost post (YouTube)
    and exists (
      select 1
      from jsonb_array_elements_text(p.posting_times) as t(schedule_time)
      where
        (date_trunc('day', now()) + schedule_time::time)
          between now() and now() + interval '1 minute'
        or (date_trunc('day', now()) + interval '1 day' + schedule_time::time)
          between now() and now() + interval '1 minute'
    );
end;
$$ language plpgsql security definer;

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
          'account_suspended',
          'creator_suspended'
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

-- Cron Jobs
select cron.schedule('cleanup-auth-attempts', '0 1 * * *', 'select public.cleanup_old_auth_attempts()');
select cron.schedule('reset-stuck-pages', '*/15 * * * *', 'select public.reset_stuck_pages()');

-- 6. System Settings Seed
insert into public.system_settings (id, token_price_pkr) values (1, 5.00)
on conflict (id) do nothing;

-- 6. One-time Sync for existing users (Fixes login issues)
UPDATE public.users SET role = role;

-- 7. Posting Pipeline V2 (2026-05-07)

alter type public.reel_status_enum add value if not exists 'processing';

alter table public.system_settings
  add column if not exists posting_v2_intake_paused boolean not null default false;

create table if not exists public.posting_jobs_v2 (
  job_id uuid primary key default gen_random_uuid(),
  trace_id uuid not null default gen_random_uuid(),
  mode text not null default 'prod' check (mode in ('prod', 'test')),
  agency_id uuid references public.users(id) on delete set null,
  page_id uuid not null references public.pages(id) on delete cascade,
  reel_internal_id bigint not null references public.reels(id) on delete cascade,
  platform public.source_platform_enum not null,
  source_username text not null,
  reel_id text not null,
  fb_page_id text not null,
  fb_page_access_token text not null,
  status text not null default 'download_pending'
    check (status in (
      'download_pending',
      'download_processing',
      'pending_publish',
      'publishing',
      'published',
      'failed_to_download',
      'failed_to_publish',
      'integrity_error'
    )),
  download_retries int not null default 0,
  publish_retries int not null default 0,
  media_object_key text,
  media_url text,
  media_sha256 text,
  media_content_type text,
  media_size_bytes bigint,
  media_duration_ms int,
  reel_caption text,
  source_fingerprint text,
  contract_version text,
  last_error_code text,
  last_error_message text,
  download_started_at timestamptz,
  publish_started_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reels_page_status_id
  on public.reels (page_id, status, id);

create index if not exists idx_posting_jobs_v2_status_updated
  on public.posting_jobs_v2 (status, updated_at);

create index if not exists idx_posting_jobs_v2_status_download_retries
  on public.posting_jobs_v2 (status, download_retries);

create index if not exists idx_posting_jobs_v2_status_publish_retries
  on public.posting_jobs_v2 (status, publish_retries);

create index if not exists idx_posting_jobs_v2_trace_id
  on public.posting_jobs_v2 (trace_id);

create unique index if not exists ux_posting_jobs_v2_active_page_reel
  on public.posting_jobs_v2 (page_id, reel_internal_id)
  where status not in ('published', 'failed_to_download', 'failed_to_publish', 'integrity_error');

create unique index if not exists ux_posting_jobs_v2_published_reel
  on public.posting_jobs_v2 (reel_internal_id)
  where status = 'published';

create trigger tr_posting_jobs_v2_updated_at
before update on public.posting_jobs_v2
for each row execute procedure public.update_updated_at_column();

alter table public.posting_jobs_v2 enable row level security;

create policy "Service role full access posting_jobs_v2"
  on public.posting_jobs_v2
  for all
  to service_role
  using (true)
  with check (true);

create policy "Super Admin read posting_jobs_v2"
  on public.posting_jobs_v2
  for select
  using (public.get_my_role() = 'super_admin');

create or replace function public.claim_due_reels_and_create_jobs_v2(p_mode text default 'prod')
returns table (
  job_id uuid,
  trace_id uuid,
  agency_id uuid,
  page_id uuid,
  reel_internal_id bigint,
  platform public.source_platform_enum,
  source_username text,
  reel_id text,
  fb_page_id text,
  fb_page_access_token text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.system_settings where id = 1 and posting_v2_intake_paused = true) then
    return;
  end if;

  return query
  with due_pages as (
    select *
    from public.get_pages_due_posting()
  ),
  candidate_reels as (
    select
      dp.agency_id,
      dp.id as page_id,
      dp.source_platform as platform,
      dp.source_username,
      dp.fb_page_id,
      dp.fb_page_access_token,
      r.id as reel_internal_id,
      r.reel_id
    from due_pages dp
    join lateral (
      select rr.id, rr.reel_id
      from public.reels rr
      where rr.page_id = dp.id
        and rr.status = 'pending'
      order by rr.id asc
      limit 1
      for update skip locked
    ) r on true
  ),
  completed_pages as (
    update public.pages p
    set status = 'completed'
    where p.id in (select dp.id from due_pages dp)
      and p.id not in (select cr.page_id from candidate_reels cr)
      and p.status = 'active'
    returning p.id
  ),
  inserted_jobs as (
    insert into public.posting_jobs_v2 (
      job_id,
      trace_id,
      mode,
      agency_id,
      page_id,
      reel_internal_id,
      platform,
      source_username,
      reel_id,
      fb_page_id,
      fb_page_access_token,
      status
    )
    select
      gen_random_uuid(),
      gen_random_uuid(),
      p_mode,
      cr.agency_id,
      cr.page_id,
      cr.reel_internal_id,
      cr.platform,
      cr.source_username,
      cr.reel_id,
      cr.fb_page_id,
      cr.fb_page_access_token,
      'download_pending'
    from candidate_reels cr
    on conflict do nothing
    returning
      posting_jobs_v2.job_id,
      posting_jobs_v2.trace_id,
      posting_jobs_v2.agency_id,
      posting_jobs_v2.page_id,
      posting_jobs_v2.reel_internal_id,
      posting_jobs_v2.platform,
      posting_jobs_v2.source_username,
      posting_jobs_v2.reel_id,
      posting_jobs_v2.fb_page_id,
      posting_jobs_v2.fb_page_access_token
  ),
  mark_reels as (
    update public.reels r
    set status = 'processing'
    where r.id in (select ij.reel_internal_id from inserted_jobs ij)
      and r.status = 'pending'
    returning r.id
  )
  select
    ij.job_id,
    ij.trace_id,
    ij.agency_id,
    ij.page_id,
    ij.reel_internal_id,
    ij.platform,
    ij.source_username,
    ij.reel_id,
    ij.fb_page_id,
    ij.fb_page_access_token
  from inserted_jobs ij;
end;
$$;

create or replace function public.claim_download_jobs_v2(p_limit int default 100)
returns setof public.posting_jobs_v2
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with locked as (
    select j.job_id
    from public.posting_jobs_v2 j
    where j.status = 'download_pending'
      and j.download_retries <= 10
    order by j.updated_at asc
    limit greatest(1, p_limit)
    for update skip locked
  )
  update public.posting_jobs_v2 j
  set
    status = 'download_processing',
    download_started_at = now(),
    updated_at = now()
  where j.job_id in (select l.job_id from locked l)
  returning j.*;
end;
$$;

create or replace function public.claim_publish_jobs_v2(p_limit int default 100)
returns setof public.posting_jobs_v2
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with locked as (
    select j.job_id
    from public.posting_jobs_v2 j
    where j.status = 'pending_publish'
      and j.publish_retries <= 5
    order by j.updated_at asc
    limit greatest(1, p_limit)
    for update skip locked
  )
  update public.posting_jobs_v2 j
  set
    status = 'publishing',
    publish_started_at = now(),
    updated_at = now()
  where j.job_id in (select l.job_id from locked l)
  returning j.*;
end;
$$;

create or replace function public.reset_stale_download_jobs_v2(p_older_than_seconds int default 180, p_limit int default 1000)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  with stale as (
    select j.job_id
    from public.posting_jobs_v2 j
    where j.status = 'download_processing'
      and coalesce(j.download_started_at, j.updated_at) < now() - make_interval(secs => greatest(1, p_older_than_seconds))
    order by j.updated_at asc
    limit greatest(1, p_limit)
  )
  update public.posting_jobs_v2 j
  set
    status = 'download_pending',
    download_started_at = null,
    updated_at = now()
  where j.job_id in (select s.job_id from stale s);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.reset_stale_publish_jobs_v2(p_older_than_seconds int default 180, p_limit int default 1000)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  with stale as (
    select j.job_id
    from public.posting_jobs_v2 j
    where j.status = 'publishing'
      and coalesce(j.publish_started_at, j.updated_at) < now() - make_interval(secs => greatest(1, p_older_than_seconds))
    order by j.updated_at asc
    limit greatest(1, p_limit)
  )
  update public.posting_jobs_v2 j
  set
    status = 'pending_publish',
    publish_started_at = null,
    updated_at = now()
  where j.job_id in (select s.job_id from stale s);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.finalize_posting_job_v2(p_job_id uuid)
returns table (
  job_id uuid,
  already_finalized boolean,
  finalized boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.posting_jobs_v2%rowtype;
  v_marked boolean := false;
begin
  select *
  into v_job
  from public.posting_jobs_v2
  where posting_jobs_v2.job_id = p_job_id
  for update;

  if not found then
    raise exception 'posting_job_not_found';
  end if;

  if v_job.status = 'published' then
    return query select p_job_id, true, false;
    return;
  end if;

  select public.mark_reel_posted_with_token(v_job.reel_internal_id)
    into v_marked;

  if v_marked then
    update public.posting_jobs_v2
    set
      status = 'published',
      published_at = now(),
      publish_started_at = null,
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
    where posting_jobs_v2.job_id = p_job_id;

    return query select p_job_id, false, true;
    return;
  end if;

  update public.posting_jobs_v2
  set
    status = 'published',
    published_at = now(),
    publish_started_at = null,
    updated_at = now()
  where posting_jobs_v2.job_id = p_job_id;

  return query select p_job_id, true, false;
end;
$$;
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
  ('auto_download_upload', 'facebook', '*', 'facebook', 2),
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
  bulk_batch_id uuid,
  created_at timestamptz default now()
);

create index if not exists idx_fb_direct_schedule_posts_bulk_batch_id
  on public.facebook_direct_schedule_posts (bulk_batch_id)
  where bulk_batch_id is not null;

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
  bulk_batch_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_facebook_inapp_schedule_posts_status_scheduled
  on public.facebook_inapp_schedule_posts (status, scheduled_at);

create index if not exists idx_fb_inapp_schedule_posts_bulk_batch_id
  on public.facebook_inapp_schedule_posts (bulk_batch_id)
  where bulk_batch_id is not null;

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

-- ADU buffer pipeline (20260523120000)
create table if not exists public.adu_posting_jobs (
  job_id uuid primary key default gen_random_uuid(),
  trace_id uuid not null default gen_random_uuid(),
  mode text not null default 'prod' check (mode in ('prod', 'test')),
  agency_id uuid references public.users(id) on delete set null,
  page_id uuid not null references public.pages(id) on delete cascade,
  reel_internal_id bigint not null references public.reels(id) on delete cascade,
  platform public.source_platform_enum not null,
  source_username text not null,
  reel_id text not null,
  fb_page_id text not null,
  fb_page_access_token text not null,
  status text not null default 'pending_publish'
    check (status in (
      'pending_publish',
      'publishing',
      'published',
      'failed_to_publish',
      'integrity_error'
    )),
  publish_retries int not null default 0,
  media_object_key text not null,
  media_url text,
  media_sha256 text,
  media_content_type text,
  media_size_bytes bigint,
  reel_caption text,
  graph_post_id text,
  last_error_code text,
  last_error_message text,
  publish_started_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_adu_posting_jobs_status_updated
  on public.adu_posting_jobs (status, updated_at);

create index if not exists idx_adu_posting_jobs_status_publish_retries
  on public.adu_posting_jobs (status, publish_retries);

create unique index if not exists ux_adu_posting_jobs_active_page_reel
  on public.adu_posting_jobs (page_id, reel_internal_id)
  where status not in ('published', 'failed_to_publish');

create unique index if not exists ux_adu_posting_jobs_published_reel
  on public.adu_posting_jobs (reel_internal_id)
  where status = 'published';

drop trigger if exists tr_adu_posting_jobs_updated_at on public.adu_posting_jobs;
create trigger tr_adu_posting_jobs_updated_at
before update on public.adu_posting_jobs
for each row execute procedure public.update_updated_at_column();

alter table public.adu_posting_jobs enable row level security;

drop policy if exists "Service role full access adu_posting_jobs" on public.adu_posting_jobs;
create policy "Service role full access adu_posting_jobs"
  on public.adu_posting_jobs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Super Admin read adu_posting_jobs" on public.adu_posting_jobs;
create policy "Super Admin read adu_posting_jobs"
  on public.adu_posting_jobs
  for select
  using (public.get_my_role() = 'super_admin');

drop policy if exists "Agency read own adu_posting_jobs" on public.adu_posting_jobs;
create policy "Agency read own adu_posting_jobs"
  on public.adu_posting_jobs
  for select
  using (agency_id = auth.uid());

-- Agency can read reels for their pages (for Reels tab)
drop policy if exists "Agency read own page reels" on public.reels;
create policy "Agency read own page reels"
  on public.reels
  for select
  using (
    exists (
      select 1 from public.pages p
      where p.id = reels.page_id and p.agency_id = auth.uid()
    )
  );

drop policy if exists "Agency update downloaded reel caption" on public.reels;
create policy "Agency update downloaded reel caption"
  on public.reels
  for update
  using (
    status = 'downloaded'
    and exists (
      select 1 from public.pages p
      where p.id = reels.page_id and p.agency_id = auth.uid()
    )
  )
  with check (
    status = 'downloaded'
    and exists (
      select 1 from public.pages p
      where p.id = reels.page_id and p.agency_id = auth.uid()
    )
  );

drop policy if exists "Agency delete downloaded reels" on public.reels;
create policy "Agency delete downloaded reels"
  on public.reels
  for delete
  using (
    status = 'downloaded'
    and exists (
      select 1 from public.pages p
      where p.id = reels.page_id and p.agency_id = auth.uid()
    )
  );

create or replace function public.delete_page_with_reels(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '120s'
as $$
begin
  if not exists (
    select 1
    from public.pages p
    where p.id = p_page_id
      and (p.agency_id = auth.uid() or public.get_my_role() = 'super_admin')
  ) then
    raise exception 'forbidden';
  end if;

  -- Delete reels in batches to avoid statement timeout
  loop
    delete from public.reels
    where id in (
      select id from public.reels
      where page_id = p_page_id
      limit 5000
    );
    exit when not found;
  end loop;

  delete from public.pages where id = p_page_id;
end;
$$;

grant execute on function public.delete_page_with_reels(uuid) to authenticated;

create or replace function public.create_due_adu_posting_jobs(p_mode text default 'prod')
returns table (
  job_id uuid,
  trace_id uuid,
  agency_id uuid,
  page_id uuid,
  reel_internal_id bigint,
  platform public.source_platform_enum,
  source_username text,
  reel_id text,
  fb_page_id text,
  fb_page_access_token text,
  media_object_key text,
  media_size_bytes bigint,
  media_content_type text,
  media_sha256 text,
  reel_caption text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.system_settings where id = 1 and posting_v2_intake_paused = true) then
    return;
  end if;

  return query
  with due_pages as (
    select *
    from public.get_pages_due_posting()
  ),
  candidate_reels as (
    select
      dp.agency_id,
      dp.id as page_id,
      dp.source_platform as platform,
      dp.source_username,
      dp.fb_page_id,
      dp.fb_page_access_token,
      r.id as reel_internal_id,
      r.reel_id,
      r.media_object_key,
      r.media_size_bytes,
      r.media_content_type,
      r.media_sha256,
      coalesce(nullif(trim(r.reel_caption), ''), '...') as reel_caption
    from due_pages dp
    join lateral (
      select rr.*
      from public.reels rr
      where rr.page_id = dp.id
        and rr.status = 'downloaded'
        and rr.media_object_key is not null
      order by rr.id asc
      limit 1
      for update skip locked
    ) r on true
  ),
  completed_pages as (
    update public.pages p
    set status = 'completed'
    where p.id in (select dp.id from due_pages dp)
      and p.id not in (select cr.page_id from candidate_reels cr)
      and p.status = 'active'
      and not exists (
        select 1
        from public.reels r
        where r.page_id = p.id
          and r.status in ('pending', 'processing', 'failed')
      )
      and not exists (
        select 1
        from public.adu_posting_jobs aj
        where aj.page_id = p.id
          and aj.status in ('pending_publish', 'publishing')
      )
    returning p.id
  ),
  inserted_jobs as (
    insert into public.adu_posting_jobs (
      job_id,
      trace_id,
      mode,
      agency_id,
      page_id,
      reel_internal_id,
      platform,
      source_username,
      reel_id,
      fb_page_id,
      fb_page_access_token,
      status,
      media_object_key,
      media_size_bytes,
      media_content_type,
      media_sha256,
      reel_caption
    )
    select
      gen_random_uuid(),
      gen_random_uuid(),
      p_mode,
      cr.agency_id,
      cr.page_id,
      cr.reel_internal_id,
      cr.platform,
      cr.source_username,
      cr.reel_id,
      cr.fb_page_id,
      cr.fb_page_access_token,
      'pending_publish',
      cr.media_object_key,
      cr.media_size_bytes,
      cr.media_content_type,
      cr.media_sha256,
      cr.reel_caption
    from candidate_reels cr
    on conflict do nothing
    returning *
  ),
  skipped_inserts as (
    insert into public.errors (error_message, error_phase, metadata)
    select
      'adu_posting_job_insert_skipped',
      'posting_v2_schedule',
      jsonb_build_object(
        'page_id', cr.page_id,
        'reel_internal_id', cr.reel_internal_id,
        'reel_id', cr.reel_id
      )
    from candidate_reels cr
    where not exists (
      select 1
      from inserted_jobs ij
      where ij.reel_internal_id = cr.reel_internal_id
    )
    returning id
  ),
  mark_reels as (
    update public.reels r
    set status = 'processing'
    where r.id in (select ij.reel_internal_id from inserted_jobs ij)
      and r.status = 'downloaded'
    returning r.id
  )
  select
    ij.job_id,
    ij.trace_id,
    ij.agency_id,
    ij.page_id,
    ij.reel_internal_id,
    ij.platform,
    ij.source_username,
    ij.reel_id,
    ij.fb_page_id,
    ij.fb_page_access_token,
    ij.media_object_key,
    ij.media_size_bytes,
    ij.media_content_type,
    ij.media_sha256,
    ij.reel_caption
  from inserted_jobs ij;
end;
$$;

create or replace function public.claim_publish_jobs_adu(p_limit int default 100)
returns setof public.adu_posting_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  with exhausted as (
    update public.adu_posting_jobs j
    set
      status = 'failed_to_publish',
      publish_started_at = null,
      last_error_code = coalesce(j.last_error_code, 'publish_retries_exhausted'),
      last_error_message = coalesce(
        nullif(trim(j.last_error_message), ''),
        'Maximum publish retries exceeded'
      ),
      updated_at = now()
    where j.status = 'pending_publish'
      and j.publish_retries > 5
    returning j.reel_internal_id
  )
  update public.reels r
  set status = 'downloaded'
  from exhausted e
  where r.id = e.reel_internal_id
    and r.status = 'processing';

  return query
  with locked as (
    select
      j.job_id,
      p.fb_page_access_token,
      p.fb_page_id
    from public.adu_posting_jobs j
    join public.pages p on p.id = j.page_id
    join public.users u on u.id = j.agency_id
    cross join public.system_settings s
    where j.status = 'pending_publish'
      and j.publish_retries <= 5
      and s.id = 1
      and s.posting_v2_intake_paused = false
      and p.status = 'active'
      and p.sync_status = 'synced'
      and u.is_active_override = true
    order by j.updated_at asc
    limit greatest(1, p_limit)
    for update of j skip locked
  )
  update public.adu_posting_jobs j
  set
    status = 'publishing',
    publish_started_at = now(),
    fb_page_access_token = l.fb_page_access_token,
    fb_page_id = l.fb_page_id,
    updated_at = now()
  from locked l
  where j.job_id = l.job_id
  returning j.*;
end;
$$;

create or replace function public.reset_stale_publish_jobs_adu(p_older_than_seconds int default 300, p_limit int default 1000)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  with stale as (
    select j.job_id, j.reel_internal_id, j.graph_post_id
    from public.adu_posting_jobs j
    where j.status = 'publishing'
      and coalesce(j.publish_started_at, j.updated_at) < now() - make_interval(secs => greatest(1, p_older_than_seconds))
    order by j.updated_at asc
    limit greatest(1, p_limit)
  ),
  reset_jobs as (
    update public.adu_posting_jobs j
    set
      status = 'pending_publish',
      publish_started_at = null,
      updated_at = now()
    from stale s
    where j.job_id = s.job_id
    returning j.job_id, j.reel_internal_id, j.graph_post_id
  ),
  released_reels as (
    update public.reels r
    set status = 'downloaded'
    from reset_jobs rj
    where r.id = rj.reel_internal_id
      and r.status = 'processing'
      and rj.graph_post_id is null
    returning r.id
  )
  select count(*)::int into v_count from reset_jobs;

  return v_count;
end;
$$;

create or replace function public.finalize_posting_job_adu(p_job_id uuid, p_graph_post_id text default null)
returns table (
  job_id uuid,
  already_finalized boolean,
  finalized boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.adu_posting_jobs%rowtype;
  v_marked boolean := false;
  v_graph_id text;
begin
  select *
  into v_job
  from public.adu_posting_jobs
  where adu_posting_jobs.job_id = p_job_id
  for update;

  if not found then
    raise exception 'posting_job_not_found';
  end if;

  if v_job.status = 'published' then
    return query select p_job_id, true, false;
    return;
  end if;

  if v_job.status = 'pending_publish' and v_job.graph_post_id is null then
    raise exception 'job_not_ready_to_finalize';
  end if;

  if v_job.status not in ('publishing', 'pending_publish') then
    raise exception 'job_not_ready_to_finalize';
  end if;

  v_graph_id := coalesce(nullif(trim(p_graph_post_id), ''), v_job.graph_post_id);

  select public.mark_reel_posted_with_token(v_job.reel_internal_id)
    into v_marked;

  if v_marked then
    update public.reels
    set
      graph_post_id = coalesce(v_graph_id, graph_post_id),
      media_object_key = null,
      media_size_bytes = null,
      media_content_type = null,
      media_sha256 = null
    where id = v_job.reel_internal_id;

    update public.adu_posting_jobs
    set
      status = 'published',
      published_at = now(),
      publish_started_at = null,
      graph_post_id = coalesce(v_graph_id, graph_post_id),
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
    where adu_posting_jobs.job_id = p_job_id;

    return query select p_job_id, false, true;
    return;
  end if;

  update public.adu_posting_jobs
  set
    status = 'published',
    published_at = now(),
    publish_started_at = null,
    graph_post_id = coalesce(v_graph_id, graph_post_id),
    updated_at = now()
  where adu_posting_jobs.job_id = p_job_id;

  return query select p_job_id, true, false;
end;
$$;

create or replace function public.record_adu_publish_graph_id(
  p_job_id uuid,
  p_graph_post_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.adu_posting_jobs%rowtype;
begin
  if nullif(trim(p_graph_post_id), '') is null then
    raise exception 'graph_post_id_required';
  end if;

  select *
  into v_job
  from public.adu_posting_jobs
  where job_id = p_job_id
  for update;

  if not found then
    raise exception 'posting_job_not_found';
  end if;

  if v_job.status = 'published' then
    return true;
  end if;

  if v_job.status <> 'publishing' then
    raise exception 'job_not_publishing';
  end if;

  if v_job.graph_post_id is not null and v_job.graph_post_id <> p_graph_post_id then
    raise exception 'graph_post_id_mismatch';
  end if;

  update public.adu_posting_jobs
  set
    graph_post_id = coalesce(graph_post_id, p_graph_post_id),
    updated_at = now()
  where job_id = p_job_id;

  return true;
end;
$$;

create or replace function public.release_publish_job_adu(
  p_job_id uuid,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.adu_posting_jobs%rowtype;
begin
  update public.adu_posting_jobs j
  set
    status = 'pending_publish',
    publish_started_at = null,
    last_error_code = coalesce(nullif(trim(p_error_code), ''), j.last_error_code),
    last_error_message = coalesce(nullif(trim(p_error_message), ''), j.last_error_message),
    updated_at = now()
  where j.job_id = p_job_id
    and j.status = 'publishing'
  returning j.*
  into v_job;

  if not found then
    return false;
  end if;

  if v_job.graph_post_id is null then
    update public.reels r
    set status = 'downloaded'
    where r.id = v_job.reel_internal_id
      and r.status = 'processing';
  end if;

  return true;
end;
$$;

grant execute on function public.record_adu_publish_graph_id(uuid, text) to service_role;
grant execute on function public.release_publish_job_adu(uuid, text, text) to service_role;
grant execute on function public.claim_publish_jobs_adu(int) to service_role;
grant execute on function public.reset_stale_publish_jobs_adu(int, int) to service_role;
grant execute on function public.create_due_adu_posting_jobs(text) to service_role;

create or replace function public.reset_stale_adu_reel_downloads(p_stale_minutes int default 40)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reset_count integer;
begin
  update public.reels
  set
    status = 'pending',
    download_claimed_at = null
  where status = 'processing'
    and download_claimed_at is not null
    and download_claimed_at < now() - make_interval(mins => p_stale_minutes)
    and download_retries < 3;

  get diagnostics v_reset_count = row_count;
  return v_reset_count;
end;
$$;

create or replace function public.claim_adu_buffer_downloads(p_limit int default 10)
returns table (
  reel_internal_id bigint,
  page_id uuid,
  platform public.platform_enum,
  username text,
  reel_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(p_limit, 0) <= 0 then
    return;
  end if;

  update public.pages p
  set
    status = 'creator_suspended',
    updated_at = now()
  where p.status = 'active'
    and (
      select count(*)::int
      from public.reels r
      where r.page_id = p.id
        and r.status = 'download_failed'
        and r.download_failed_at >= now() - interval '24 hours'
    ) > 30;

  return query
  with active_pages as (
    select
      p.id,
      coalesce(p.posts_per_day, 0) * 1 as buffer_target
    from public.pages p
    where p.status = 'active'
      and p.sync_status = 'synced'
      and coalesce(p.posts_per_day, 0) > 0
      and (
        select count(*)::int
        from public.reels r
        where r.page_id = p.id
          and r.status = 'download_failed'
          and r.download_failed_at >= now() - interval '24 hours'
      ) <= 7
  ),
  page_buffer as (
    select ap.id as page_id, ap.buffer_target
    from active_pages ap
    where (
      select count(*)::int
      from public.reels r
      where r.page_id = ap.id
        and (
          r.status = 'downloaded'
          or (r.status = 'processing' and r.download_claimed_at is not null)
        )
    ) < ap.buffer_target
  ),
  locked as (
    select r.id
    from page_buffer pb
    join public.reels r on r.page_id = pb.page_id
    where r.status = 'pending'
      and r.download_retries < 3
    order by r.id asc
    limit p_limit
    for update skip locked
  )
  update public.reels r
  set
    status = 'processing',
    download_retries = r.download_retries + 1,
    download_claimed_at = now()
  from locked l
  where r.id = l.id
  returning r.id, r.page_id, r.platform, r.username, r.reel_id;
end;
$$;

create or replace function public.mark_adu_reel_downloaded(
  p_reel_id bigint,
  p_media_object_key text,
  p_media_size_bytes bigint,
  p_media_content_type text,
  p_media_sha256 text,
  p_reel_caption text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.reels
  set
    status = 'downloaded',
    media_object_key = p_media_object_key,
    media_size_bytes = p_media_size_bytes,
    media_content_type = p_media_content_type,
    media_sha256 = p_media_sha256,
    reel_caption = coalesce(nullif(trim(p_reel_caption), ''), reel_caption, '...'),
    downloaded_at = now(),
    download_retries = 0,
    download_claimed_at = null
  where id = p_reel_id
    and status in ('pending', 'processing');
end;
$$;

create or replace function public.mark_adu_reel_download_failed(p_reel_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.reels
  set
    status = case
      when download_retries >= 3 then 'download_failed'::public.reel_status_enum
      else 'pending'::public.reel_status_enum
    end,
    download_failed_at = case
      when download_retries >= 3 then now()
      else null
    end,
    download_claimed_at = null
  where id = p_reel_id;
end;
$$;

create or replace function public.skip_adu_reel(p_reel_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.reels r
    join public.pages p on p.id = r.page_id
    where r.id = p_reel_id
      and r.status = 'downloaded'
      and (p.agency_id = auth.uid() or public.get_my_role() = 'super_admin')
  ) then
    raise exception 'forbidden';
  end if;

  update public.reels
  set status = 'failed'
  where id = p_reel_id and status = 'downloaded';
end;
$$;

grant execute on function public.skip_adu_reel(bigint) to authenticated;

-- Facebook RSS Auto Poster (20260527120000)
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
