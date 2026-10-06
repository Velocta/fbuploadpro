# FB Upload Pro v3 Agent Rules

FB Upload Pro v3 is a live-deployed multi-tenant SaaS for agencies managing Facebook publishing at scale. It includes a Next.js webapp, Cloudflare/VPS backend workers, and Supabase PostgreSQL.

## Start here

Before making changes, read:

1. `documentation/for_agent.md`
2. `documentation/architecture/system-overview.md`
3. `documentation/README.md`
4. Area-specific docs:
   - UI/webapp: `documentation/webapp/architecture.md`, `documentation/webapp/ui-ux-reference.md`, `documentation/webapp/performance.md`
   - Database: `documentation/database/migration-workflow.md`, `documentation/database/rls-overview.md`
   - Backend/workers: `backend_v3/README.md` and relevant runbook under `documentation/runbooks/`

## Repository layout

- `webapp/`: Next.js 16 / React 19 webapp, dashboards, auth, marketing, API v1, Vercel deployment.
- `backend_v3/`: Cloudflare Workers and VPS processes for Facebook posting, scraping, download/upload, RSS, analytics.
- `database/`: Supabase PostgreSQL schema and migrations.
- `documentation/`: architecture docs, ADRs, runbooks, webapp references.
- `.agents/rules/` and `.agents/skills/`: original project agent rules and skills.

## Mandatory project boundaries

- `webapp` and `backend_v3` are separate services; do not import code between them.
- Services coordinate only through Supabase, R2, and HTTP boundaries.
- Each backend worker owns its own Supabase client under its own folder.
- Do not move files across services or refactor top-level folder structure unless explicitly requested.
- Do not place service-specific plans/docs at repo root; use `documentation/`.
- New backend workers belong under `backend_v3/services/{platform}/{feature}/{type}/{worker-name}/`.

## Database rules

- Source of truth: `database/production_schema.sql`.
- For schema changes, add exactly one new migration in `database/migrations/` and update `database/production_schema.sql`.
- Never modify or delete existing migration files.
- Whenever adding a new migration file, explicitly tell the user the migration file path so they can run/apply it themselves from the CLI.
- Include RLS policies for new/changed tables in both the migration and production schema.
- Keep SQL compatible with Supabase PostgreSQL 14+.
- Feature-specific tables must use feature prefixes, e.g. `facebook_direct_posts`, `facebook_inapp_schedule_posts`, `token_cost_rules`.
- Legacy ADU tables stay named `pages`, `reels`, and `posting_jobs_v2`; do not rename without an explicit migration project.

## Token/billing rules

- Resolve token costs from `public.token_cost_rules`; do not hardcode token amounts in application code except migration seed defaults.
- Deduct tokens only after successful publish.
- Record charges in `token_transactions` with appropriate metadata.
- Use `media_type = '*'` as wildcard when one cost applies to all types.

## UI/UX rules

- For any `webapp/src/**` UI, layout, motion, style, or component work, read `documentation/webapp/ui-ux-reference.md` first.
- Treat the Green Mist UI/UX reference as source of truth for colors, typography, spacing, motion, and components.
- Reuse `webapp/src/components/ui`, `globals.css`, and existing feature patterns instead of inventing one-off visual values.
- Marketing sections may use the richer §8 atmosphere patterns; dashboards, dense tables, and forms must remain quieter and follow §1.2 / §13 constraints.
- Verify `prefers-reduced-motion` behavior for touched motion/decorative UI.

## Operational restrictions

- Do not inspect, print, commit, or persist `.env` files or secrets.
- Do not deploy workers, services, or code yourself unless the user explicitly overrides this project rule; provide exact deployment commands instead.
- Do not run Supabase MCP/schema mutation tools; Supabase access is read-only unless the user explicitly asks for local file migrations.
- Do not run `npm run dev` or `npm run build` in this workspace unless the user explicitly overrides this project rule. Prefer lint, typecheck, unit tests, and targeted verification.
- Never expose service-role credentials to client-side code or public APIs.

## Git workflow

- Sync `main`, then create/reuse a task branch (`feature/*`, `fix/*`, `chore/*`) before editing.
- Never commit directly to `main`.
- Run relevant local checks before pushing: lint, typecheck, tests, or targeted checks as applicable.
- Push the task branch and check CI when possible.
- Merge/update `main` only after explicit human confirmation.
- Never force-push unless explicitly requested.

## Skill loading

Before implementing or reviewing changes, load relevant skills from Hermes and/or this repo's imported project skills:

- Webapp/UI/API/auth/performance: React/Next.js, shadcn, Supabase, UI stack, frontend design, web performance skills.
- Backend/workers: Cloudflare Workers, Wrangler, backend patterns.
- Database: Supabase, PostgreSQL, database design, Supabase Postgres best practices.
- Documentation/ADRs: architecture decision records and doc coauthoring.

Also apply `.agents/rules/*` if a rule is more specific than this AGENTS.md.

## Reporting

When finishing work, report:

- branch name
- files changed
- checks run and real output summary
- blockers or skipped checks
- whether anything needs human QA, deployment, or merge confirmation
