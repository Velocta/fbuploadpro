<!--
Sync Impact Report:
- Version change: 1.0.0 -> 1.1.0
- List of modified principles: None
- Added/Modified sections:
  - Technology & Architectural Constraints: Formally ratified Supabase for PostgreSQL substrate & Auth, Vercel for Next.js 16 web application hosting, and Cloudflare for Edge Workers & R2 Object Storage.
- Follow-up TODOs: None
-->

# FBUploadPro Constitution

## Core Principles

### I. Spec-Driven Development (SDD) as Single Source of Truth
No application code, database migrations, or infrastructure configurations may be written or modified without an approved specification under `specs/`. Every implementation change must link directly to an approved specification requirement and a decomposed GitHub task issue. Test-Driven Development (TDD) is non-negotiable: tests asserting functional acceptance criteria must be written and approved before implementation code is finalized.

### II. Modular Architecture & Strict Service Boundary Isolation
The system enforces strict architectural decoupling between the edge execution layer (Cloudflare Workers), application control plane (Next.js 16 Webapp), and asynchronous ingestion pipelines (VPS Scraper/Downloaders). Edge workers must run in standard V8 isolate environments with zero Node.js TCP socket dependencies, using `@fbuploadpro/database/edge`. Web applications and background services must never cross-import code; all shared data contracts, validation schemas, and error definitions must reside strictly within `@fbuploadpro/contracts`.

### III. Multi-Tenant Defense-in-Depth & Data Isolation
Tenant boundaries (`user_id`) are immutable and mandatory across all domain models. There are no agency containers in the platform: the platform architecture is centered strictly on individual **Users** (`user_id`), with **Sellers** and **Admins** operating under dedicated role-based boundaries. Database schemas must enforce multi-tenant isolation through composite foreign keys (e.g. `(user_id, facebook_account_id)`, `(user_id, folder_id)`) and compound unique constraints (e.g. `(user_id, fb_page_id)`) to eliminate any risk of cross-tenant data leakage. Financial and token balances must be protected with non-negative check constraints (`balance >= 0`, `reserved >= 0`) and atomic balance debits to guarantee ledger consistency under concurrency.

### IV. Zero-Trust Boundary Validation & Sanitization
All data crossing public API routes, webhook endpoints, and worker fetch handlers must be validated at runtime against strict Zod schemas. Sensitive secrets, tokens, connection strings, and database credentials must never be emitted in logs or client-facing responses. Diagnostic endpoints such as `/api/health` must enforce strict execution timeout budgets (e.g., 2000ms AbortController) and return sanitized status envelopes without exposing internal infrastructure topology.

### V. Atomic PRs & Linear Git Hygiene
Direct commits to `main` are strictly forbidden. All modifications must be delivered via dedicated feature branches and Pull Requests referencing their associated GitHub Issue (`Closes #X`). Net pull request diffs must remain small and focused (strictly under 150–200 lines of code). Every pull request must include verifiable test execution output and maintain zero linter warnings and zero type errors.

## Technology & Architectural Constraints

1. **Package Management & Tooling**: `pnpm` workspaces configured with Turborepo (`turbo.json`) for pipeline orchestration and task caching.
2. **TypeScript Standards**: TypeScript in strict mode across all packages and applications (`"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`). No unchecked type coercions (`any`).
3. **Database & Authentication (Supabase)**: PostgreSQL substrate powered by Supabase with forward SQL migrations, connection pooling (PgBouncer/transaction pooler for edge runtimes, direct port 5432 for schema DDL), and Supabase Auth integration.
4. **Web Application Hosting (Vercel)**: Next.js 16 App Router using React 19 standards hosted on Vercel, adhering strictly to event-driven state transitions (prohibiting `react-hooks/set-state-in-effect`).
5. **Edge Execution & Media Storage (Cloudflare)**:
   - **Workers**: Cloudflare Workers edge runtime (`apps/worker`) executing high-throughput scheduling and Facebook publishing dispatchers.
   - **R2 Storage**: Cloudflare R2 object storage for short-form video/image storage and presigned direct browser-to-bucket ingestion.
6. **Domain Separation & Gateway Routing**:
   - **Marketing Apex Domain (`fbuploadpro.com` / `www.fbuploadpro.com`)**: Strictly decoupled from the SaaS application; dedicated to marketing landing pages, Terms of Service (`/terms`), and Privacy Policy (`/privacy`), deployed and operated independently.
   - **Application Central Gateway (`app.fbuploadpro.com`)**: Hosts the primary authentication portal, providing `/login` and `/signup`.
   - **Tenant Workspaces (`{username}.fbuploadpro.com`)**: Serves authenticated user workspaces, with session cookies scoped to `.fbuploadpro.com` to enable seamless transitions from the gateway into private subdomains.

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
4. **Pre-Merge Component Showroom**: All mock data and UI component harnesses are isolated in `apps/showroom` (with zero mock code contaminating `apps/web`). Component previews and interactive stress tests are batched at the conclusion of milestone tasks when the PR is ready.
5. **Mandatory Human Approval Gate**: Autonomous or unapproved merges to `main` are strictly forbidden. The agent must explicitly ask for and receive user approval prior to executing any merge, regardless of whether the PR contains frontend, backend, database, or infrastructure changes.

## Governance

The Constitution is the supreme governing document of the FBUploadPro repository and supersedes all conflicting instructions, agent prompts, or ad-hoc workflows.
- **Amendments**: Modifying this constitution requires formal proposal, documented rationale, and an increment to `CONSTITUTION_VERSION` following Semantic Versioning (MAJOR for breaking principle changes, MINOR for additions, PATCH for clarifications).
- **Compliance**: All contributors, AI agents, and code reviews must verify compliance against these principles before merging code.
- **Guidance Reference**: Operational agent instructions are maintained in [AGENTS.md](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/verify_speckit_access/AGENTS.md).

**Version**: 1.3.0 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-08
