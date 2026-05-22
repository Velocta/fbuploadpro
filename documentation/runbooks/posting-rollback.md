# Posting Rollback and Pause Runbook

## Immediate Safety Action

Pause intake:

```sql
update public.system_settings
set posting_v2_intake_paused = true
where id = 1;
```

This prevents new due-page capture while preserving current jobs.

## Rollback Sequence

1. Pause intake (`posting_v2_intake_paused=true`).
2. Disable scheduler cron trigger in Cloudflare for scheduler worker.
3. Disable processor workers (download/publish processors) if required.
4. Keep queue consumers disabled to prevent more side effects.
5. Investigate and repair impacted jobs using replay/repair runbook.

## Resume Sequence

1. Re-enable queue consumers.
2. Re-enable processors.
3. Re-enable scheduler trigger.
4. Set `posting_v2_intake_paused=false`.
5. Observe for at least 30 minutes for queue age/depth and integrity anomalies.
