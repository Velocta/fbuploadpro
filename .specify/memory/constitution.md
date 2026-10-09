<!--
Sync Impact Report:
- Version change: 2.0.0 -> 2.1.0 (MINOR: Added Theme Token & Design System Governance constraint)
- List of modified principles:
  - Technology & Architectural Constraints: Added Section 8 establishing `apps/web/src/lib/theme.ts` as the mandatory centralized theme authority. Declared permanent ban on ad-hoc color declarations and capsule pill badges.
- Added/Modified sections:
  - Section 8: Theme Token & Design System Governance (apps/web/src/lib/theme.ts).
- Follow-up TODOs: Enforce theme-standards.md across all UI components.
-->

# FBUploadPro Constitution

## Core Principles

### I. Spec-Driven Development (SDD) as Single Source of Truth
No application code, database migrations, or infrastructure configurations may be written or modified without an approved specification under `specs/`. Every implementation change must link directly to an approved specification requirement and a decomposed GitHub task issue. Test-Driven Development (TDD) is non-negotiable: tests asserting functional acceptance criteria must be written and approved before implementation code is finalized.

### II. Modular Architecture & Strict Service Boundary Isolation
The system enforces strict architectural decoupling between the edge execution layer (Cloudflare Workers), application control plane (Next.js 16 Webapp), and asynchronous ingestion pipelines (VPS Scraper/Downloaders). Edge workers must run in standard V8 isolate environments with zero Node.js TCP socket dependencies, using `@fbuploadpro/database/edge`. Web applications and background services must never cross-import code; all shared data contracts, validation schemas, and error definitions must reside strictly within `@fbuploadpro/contracts`.

### III. Multi-Tenant Defense-in-Depth & Data Isolation
Tenant boundaries (`user_id`) are immutable and mandatory across all domain models. There are no agency containers in the platform: the platform architecture is centered strictly on individual **Users** (`user_id`), with **Sellers** and **Admins** operating under dedicated role-based boundaries. Database schemas must enforce multi-tenant isolation through composite foreign keys (e.g. `(user_id, facebook_account_id)`, `(user_id, folder_id)`) and compound unique constraints (e.g. `(user_id, fb_page_id)`) to eliminate any risk of cross-tenant data leakage. Publishing entitlement is unrestricted for all active users (`status = 'active'`) with connected Facebook Pages. All legacy prepaid token ledger, balance constraints, and token debit mechanisms are formally abolished and purged from the platform data model.

### IV. Zero-Trust Boundary Validation & Sanitization
All data crossing public API routes, webhook endpoints, and worker fetch handlers must be validated at runtime against strict Zod schemas. Sensitive secrets, tokens, connection strings, and database credentials must never be emitted in logs or client-facing responses. Diagnostic endpoints such as `/api/health` must enforce strict execution timeout budgets (e.g., 2000ms AbortController) and return sanitized status envelopes without exposing internal infrastructure topology.

### V. Atomic PRs & Linear Git Hygiene
Direct commits to `main` are strictly forbidden. All modifications must be delivered via dedicated feature branches and Pull Requests referencing their associated GitHub Issue (`Closes #X`). Net pull request diffs must remain small and focused (strictly under 150–200 lines of code). Every pull request must include verifiable test execution output and maintain zero linter warnings and zero type errors.

## Technology & Architectural Constraints

