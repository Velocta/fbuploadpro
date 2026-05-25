# RSS Auto Poster — deploy runbook

## Database

Apply migration on the target Supabase project:

```bash
supabase db push
# or apply database/migrations/20260527120000_facebook_rss_autoposter.sql
```

## Webapp (Vercel)

Set environment variables:

- `RSS_WORKER_SECRET` — shared secret for internal render API
- `WEBAPP_RENDER_BASE_URL` — public app URL (also set on the worker)
- Existing R2 and Supabase vars

## Cloudflare Worker

From `backend_v3/services/facebook/rss-autoposter/`:

```bash
chmod +x deploy.sh
./deploy.sh
```

Worker secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `USER_MEDIA_PUBLIC_BASE_URL`
- `WEBAPP_RENDER_BASE_URL`
- `RSS_WORKER_SECRET`

Cron: every minute (`* * * * *`).

## Verify

1. Connect a page at `/agency/facebook/rss-autoposter`
2. Validate RSS feed in the wizard
3. Save template and wait for a posting slot
4. Check `facebook_rss_autoposter_items` for `published` rows (7-day history in UI)
