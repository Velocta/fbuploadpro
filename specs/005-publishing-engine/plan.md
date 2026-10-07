# Implementation Plan: Automated Queue Slots Publishing Engine & Cloudflare Edge Dispatcher

**Branch**: `feat/005-publishing-engine-plan` | **Date**: 2026-10-07 | **Spec**: [specs/005-publishing-engine/spec.md](spec.md)

**Input**: Feature specification from `/specs/005-publishing-engine/spec.md`

## Summary

Implement an automated queue slots publishing engine uniting connected Facebook Pages (Spec 003) and user Media Library assets (Spec 004). Support recurring daily publishing time slots per Facebook Page with compound uniqueness on `(user_id, fb_page_id, slot_time)` and timezone awareness. Support selective asset queueing from the Media Library with custom captions, caption template attachment, and an optional automated first comment. Build a Cloudflare Worker edge scheduler (`apps/worker`) executing every minute via cron triggers, claiming due posts via PostgreSQL row-level locks (`SELECT ... FOR UPDATE SKIP LOCKED`), streaming video reels and photos directly to Facebook Graph API v26.0, and executing automated first comments. Enforce atomic 1-token deduction on successful publication, comprehensive error logging, retry limits, and an interactive queue management dashboard at `/tenant/[subdomain]/publishing`.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode across all packages: `"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`)

**Primary Dependencies**: Next.js 16 (App Router), React 19, Cloudflare Workers runtime, Zod (runtime boundary validation schemas in `@fbuploadpro/contracts`), `@fbuploadpro/database` (dual Node.js connection pool and Edge transport client), Web Crypto AES-256-GCM token decryption (`@fbuploadpro/contracts/crypto`)

**Storage**: PostgreSQL (`page_queue_slots`, `queue_items`, `publish_logs`, `token_transactions`) via forward DDL migration `0004_publishing_engine.sql`

**Testing**: Vitest (`@fbuploadpro/contracts`, `@fbuploadpro/database`, `@fbuploadpro/web`, `@fbuploadpro/worker`)

**Target Platform**: Next.js App Router (Node.js runtime & Edge middleware runtime) and Cloudflare Worker scheduled edge isolate

**Project Type**: Monorepo Web Application, Scheduled Edge Worker Daemon, Database Substrate & Shared Contracts

**Performance Goals**: Worker claims and dispatches due queue items within 60s of slot time; row lock query completes in <10ms; zero duplicate publishing under concurrent worker isolates; 100% zero token leakage on failed attempts

**Constraints**: Strict composite tenant isolation `(user_id, fb_page_id, ...)`; atomic 1-token deduction strictly upon verified Facebook publication; row-level lock concurrency safety (`FOR UPDATE SKIP LOCKED`); decoupled HTTP client for offline Facebook API mock testing in CI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Spec-Driven Development (SDD) as Single Source of Truth**: Approved specification at `specs/005-publishing-engine/spec.md`. TDD approach enforced with test tasks planned before implementation code.
- [x] **Principle II: Modular Architecture & Strict Service Boundary Isolation**: Zero Node.js TCP socket or stream dependencies in edge runtimes. Abstract `IFacebookPublishClient` and `IPublishDispatcher` in `@fbuploadpro/contracts` decouple Graph API interactions. Edge worker runs in Cloudflare Worker isolate using `@fbuploadpro/database/edge` or Node pool client where appropriate.
- [x] **Principle III: Multi-Tenant Defense-in-Depth & Data Isolation**: Tenant ownership is verified on all queue and slot operations (`user_id`). Composite foreign keys `(user_id, fb_page_id)` and `(user_id, media_id)` prevent cross-tenant asset associations. Compound unique constraints guarantee isolation.
- [x] **Principle IV: Zero-Trust Boundary Validation & Sanitization**: All slot inputs, queue requests, and dispatcher payloads are validated with strict Zod schemas. Facebook Page Access Tokens are decrypted on-the-fly and never logged or exposed in client responses.
- [x] **Principle V: Atomic PRs & Linear Git Hygiene**: All tasks decomposed into atomic increments (<150–200 LoC each) delivered via dedicated PRs referencing GitHub Issues.

## Project Structure

### Documentation (this feature)

```text
specs/005-publishing-engine/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Architectural decisions & research
├── data-model.md        # Entities, DDL migration & state transitions
├── quickstart.md        # Validation commands & test scenarios
├── contracts/           # Interface contracts
│   ├── slots.md         # Page queue slots CRUD contracts
│   ├── queue.md         # Queue management & enqueueing contracts
│   └── dispatcher.md    # Edge dispatcher & Graph API contracts
└── checklists/          # Requirements & quality checklists
    └── requirements.md  # Quality validation checklist
```

### Source Code

```text
packages/contracts/
├── src/
│   ├── domain/
│   │   ├── queue.ts           # PageQueueSlot, QueueItem, PublishLog schemas
│   │   └── dispatcher.ts      # ClaimedQueueItem, DispatchOutcome, IPublishDispatcher
│   └── index.ts
└── tests/
    └── publishing-contracts.test.ts # Zod schema validation tests

packages/database/
├── migrations/
│   └── 0004_publishing_engine.sql  # DDL migration for slots, queue items & logs
└── tests/
    └── publishing-engine.test.ts   # Compound isolation & FOR UPDATE SKIP LOCKED tests

apps/worker/
├── src/
│   ├── index.ts               # Scheduled cron handler export
│   ├── dispatcher.ts          # Claim, stream, publish, settle cycle
│   └── fb-client.ts           # Facebook Graph API v26.0 Reels/Photos/Comments client
├── wrangler.toml              # Crons configuration ["* * * * *"]
└── tests/
    └── dispatcher.test.ts     # Dispatcher unit & mock Graph API tests

apps/web/
├── src/
│   ├── lib/
│   │   └── queue-scheduler.ts # Slot vacancy & next scheduled time calculator
│   ├── app/
│   │   ├── api/tenant/[subdomain]/
│   │   │   ├── pages/[pageId]/slots/
│   │   │   │   ├── route.ts                 # List & create slots
│   │   │   │   └── [slotId]/route.ts        # Update & delete slot
│   │   │   └── publishing/
│   │   │       ├── queue/
│   │   │       │   ├── route.ts             # List & enqueue media
│   │   │       │   ├── [itemId]/route.ts    # Update, reorder & delete queue item
│   │   │       │   └── [itemId]/publish-now/route.ts # Manual immediate trigger
│   │   │       └── logs/route.ts            # Audit logs endpoint
│   │   └── tenant/[subdomain]/
│   │       └── publishing/
│   │           └── page.tsx                 # Interactive Publishing Queue UI
└── tests/
    └── publishing-routes.test.ts
```
