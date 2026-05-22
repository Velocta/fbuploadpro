-- Migration: add required phone_number to users and update signup trigger
-- Date: 2026-04-13

alter table public.users
add column if not exists phone_number text not null default '';

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
