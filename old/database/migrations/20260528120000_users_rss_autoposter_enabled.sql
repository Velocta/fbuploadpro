alter table public.users
  add column if not exists rss_autoposter_enabled boolean not null default false;

comment on column public.users.rss_autoposter_enabled is
  'When true, agency can access RSS Auto Poster UI and APIs.';
