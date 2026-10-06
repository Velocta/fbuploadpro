-- Migration: Optimize get_my_role() RLS helper and add schedule table indexes
-- Created: 2026-06-18

-- 1. Optimize public.get_my_role() to retrieve role from JWT claims when available (fast path)
-- fallback to public.users table check when in a non-request context (e.g., background cron/triggers)
create or replace function public.get_my_role()
returns public.user_role_enum as $$
declare
  v_role text;
begin
  -- Try to get role from request JWT claims (extremely fast, zero database queries)
  v_role := nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '');
  if v_role is not null then
    return v_role::public.user_role_enum;
  end if;

  -- Fall back to database query if not in a request context (e.g. background worker/triggers)
  select role::text into v_role from public.users where id = auth.uid();
  return coalesce(v_role, 'agency')::public.user_role_enum;
end;
$$ language plpgsql security definer stable;

-- 2. Add composite indexes on schedule tables to optimize dashboard statistics count queries
create index if not exists idx_facebook_direct_schedule_posts_agency_status 
  on public.facebook_direct_schedule_posts(agency_id, status);

create index if not exists idx_facebook_inapp_schedule_posts_agency_status 
  on public.facebook_inapp_schedule_posts(agency_id, status);
