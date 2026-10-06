-- Allow finalize after Facebook upload even when graph_post_id was not persisted first.
-- Publisher marks the reel posted via finalize_posting_job_adu; graph id is optional metadata.

create or replace function public.finalize_posting_job_adu(p_job_id uuid, p_graph_post_id text default null)
returns table (
  job_id uuid,
  already_finalized boolean,
  finalized boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.adu_posting_jobs%rowtype;
  v_marked boolean := false;
  v_graph_id text;
begin
  select *
  into v_job
  from public.adu_posting_jobs
  where adu_posting_jobs.job_id = p_job_id
  for update;

  if not found then
    raise exception 'posting_job_not_found';
  end if;

  if v_job.status = 'published' then
    return query select p_job_id, true, false;
    return;
  end if;

  if v_job.status not in ('publishing', 'pending_publish') then
    raise exception 'job_not_ready_to_finalize';
  end if;

  v_graph_id := coalesce(nullif(trim(p_graph_post_id), ''), v_job.graph_post_id);

  select public.mark_reel_posted_with_token(v_job.reel_internal_id)
    into v_marked;

  if v_marked then
    update public.reels
    set
      graph_post_id = coalesce(v_graph_id, graph_post_id),
      media_object_key = null,
      media_size_bytes = null,
      media_content_type = null,
      media_sha256 = null
    where id = v_job.reel_internal_id;

    update public.adu_posting_jobs
    set
      status = 'published',
      published_at = now(),
      publish_started_at = null,
      graph_post_id = coalesce(v_graph_id, graph_post_id),
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
    where adu_posting_jobs.job_id = p_job_id;

    return query select p_job_id, false, true;
    return;
  end if;

  update public.adu_posting_jobs
  set
    status = 'published',
    published_at = now(),
    publish_started_at = null,
    graph_post_id = coalesce(v_graph_id, graph_post_id),
    updated_at = now()
  where adu_posting_jobs.job_id = p_job_id;

  return query select p_job_id, true, false;
end;
$$;

grant execute on function public.finalize_posting_job_adu(uuid, text) to service_role;
