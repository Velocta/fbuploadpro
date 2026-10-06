# Database Migration Workflow

Canonical database path: `database/`.

## Source of truth

| Artifact | Purpose |
|----------|---------|
| `database/production_schema.sql` | Full canonical schema for fresh installs and reference |
| `database/migrations/` | One new `.sql` file per forward change |

Historical migrations were merged into `production_schema.sql` on 2026-05-22. Do not recreate deleted migration files.

Current migrations:
- `20260522120000_platform_features_tables.sql` — `token_cost_rules`, `facebook_direct_posts`, `facebook_direct_schedule_pages/posts`, `facebook_inapp_schedule_pages/posts`, claim RPC.

`supabase/` is not used as migration source in this repository.

## Required process for any DB change

1. Add exactly one new migration file in `database/migrations/` (dated prefix, e.g. `20260522_description.sql`).
2. Keep migration idempotent where practical (`IF EXISTS` / `IF NOT EXISTS`).
3. Include all affected RLS policies in the migration.
4. Update `database/production_schema.sql` to match the final post-migration state.
5. Verify SQL is compatible with Supabase PostgreSQL 14+.
6. Do not add seed data unless explicitly requested.

## Release order

1. Apply migration in staging.
2. Validate app flows, RLS, and worker RPCs.
3. Update and review `production_schema.sql`.
4. Deploy `backend_v3` workers and/or `webapp` that depend on the schema.
5. Apply migration in production.

## Policy consistency checklist

- Table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- Policies cover intended roles (`agency`, `super_admin`, `service_role`).
- Snapshot includes the same policy definitions as the migration.
