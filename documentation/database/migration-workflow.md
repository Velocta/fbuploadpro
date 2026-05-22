# Database Migration Workflow

Canonical database path for this repository is `database/`.

## Source of Truth

- Incremental changes: `database/migrations/`
- Current schema snapshot: `database/production_schema.sql`

`supabase/` is not used as migration source in this repository.

## Required Process for Any DB Change

1. Add exactly one new migration file in `database/migrations/`.
2. Keep migration idempotent where practical (`if exists` / `if not exists` guards).
3. Include any RLS/policy changes in the migration.
4. Update `database/production_schema.sql` so it reflects the final post-migration state.
5. Verify SQL is compatible with Supabase PostgreSQL 14+.
6. Do not add seed data unless explicitly requested.

## Release Order

1. Apply migration in staging.
2. Validate app flows and RLS behavior.
3. Update and review `production_schema.sql` snapshot.
4. Deploy services depending on the new schema.
5. Apply migration in production.

## Policy Consistency Checklist

- Table has `enable row level security`.
- Required policies exist for intended access patterns.
- Snapshot includes same policy definitions as migration head.
