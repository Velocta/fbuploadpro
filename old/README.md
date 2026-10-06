# FBUploadPro (fbuploadprov3)

Multi-service codebase for scraping short-form content, scheduling Facebook Reels publishing, and managing agency operations.

## Repository layout

```
fbuploadprov3/
├── webapp/              # Next.js 16 — dashboards, auth, API v1
├── backend_v3/          # Posting workers, followers cron, VPS scraper
├── database/            # production_schema.sql + migrations/
└── documentation/       # Architecture, runbooks, ADRs
```

## Quick start for contributors

1. Read [`documentation/README.md`](documentation/README.md) for the doc index.
2. Schema: [`database/production_schema.sql`](database/production_schema.sql)
3. Backend map: [`backend_v3/README.md`](backend_v3/README.md)
4. Webapp: [`documentation/webapp/architecture.md`](documentation/webapp/architecture.md)

## Architecture principles

- **Service isolation** — `webapp` and `backend_v3` do not import each other's code.
- **Shared database** — Supabase PostgreSQL; each service has its own DB client in its folder.
- **Schema governance** — Changes via `database/migrations/` + sync to `production_schema.sql`.
- **Versioned API** — HTTP contracts under `webapp/src/app/api/v1`.

## Local webapp

```bash
cd webapp
cp .env.example .env.local   # fill Supabase and domain secrets
npm install
npm run dev
```

## Git workflow

Work on a task branch (`feature/*`, `fix/*`, `chore/*`), run lint/typecheck, push, get human confirmation before merging to `main`.
