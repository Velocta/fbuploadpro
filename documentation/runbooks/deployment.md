# Deployment Runbook

## Pre-deploy

- If the release includes DB changes: add one migration under `database/migrations/` and update `database/production_schema.sql`.
- Confirm secrets/env for target environment (see `runbooks/environment.md`).
- For posting releases: set `posting_v2_intake_paused = true` until smoke checks pass.

## Recommended order

1. **Database** — Apply new migration in staging/production when schema-dependent.
2. **Posting workers** — `backend_v3/services/posting/deploy-posting.sh` (downloader → reel-geter → publisher → processors → scheduler).
3. **Analytics** — `backend_v3/services/analytics/deploy-analytics.sh` or manual wrangler deploy for followers cron.
4. **Scraper** — Restart VPS process if scraper code changed (`backend_v3/services/scraper/reels-scraper`).
5. **Webapp** — Vercel preview, then production promote.

Adjust order when only a subset of services changes.

## Post-deploy smoke checks

### Webapp

- Agency and super-admin login.
- `/api/v1/agency/...` and `/api/v1/admin/...` respond (503 if maintenance gate is still enabled in `proxy.ts`).

### Posting

- Downloader `GET /health` returns OK.
- Scheduler cron runs without Supabase RPC errors.
- One synthetic job reaches `published` (see `runbooks/posting-test-injection.md`) with intake paused first.
- Reel `posted` and one `token_transactions` usage row per job.

### Analytics

- Followers cron updates `pages.followers_count` / `is_followers_updated` cycle.

### Database

- No unexpected RLS errors in worker logs.

## Related runbooks

- `posting-deploy.md` — Posting worker deploy checklist
- `posting-test-injection.md` — Controlled test jobs
- `posting-rollback.md` — Pause intake and disable workers
- `posting-observability.md` — SQL health queries and backpressure
- `posting-replay-repair.md` — Failed job recovery
