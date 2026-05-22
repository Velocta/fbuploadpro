-- Enforce posting_times entries as HH:MM for future writes.
-- Existing rows are not blocked immediately (NOT VALID) and can be cleaned separately.
-- Date: 2026-04-23

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

alter table if exists public.pages
  drop constraint if exists pages_posting_times_hhmm_check;

alter table if exists public.pages
  add constraint pages_posting_times_hhmm_check
  check (public.is_valid_posting_times(posting_times))
  not valid;
