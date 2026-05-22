-- Migration: Fix Token Balance Trigger Logic
-- Date: 2026-02-06
-- Reason: 'current_user' returns the DB user (postgres), not the JWT role (service_role). 
--         We must use auth.role() to correctly identify the Service Role key.

create or replace function public.protect_user_tokens_balance()
returns trigger as $$
begin
    -- Check if JWT role is service_role OR if user is super_admin
    if NEW.tokens_balance is distinct from OLD.tokens_balance 
       and (select auth.role()) != 'service_role' 
       and public.get_my_role() != 'super_admin' then
        -- Revert change if unauthorized
        NEW.tokens_balance := OLD.tokens_balance;
    end if;
    return new;
end;
$$ language plpgsql security definer;
