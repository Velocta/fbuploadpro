# Deployment Runbook

## Pre-deploy

- If the release includes DB changes: add one migration under `database/migrations/` and update `database/production_schema.sql`.
- Confirm secrets/env for target environment (see `runbooks/environment.md`).
- For posting releases: set `posting_v2_intake_paused = true` until smoke checks pass.

## Recommended order

1. **Database** — Apply new migration in staging/production when schema-dependent.
2. **ADU Posting workers** — `backend_v3/services/facebook/auto-download-upload/posting/deploy.sh` (downloader → reel-geter → publisher → processors → scheduler).
3. **InApp Schedule worker** — `cd backend_v3/services/facebook/inapp-schedule/posting/processor-worker && npm install && npx wrangler deploy`.
4. **Analytics** — `backend_v3/services/facebook/auto-download-upload/analytics/deploy.sh`.
5. **Scraper** — Restart VPS process if scraper code changed (`backend_v3/services/facebook/auto-download-upload/scraping/reels-scraper`).
6. **Webapp** — Staging preview, then promote.

Adjust order when only a subset of services changes.

## Post-deploy smoke checks

### Webapp

- Agency and super-admin login.
- Sidebar navigation renders correctly (Facebook, YouTube shells, Instagram shells, Settings).
- `/api/v1/agency/uploads/presign` responds (requires R2 env vars).
- `/api/v1/agency/facebook/direct-post` responds.
- `/api/v1/agency/facebook/direct-schedule` responds.
- `/api/v1/agency/facebook/inapp-schedule` responds.

### ADU Posting

- Downloader `GET /health` returns OK.
- Scheduler cron runs without Supabase RPC errors.
- One synthetic job reaches `published` (see `runbooks/posting-test-injection.md`) with intake paused first.
- Reel `posted` and one `token_transactions` usage row per job.

### InApp Schedule

- Processor cron runs without errors.
- Create a test pending post with `scheduled_at` in the past → verify it publishes immediately.
- Token balance decremented.

### Analytics

- Followers cron updates `pages.followers_count` / `is_followers_updated` cycle.

### Database

- No unexpected RLS errors in worker logs.
- `token_cost_rules` seeded with expected rows.

## Related runbooks

- `posting-deploy.md` — ADU posting worker deploy checklist
- `posting-test-injection.md` — Controlled test jobs
- `posting-rollback.md` — Pause intake and disable workers
- `posting-observability.md` — SQL health queries and backpressure
- `posting-replay-repair.md` — Failed job recovery
