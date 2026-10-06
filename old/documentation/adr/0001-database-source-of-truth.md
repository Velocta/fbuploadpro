# ADR 0001: Database Source of Truth

## Status

Accepted

## Context

Project guidance referenced both `supabase/` and `database/` as migration locations, creating ambiguity and drift risk.

## Decision

This repository uses `database/` as the only schema governance location:

- `database/migrations/` for forward changes.
- `database/production_schema.sql` for current snapshot.

## Consequences

- Contributors have one clear DB workflow.
- Tooling/docs must point to `database/`.
- Any future move to another directory must be an explicit migration project, not ad-hoc.
