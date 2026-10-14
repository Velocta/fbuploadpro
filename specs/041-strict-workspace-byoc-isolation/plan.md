# Implementation Plan: Strict Per-Workspace Facebook BYOC, Multi-Workspace Account/Page Isolation, and Global User Media Library

**Branch**: `fetch_upstream_main_changes` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/041-strict-workspace-byoc-isolation/spec.md`

---

## Summary

This feature enforces 100% strict per-workspace Facebook BYOC (Bring Your Own Credentials), eliminating all global platform environment variable fallbacks (`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`). It fixes security and validation bugs in BYOC settings/test routes, establishes the "Facebook BYOC" UI naming convention with pre-connection guards, enforces strict per-workspace isolation for social accounts, pages, slots, queues, logs, and insights, and makes the Media Library and Downloader global per user (`user_id`) across all of the user's workspaces via forward migration `20261014180000_global_user_media_library.sql`.

---

## Technical Context

**Language/Version**: TypeScript 5.8+ (Strict Mode), React 19, Next.js 16 (App Router), Node.js 22 LTS
**Primary Dependencies**: `@supabase/supabase-js`, `zod`, `@fbuploadpro/contracts`
**Storage**: Remote Supabase PostgreSQL (PostgREST over HTTPS, Row Level Security, forward SQL migrations), Cloudflare R2
**Testing**: Vitest, React Testing Library
**Target Platform**: Cloudflare Workers (edge dispatch), Vercel (Next.js 16 web control plane)
**Project Type**: Monorepo Web Application (`apps/web`, `apps/worker`, `packages/contracts`)
**Constraints**:
- Zero `process.env.FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` fallbacks
- Zero local database engines / zero local builds before PR opening
- Pure Supabase PostgREST (no `pg` driver, no TCP pooler)
- Strict theme token authority (`apps/web/src/lib/theme.ts`) and immutable `DESIGN.md`

---

## Constitution Check

- **Principle I (SDD Single Source of Truth)**: Approved `spec.md` and decomposed `tasks.md` drive all changes.
- **Principle II (Service Boundary Isolation)**: Clean shared contracts in `@fbuploadpro/contracts`.
- **Principle III (Multi-Tenant Isolation)**: Compound tenant boundaries for accounts/pages (`workspace_id`) and global media library (`user_id`).
- **Principle IV (Zero-Trust Validation)**: Zod schema validation across all modified endpoints.
- **Principle 27 (Multi-Workspace Architecture & Strict BYOC)**:
  - Facebook BYOC strictly scoped to `workspace_byoc_credentials`.
  - Zero blind upsert on `workspaces`.
  - Global media per user (`user_id`); social connections isolated per workspace (`workspace_id`).
- **Principle 28 (Pure Supabase PostgREST & RLS)**: Forward migration SQL authored under `supabase/migrations/`; no direct MCP execution.

---

## Project Structure

### Documentation & Specs

```text
specs/041-strict-workspace-byoc-isolation/
├── spec.md              # Requirements & User Stories
├── plan.md              # This file
├── research.md          # Architecture research & decisions
├── data-model.md        # Schema & entity definitions
├── contracts/           # API and route contracts
│   └── byoc-and-isolation-contracts.md
├── checklists/
│   ├── requirements.md  # Spec quality checklist
│   ├── security.md      # Security & multi-tenancy checklist
│   └── ux.md            # UX writing & theme checklist
└── tasks.md             # Sequenced atomic implementation tasks
```

### Source Code Impact

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/facebook/
│   │   │   │   ├── route.ts                            # Strict BYOC resolution via helper
│   │   │   │   └── callback/route.ts                   # Strict BYOC code exchange & workspace_id account upsert
│   │   │   ├── tenant/[subdomain]/
│   │   │   │   ├── accounts/
│   │   │   │   │   ├── route.ts                        # Filter accounts strictly by workspace_id
│   │   │   │   │   ├── magic-link/route.ts             # Pre-check BYOC configured
│   │   │   │   │   ├── [accountId]/route.ts            # Delete account scoped by workspace_id
│   │   │   │   │   └── [accountId]/pages/discover/     # Scope discover to workspace_id
│   │   │   │   ├── pages/
│   │   │   │   │   ├── route.ts                        # Filter pages strictly by workspace_id
│   │   │   │   │   ├── import/route.ts                 # Upsert pages with workspace_id
│   │   │   │   │   └── [pageId]/
│   │   │   │   │       ├── route.ts                    # Verify page workspace_id on GET/PATCH/DELETE
│   │   │   │   │       ├── slots/route.ts              # Verify page workspace_id on slots
│   │   │   │   │       └── insights/route.ts           # Verify page workspace_id on insights
│   │   │   │   ├── publishing/
│   │   │   │   │   ├── queue/route.ts                  # Scope queue to active workspace_id
│   │   │   │   │   ├── queue/[itemId]/route.ts         # Verify item's page belongs to workspace_id
│   │   │   │   │   └── logs/route.ts                   # Scope publish logs to active workspace_id
│   │   │   │   └── settings/byoc/
│   │   │   │       ├── route.ts                        # Query owner_id, reject first-time empty secret
│   │   │   │       └── test/route.ts                   # Query owner_id
│   │   │   └── connect/facebook/route.ts               # Strict BYOC lookup without env fallback
│   │   └── tenant/[subdomain]/
│   │       ├── settings/page.tsx                       # Rename tab to "Facebook BYOC"
│   │       └── accounts/page.tsx                       # Pre-connect guard & advisory modal
│   ├── components/
│   │   ├── settings/byoc-settings-view.tsx             # Rename heading to "Facebook BYOC"
│   │   └── accounts/connect-account-modal.tsx          # Pre-connection guard
│   └── lib/
│       └── server/byoc-resolver.ts                     # Shared server helper resolveWorkspaceFacebookCredentials
packages/contracts/
├── src/
│   └── domain/database.ts                              # Make workspace_id nullable on media rows
supabase/migrations/
└── 20261014180000_global_user_media_library.sql        # Reverse workspace restriction on media
```
