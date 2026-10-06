-- Facebook account status + cascade when a page becomes invalid_token

alter table public.facebook_accounts
  add column if not exists status public.profile_status_enum not null default 'invalid_token';

update public.facebook_accounts
set status = 'invalid_token'
where status is distinct from 'invalid_token';

-- Align linked pages with account invalid_token; keep terminal / verification states
update public.pages
set status = 'invalid_token', updated_at = now()
where facebook_account_id is not null
  and status not in ('completed', 'fb_verification_required', 'invalid_token');

create index if not exists idx_facebook_accounts_agency_status
  on public.facebook_accounts(agency_id, status);

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

drop trigger if exists tr_cascade_page_invalid_token on public.pages;

create trigger tr_cascade_page_invalid_token
  after update of status on public.pages
  for each row
  execute procedure public.cascade_page_invalid_token_to_account();
