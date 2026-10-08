<!--
Sync Impact Report:
- Version change: Unversioned Template -> 1.0.0
- List of modified principles:
  - PRINCIPLE_1: Spec-Driven Development (SDD) as Single Source of Truth
  - PRINCIPLE_2: Modular Architecture & Strict Service Boundary Isolation
  - PRINCIPLE_3: Multi-Tenant Defense-in-Depth & Data Isolation
  - PRINCIPLE_4: Zero-Trust Boundary Validation & Sanitization
  - PRINCIPLE_5: Atomic PRs & Linear Git Hygiene
- Added sections:
  - Technology & Architectural Constraints
  - Development Workflow & Quality Gates
- Removed sections: None (all template placeholders fully concretized)
- Follow-up TODOs: None
-->

# FBUploadPro Constitution

## Core Principles

### I. Spec-Driven Development (SDD) as Single Source of Truth
No application code, database migrations, or infrastructure configurations may be written or modified without an approved specification under `specs/`. Every implementation change must link directly to an approved specification requirement and a decomposed GitHub task issue. Test-Driven Development (TDD) is non-negotiable: tests asserting functional acceptance criteria must be written and approved before implementation code is finalized.

### II. Modular Architecture & Strict Service Boundary Isolation
The system enforces strict architectural decoupling between the edge execution layer (Cloudflare Workers), application control plane (Next.js 16 Webapp), and asynchronous ingestion pipelines (VPS Scraper/Downloaders). Edge workers must run in standard V8 isolate environments with zero Node.js TCP socket dependencies, using `@fbuploadpro/database/edge`. Web applications and background services must never cross-import code; all shared data contracts, validation schemas, and error definitions must reside strictly within `@fbuploadpro/contracts`.

### III. Multi-Tenant Defense-in-Depth & Data Isolation
Tenant boundaries (`agency_id`) are immutable and mandatory across all domain models. Database schemas must enforce multi-tenant isolation through composite foreign keys (e.g. `(agency_id, facebook_account_id)`) and compound unique constraints to eliminate any risk of cross-tenant data leakage. Financial and token balances must be protected with non-negative check constraints (`balance >= 0`, `reserved >= 0`) and atomic balance debits to guarantee ledger consistency under concurrency.

### IV. Zero-Trust Boundary Validation & Sanitization
All data crossing public API routes, webhook endpoints, and worker fetch handlers must be validated at runtime against strict Zod schemas. Sensitive secrets, tokens, connection strings, and database credentials must never be emitted in logs or client-facing responses. Diagnostic endpoints such as `/api/health` must enforce strict execution timeout budgets (e.g., 2000ms AbortController) and return sanitized status envelopes without exposing internal infrastructure topology.

### V. Atomic PRs & Linear Git Hygiene
Direct commits to `main` are strictly forbidden. All modifications must be delivered via dedicated feature branches and Pull Requests referencing their associated GitHub Issue (`Closes #X`). Net pull request diffs must remain small and focused (strictly under 150–200 lines of code). Every pull request must include verifiable test execution output and maintain zero linter warnings and zero type errors.

## Technology & Architectural Constraints

1. **Package Management & Tooling**: `pnpm` workspaces configured with Turborepo (`turbo.json`) for pipeline orchestration and task caching.
2. **TypeScript Standards**: TypeScript in strict mode across all packages and applications (`"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`). No unchecked type coercions (`any`).
3. **Database Substrate**: PostgreSQL database with forward SQL migrations, dual database client strategy (Node.js connection pool client for server runtimes, transport-isolated client for Cloudflare Workers edge isolates).
4. **Media & Buffer Storage**: Cloudflare R2 for short-form video storage and download buffers, using presigned access policies.
5. **Frontend Standards**: Next.js 16 App Router using React 19 standards, adhering strictly to event-driven state transitions (prohibiting `react-hooks/set-state-in-effect`).

## Development Workflow & Quality Gates

1. **Ideation & Governance**: Broad proposals and milestone announcements begin in GitHub Discussions.
2. **Spec Kit Lifecycle**: Features progress sequentially through:
   - `/speckit-specify` — Functional requirements & acceptance scenarios.
   - `/speckit-plan` — Technical architecture, contracts, and data models.
   - `/speckit-tasks` — Atomic task breakdown (<150–200 LoC).
   - `/speckit-taskstoissues` — Automated creation of GitHub Issues.
   - `/speckit-implement` — TDD execution of tasks.
   - `/speckit-converge` — Verification against specification before completion.
3. **CI Quality Gates**: All PRs must cleanly execute `pnpm turbo run build lint typecheck test` with 100% test pass rates before merge.

## Governance

The Constitution is the supreme governing document of the FBUploadPro repository and supersedes all conflicting instructions, agent prompts, or ad-hoc workflows.
- **Amendments**: Modifying this constitution requires formal proposal, documented rationale, and an increment to `CONSTITUTION_VERSION` following Semantic Versioning (MAJOR for breaking principle changes, MINOR for additions, PATCH for clarifications).
- **Compliance**: All contributors, AI agents, and code reviews must verify compliance against these principles before merging code.
- **Guidance Reference**: Operational agent instructions are maintained in [AGENTS.md](file:///home/shahzebpy/Documents/projects/fbuploadpro/AGENTS.md).

**Version**: 1.0.1 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-08
