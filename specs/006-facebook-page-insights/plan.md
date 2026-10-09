# Implementation Plan: Dedicated Facebook Page Insights & Analytics Suite

**Branch**: `feat/006-facebook-page-insights-plan` | **Date**: 2026-10-08 | **Spec**: [specs/006-facebook-page-insights/spec.md](spec.md)

**Input**: Feature specification from `/specs/006-facebook-page-insights/spec.md`

## Summary

Implement a dedicated Facebook Page Insights analytics suite delivering deep visibility into connected Facebook Page performance. Build a hybrid server-side proxy and snapshot ingestion engine: query Facebook Graph API v26.0 on-demand with 15-minute server caching to safeguard rate limits, while storing daily historical metric snapshots in PostgreSQL (`page_insights_daily_snapshots`) via Cloudflare Worker scheduled background sync. Expose a secure, tenant-isolated API endpoint (`GET /api/tenant/[subdomain]/pages/[pageId]/insights`) that decrypts Page access tokens server-side using AES-256-GCM with zero token leakage.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode across monorepo packages: `"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`)

**Primary Dependencies**: Next.js 16 (App Router), React 19, Recharts 3.x, Lucide React, Zod (runtime boundary schemas in `@fbuploadpro/contracts`), `@fbuploadpro/database` (dual Node.js connection pool and Edge transport client), Web Crypto AES-256-GCM token decryption (`@fbuploadpro/contracts/crypto`)

**Storage**: PostgreSQL (`page_insights_daily_snapshots`) via forward DDL migration `0005_page_insights.sql`

**Testing**: Vitest (`@fbuploadpro/contracts`, `@fbuploadpro/database`, `@fbuploadpro/web`, `@fbuploadpro/worker`)

**Target Platform**: Next.js App Router (Node.js runtime & Edge middleware runtime) and Cloudflare Worker scheduled edge isolate

**Project Type**: Monorepo Web Application, Scheduled Edge Worker Daemon, Database Substrate & Shared Contracts

**Performance Goals**: API response served in <50ms when cached, <800ms on live Graph API fetch; zero layout shift (CLS = 0) via pre-sized skeleton cards; zero duplicate snapshot rows under concurrent cron execution; 100% zero token leakage across all responses and logs

**Constraints**: Strict composite tenant isolation `(user_id, fb_page_id, ...)`; server-only token decryption; Facebook Graph API v26.0 error classification; offline Graph API mock testing for CI quality gates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Spec-Driven Development (SDD) as Single Source of Truth**: Approved specification at `specs/006-facebook-page-insights/spec.md`. TDD approach enforced with test tasks planned before implementation code.
- [x] **Principle II: Modular Architecture & Strict Service Boundary Isolation**: Zero Node.js TCP socket or stream dependencies in edge runtimes. Abstract `IFacebookInsightsClient` in `@fbuploadpro/contracts` decouples Graph API interactions. Edge worker runs in Cloudflare Worker isolate using `@fbuploadpro/database/edge`. Web applications and background services never cross-import code.
- [x] **Principle III: Multi-Tenant Defense-in-Depth & Data Isolation**: Tenant ownership is verified on all insights queries (`user_id`). Composite foreign keys `(user_id, fb_page_id)` prevent cross-tenant data access. Compound unique constraints on snapshots `(user_id, fb_page_id, snapshot_date)` eliminate duplicate or leaked metrics.
- [x] **Principle IV: Zero-Trust Boundary Validation & Sanitization**: All insights requests, query parameters, and Graph API responses are validated with strict Zod schemas. Facebook Page Access Tokens are decrypted on-the-fly server-side and never logged or exposed in client responses.
- [x] **Principle V: Atomic PRs & Linear Git Hygiene**: All tasks decomposed into atomic increments (<150–200 LoC each) delivered via dedicated PRs referencing GitHub Issues.

## Project Structure

### Documentation (this feature)

```text
specs/006-facebook-page-insights/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Architectural decisions & research
├── data-model.md        # Entities, DDL migration & state transitions
├── quickstart.md        # Validation commands & test scenarios
├── contracts/           # Interface contracts
│   └── insights.md      # Insights API schema & Graph API contracts
└── checklists/          # Requirements & quality checklists
    └── requirements.md  # Quality validation checklist
```

### Source Code

```text
packages/contracts/
├── src/
│   ├── domain/
│   │   └── insights.ts            # PageInsightsOverview, TimeSeriesPoint, Reactions, Demographics schemas
│   └── index.ts
└── tests/
    └── insights-contracts.test.ts # Zod schema validation tests

packages/database/
├── migrations/
│   └── 0005_page_insights.sql    # DDL migration for page_insights_daily_snapshots
├── src/schema/
│   └── page-insights.ts          # Drizzle ORM schema for snapshots
└── tests/
    └── page-insights.test.ts      # Compound isolation & snapshot upsert tests

apps/web/
├── src/
│   ├── app/
│   │   └── api/tenant/[subdomain]/pages/[pageId]/insights/
│   │       └── route.ts          # Server-side insights proxy with 15m cache
│   └── lib/insights/
│       ├── facebook-insights-client.ts # Graph API v26.0 fetcher & normalizer
│       └── insights-cache.ts     # In-memory/TTL cache manager
└── tests/
    ├── api/page-insights-overview.test.ts # Server proxy API integration tests
    └── security/insights-token-leakage.test.ts # Zero token leakage assertion

apps/worker/
├── src/
│   ├── insights-sync.ts          # Scheduled daily snapshot sync worker
│   └── index.ts                  # Cron dispatcher registration
└── tests/
    └── insights-sync.test.ts     # Edge worker snapshot upsert tests
```
