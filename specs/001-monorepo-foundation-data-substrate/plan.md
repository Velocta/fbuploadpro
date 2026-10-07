# Implementation Plan: Core Monorepo Foundation & Data Substrate

**Branch**: `spec/001-monorepo-foundation-data-substrate` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-monorepo-foundation-data-substrate/spec.md`

## Summary

Establish the foundational multi-workspace monorepo infrastructure and secure data substrate for FBUploadPro. This includes setting up Turborepo and pnpm workspaces, authoring `@fbuploadpro/contracts` for pure domain schemas and error taxonomies, implementing `@fbuploadpro/database` with PostgreSQL DDL migrations (composite multi-tenant isolation keys, non-negative balance checks) and dual Node/Edge clients, scaffolding Next.js 16 (`apps/web`) with a sanitized 2000ms health check route, and setting up Cloudflare Worker (`apps/worker`) edge runtime with CI quality gates.

## Technical Context

**Language/Version**: TypeScript 5.9+ / Node.js 20+

**Primary Dependencies**: Turborepo, pnpm 9+, Zod, pg, Next.js 16 (React 19), Cloudflare Wrangler, Vitest, ESLint 9

**Storage**: PostgreSQL (Supabase / PostgreSQL 15+) with forward DDL migrations

**Testing**: Vitest across all workspaces (`packages/contracts`, `packages/database`, `apps/web`, `apps/worker`)

**Target Platform**: Node.js (Linux/Vercel) for Web and Cloudflare Workers (V8 Isolates) for Worker

**Project Type**: Monorepo with web service (`apps/web`), edge worker (`apps/worker`), and shared packages (`packages/contracts`, `packages/database`)

**Performance Goals**: Diagnostic health probes resolve in <2000ms; atomic token balance decrements execute in a single roundtrip

**Constraints**:
- Strict multi-tenant isolation enforced via composite foreign keys `(agency_id, facebook_account_id)`
- Zero Node.js TCP socket dependencies in edge isolate execution
- Sanitized health probes preventing credential and stack trace leakage
- Atomic debit semantics preventing balance overdrafts under concurrent load

**Scale/Scope**: 2 shared packages, 2 application shells, root CI pipeline, <150 LoC per implementation task

## Constitution Check

*GATE: All principles from [.specify/memory/constitution.md](../../.specify/memory/constitution.md) must pass before implementation.*

1. **Principle I: Spec-Driven Development (SDD) as SSOT**: PASS. Approved spec exists at `specs/001-monorepo-foundation-data-substrate/spec.md`. TDD required for all modules.
2. **Principle II: Modular Architecture & Service Isolation**: PASS. Shared contracts isolated in `@fbuploadpro/contracts`; database clients separated into Node and Edge modules; zero cross-app code imports.
3. **Principle III: Multi-Tenant Defense-in-Depth**: PASS. Composite foreign keys `(agency_id, facebook_account_id)`, unique tenant constraints, non-negative check constraints (`balance >= 0`), and atomic conditional decrements.
4. **Principle IV: Zero-Trust Boundary Validation & Sanitization**: PASS. Runtime Zod schema validation across all inputs; 2000ms timeout budget on `/api/health` with sanitized response envelopes.
5. **Principle V: Atomic PRs & Linear Git Hygiene**: PASS. Tasks decomposed to <150–200 LoC each, with PRs linked to dedicated task issues.

## Project Structure

### Documentation (this feature)

```text
specs/001-monorepo-foundation-data-substrate/
├── spec.md              # Feature specification
├── plan.md              # Technical implementation plan
├── research.md          # Phase 0 architectural research
├── data-model.md        # Phase 1 data model & schema invariants
├── quickstart.md        # Phase 1 verification & quickstart guide
├── contracts/           # Phase 1 domain, database, and health contracts
│   ├── domain-contracts.md
│   ├── database-client.md
│   └── health-probe-api.md
├── checklists/          # Quality validation checklists
│   └── requirements.md
└── tasks.md             # Phase 2 task decomposition (generated via /speckit-tasks)
```

### Source Code (repository root)

```text
packages/contracts/
├── package.json
├── tsconfig.json
├── tests/
│   └── contracts.test.ts
└── src/
    ├── domain/
    │   ├── agency.ts
    │   ├── user.ts
    │   ├── facebook.ts
    │   └── billing.ts
    ├── errors/
    │   └── domain-error.ts
    └── index.ts

packages/database/
├── package.json
├── tsconfig.json
├── migrations/
│   └── 0001_initial_schema.sql
├── tests/
│   └── database.test.ts
└── src/
    ├── client.ts
    ├── edge.ts
    └── index.ts

apps/web/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tests/
│   └── health.test.ts
└── src/
    └── app/
        ├── api/health/route.ts
        ├── layout.tsx
        └── page.tsx

apps/worker/
├── package.json
├── tsconfig.json
├── wrangler.toml
├── tests/
│   └── worker.test.ts
└── src/
    └── index.ts

.github/workflows/
└── ci.yml
```

**Structure Decision**: A clean pnpm workspace and Turborepo monorepo cleanly isolating shared domain contracts (`packages/contracts`) and database access (`packages/database`) from consumer applications (`apps/web` and `apps/worker`).

## Complexity Tracking

*No constitutional violations identified. Design adheres strictly to simplicity, type safety, and isolation invariants.*
