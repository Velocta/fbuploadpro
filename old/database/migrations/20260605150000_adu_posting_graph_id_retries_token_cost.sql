-- ADU posting: token_cost_rules lookup, exhaust publish retries, facebook source cost seed

insert into public.token_cost_rules (feature, platform, media_type, source_platform, token_cost)
select v.feature, v.platform, v.media_type, v.source_platform, v.token_cost
from (values
  ('auto_download_upload'::text, 'facebook'::text, '*'::text, 'facebook'::text, 2)
) as v(feature, platform, media_type, source_platform, token_cost)
where not exists (
  select 1 from public.token_cost_rules r
  where r.feature = v.feature
    and r.platform = v.platform
    and r.media_type = v.media_type
    and coalesce(r.source_platform, '') = coalesce(v.source_platform, '')
);

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
  select p.agency_id, r.platform
  into v_user_id, v_source_platform
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

  select tokens_balance
  into v_current_tokens
  from public.users
  where id = v_user_id;

  if v_current_tokens < v_deduction then
    raise exception 'Insufficient tokens for user %. Required: %, Available: %',
      v_user_id, v_deduction, v_current_tokens;
  end if;

  update public.reels
  set status = 'posted'
  where id = p_reel_id
    and status != 'posted';

  if not found then
    return false;
  end if;

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

  return true;
exception
  when others then
    raise;
end;
$$;

create or replace function public.claim_publish_jobs_adu(p_limit int default 100)
returns setof public.adu_posting_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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
    and j.publish_retries > 5;

  return query
  with locked as (
    select j.job_id
    from public.adu_posting_jobs j
    where j.status = 'pending_publish'
      and j.publish_retries <= 5
    order by j.updated_at asc
    limit greatest(1, p_limit)
    for update skip locked
  )
  update public.adu_posting_jobs j
  set
    status = 'publishing',
    publish_started_at = now(),
    updated_at = now()
  where j.job_id in (select l.job_id from locked l)
  returning j.*;
end;
$$;