1. **Package Management & Tooling**: `pnpm` workspaces configured with Turborepo (`turbo.json`) for pipeline orchestration and task caching.
2. **TypeScript Standards**: TypeScript in strict mode across all packages and applications (`"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`). No unchecked type coercions (`any`).
3. **Database & Authentication (Supabase)**: PostgreSQL substrate powered by Supabase with forward SQL migrations maintained under `/supabase/migrations/` using the Supabase GitHub Integration standard (`YYYYMMDDHHmmss_<name>.sql`), connection pooling (PgBouncer/transaction pooler for edge runtimes, direct port 5432 for schema DDL), and Supabase Auth integration. Supabase branching is disabled (paid tier feature); the architecture operates strictly against the single primary database instance, with migrations deployed automatically upon merge to `main`. Agents and tools are strictly prohibited from executing migrations via Supabase MCP (`apply_migration`, `execute_sql`); migrations deploy exclusively through Git merges to `main`.
4. **Web Application Hosting (Vercel)**: Next.js 16 App Router using React 19 standards hosted on Vercel, adhering strictly to event-driven state transitions (prohibiting `react-hooks/set-state-in-effect`).
5. **Edge Execution & Media Storage (Cloudflare)**:
   - **Workers**: Cloudflare Workers edge runtime (`apps/worker`) executing high-throughput scheduling and Facebook publishing dispatchers.
   - **R2 Storage**: Cloudflare R2 object storage for short-form video/image storage and presigned direct browser-to-bucket ingestion.
6. **Domain Separation & Gateway Routing**:
   - **Marketing Apex Domain (`fbuploadpro.com` / `www.fbuploadpro.com`)**: Strictly decoupled from the SaaS application; dedicated to marketing landing pages, Terms of Service (`/terms`), and Privacy Policy (`/privacy`), deployed and operated independently.
   - **Application Central Gateway (`app.fbuploadpro.com` / `app.vinsmokemedia.online`)**: Hosts the primary authentication portal, providing `/login` and `/signup`.
   - **Tenant Workspaces (`{username}.fbuploadpro.com` / `{username}.vinsmokemedia.online`)**: Serves authenticated user workspaces, with session cookies scoped to root domain wildcard (`.fbuploadpro.com` / `.vinsmokemedia.online`) to enable seamless transitions from the gateway into private subdomains.
   - **Active Construction Demo Domain**: `vinsmokemedia.online` is active as the operational deployment and demo domain (`app.vinsmokemedia.online` gateway, `*.vinsmokemedia.online` tenant subdomains, `.vinsmokemedia.online` session cookies) until final production cutover.
7. **Publishing & External APIs**: Facebook Graph API v26.0 for reels, photos, and automated first-comment publishing; Cloudflare R2 for media storage. Publishing is unrestricted for all active users (`status = 'active'`) with connected Facebook Pages, with zero token ledger or credit balance checks. All billing and monetization systems are deferred.
8. **Theme Token & Design System Governance (`apps/web/src/lib/theme.ts`)**: All visual interface design, colors, hairlines, spacing, radii, typography, and shadows across `apps/web` are governed strictly by the canonical theme configuration in `apps/web/src/lib/theme.ts` and `apps/web/src/app/globals.css`, which reflect the immutable specification in `DESIGN.md`. Agents must NEVER modify or edit `DESIGN.md` (permanently frozen). Hardcoding ad-hoc hex color literals, arbitrary border definitions, custom shadows, or capsule pill badges in components is permanently prohibited; all frontend code must consume tokens directly from `@web/lib/theme` or CSS variables. Status signaling must strictly use unboxed 6px luminous dots with micro-halos (`STATUS_SIGNALS`).
9. **Professional UX Writing Standards & Public Tone Governance**: FBUploadPro is a commercial SaaS application; all user-visible copy must be professional, conversational, clear, concise, and human. Agents and engineers must NEVER expose backend plumbing, regex sanitization logic (e.g. "Dots and plus tags will be automatically stripped"), database constraints, or DevOps jargon ("isolated workspace", "gateway", "deploy workspace") on public screens. Decorative or fake "operational / server status" dots (`Ready`, `Online`, `Operational`, etc.) on login cards, signup cards, page headers, or standard forms are strictly prohibited; status dots are reserved exclusively for live entity runtime state (e.g., Facebook page connection health, publishing queue item state).

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
- **Guidance Reference**: Operational agent instructions are maintained in [.agents/AGENTS.md](../../.agents/AGENTS.md).

**Version**: 2.2.0 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-09
