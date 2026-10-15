# Implementation Plan: Complete Elimination of Webhooks

**Branch**: `feat/048-remove-webhooks` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/048-remove-webhooks/spec.md`

## Summary

Completely purge all webhook-related artifacts, database columns, contracts, UI components, and reserved routing rules across the monorepo. This involves creating a forward database migration to drop `workspace_byoc_credentials.webhook_verify_token`, removing `webhookVerifyToken` from `@fbuploadpro/contracts` workspace schemas, removing `'webhook'` from `RESERVED_SUBDOMAINS`, cleaning the Meta App Setup UI in `byoc-settings-view.tsx`, and updating server resolvers and API routes.

## Technical Context

**Language/Version**: TypeScript 5.8+, Next.js 16 (App Router), React 19, PostgreSQL 15+  
**Primary Dependencies**: `@fbuploadpro/contracts`, `@supabase/supabase-js`, `zod`  
**Storage**: Remote Supabase PostgreSQL (via forward migration `supabase/migrations/20261020000000_drop_byoc_webhook_verify_token.sql`)  
**Testing**: Vitest (`packages/contracts/tests/`, `apps/web/tests/`)  
**Target Platform**: Web application and Cloudflare edge services  
**Project Type**: Full-stack monorepo refactor and cleanup  
**Performance Goals**: N/A (schema column removal & dead-code elimination)  
**Constraints**: Follow Constitution Principle 30 (Pure Supabase Migration Standards), zero regressions to active BYOC OAuth functionality  
**Scale/Scope**: 1 migration, 3 contract files, 3 web application files, 5 unit test suites  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Principle 1: Monorepo Architecture & Package Boundaries (Contracts in `packages/contracts`, app logic in `apps/web`)
- [x] Principle 6: Strict Design System Authority (`DESIGN.md` untouched, theme tokens respected)
- [x] Principle 14: Automated Testing & Zero Mock Theater (Real unit tests asserting updated schemas and DOM)
- [x] Principle 30: Remote Supabase Database Migration Standards (Versioned migration in `supabase/migrations/`)
- [x] Single Combined PR Protocol (All artifacts, migrations, and docs included in single PR)

## Project Structure

### Documentation (this feature)

```text
specs/048-remove-webhooks/
├── plan.md              # This file
├── research.md          # Technical decisions and rationale
├── data-model.md        # Updated database schema and Zod contracts
├── quickstart.md        # Verification and testing scenarios
└── tasks.md             # Sequenced implementation tasks
```

### Source Code

```text
supabase/migrations/
└── 20261020000000_drop_byoc_webhook_verify_token.sql  # Forward migration dropping column

packages/contracts/src/domain/
├── user.ts          # Remove 'webhook' from RESERVED_SUBDOMAINS
├── workspace.ts     # Remove webhookVerifyToken from BYOC schemas
└── database.ts      # Remove webhook_verify_token from DB row types

apps/web/src/
├── components/settings/
│   └── byoc-settings-view.tsx    # Remove Webhook Callback URL copy box and webhookUrl prop
├── app/api/tenant/[subdomain]/settings/byoc/
│   └── route.ts                  # Remove webhook_verify_token DB query and payload handling
└── lib/server/
    └── byoc-resolver.ts          # Remove webhookVerifyToken resolution
```
