-- Migration: Optimize public.users RLS policies and protect critical columns
-- Created: 2026-06-18

-- 1. Drop the old recursive update policy on public.users
drop policy if exists "Update own record" on public.users;

-- 2. Create a simplified, fast update policy on public.users
create policy "Update own record" on public.users 
  for update 
  using (id = auth.uid());

-- 3. Enhance the trigger function to protect both tokens_balance and role from tampering
create or replace function public.protect_user_tokens_balance()
returns trigger as $$
begin
    -- Protect critical columns from modification by non-super_admin / non-service_role
    if (select auth.role()) != 'service_role' and public.get_my_role() != 'super_admin' then
        if NEW.tokens_balance is distinct from OLD.tokens_balance then
            NEW.tokens_balance := OLD.tokens_balance;
        end if;
        if NEW.role is distinct from OLD.role then
            NEW.role := OLD.role;
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;
