-- Add facebook source/posting platform support and token deduction mapping.
-- Date: 2026-04-22

alter type public.source_platform_enum add value if not exists 'facebook';
alter type public.platform_enum add value if not exists 'facebook';

create or replace function public.mark_reel_posted_with_token(p_reel_id bigint)
returns boolean as $$
declare
    v_user_id uuid;
    v_current_tokens bigint;
    v_platform public.platform_enum;
    v_deduction int;
begin
    -- A. Identify the user (Agency) and Platform
    select p.agency_id, r.platform into v_user_id, v_platform
    from public.pages p
    join public.reels r on r.page_id = p.id
    where r.id = p_reel_id;

    if not found then
        raise exception 'Reel or linked Agency not found';
    end if;

    -- B. Determine Deduction Amount
    v_deduction := case
        when v_platform = 'instagram' then 1
        when v_platform = 'tiktok' then 2
        when v_platform = 'youtube' then 2
        when v_platform = 'facebook' then 2
        else 1 -- Fallback
    end;

    -- C. Check balance
    select tokens_balance into v_current_tokens
    from public.users where id = v_user_id;

    if v_current_tokens < v_deduction then
        raise exception 'Insufficient tokens for user %. Required: %, Available: %', v_user_id, v_deduction, v_current_tokens;
    end if;

    -- D. Update Reel Status
    update public.reels
    set status = 'posted'
    where id = p_reel_id
      and status != 'posted';

    if not found then
        return false;
    end if;

    -- E. Deduct Tokens
    update public.users
    set tokens_balance = tokens_balance - v_deduction
    where id = v_user_id;

    -- F. Log Transaction
    insert into public.token_transactions (user_id, amount, type, reel_id, metadata)
    values (
        v_user_id,
        -v_deduction,
        'usage',
        p_reel_id,
        jsonb_build_object('platform', v_platform)
    );

    return true;
end;
$$ language plpgsql security definer;
