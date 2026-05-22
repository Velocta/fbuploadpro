-- Partial index + RPC for super-admin "tokens used since" (single scalar, low client/DB overhead).
-- Date: 2026-04-27

create index if not exists idx_token_transactions_usage_created_at
  on public.token_transactions (created_at desc)
  where type = 'usage';

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
