# Implementation Plan: Platform Audit Remediation (Spec 045)

**Branch**: `fix/045-platform-audit-remediation` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/045-platform-audit-remediation/spec.md`

## Summary

Execute a comprehensive platform audit remediation addressing all **42 documented issues** in [`issues.md`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/sync_latest_main_code/issues.md) across Facebook Accounts & BYOC OAuth, Dedicated Page & Publishing Engine, Media Library, Cloud Media Downloader, Cloudflare Worker Dispatcher, Page Insights Analytics, and Cross-Cutting Auth & UI Primitives. 

The plan scales publishing throughput to 200,000 posts/day via Cloudflare Queues fan-out, adds Graph API v26.0 publishers for all 5 formats, eliminates database buffer bloat and offset pagination drift with keyset cursors and direct R2 thumbnail uploads, activates real Upstash Redis caching, eradicates placeholder metrics and write amplification, and strictly enforces theme tokens and public UX voice standards.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 22 LTS, Cloudflare Workers V8 Isolate runtime  
**Primary Dependencies**: Next.js 16 (App Router), React 19, `@fbuploadpro/contracts`, `@supabase/supabase-js`, Zod, Cloudflare Workers, Cloudflare Queues (`PUBLISH_QUEUE`), Cloudflare R2  
**Storage**: Supabase PostgreSQL (`public.queue_items`, `public.facebook_pages`, `public.facebook_accounts`, `public.media_items`, `public.page_queue_slots`, `public.page_insights_daily_snapshots`), Upstash Redis REST API, Cloudflare R2 object storage  
**Testing**: Vitest 3.x, React Testing Library, MSW  
**Target Platform**: Vercel Serverless (Next.js 16 frontend & API routes), Cloudflare Workers (edge publishing engine & downloader)  
**Project Type**: Monorepo Web Application, Edge Worker, Shared Contracts  
**Performance Goals**: 
- Scale publishing throughput from 14,400 to $\ge 200,000$ posts/day.
- Media Library cursor pagination $O(1)$ index time for 10,000+ items.
- Real Upstash Redis cache hits $< 50\text{ms}$.
- Downloader pre-stream validation preventing V8 isolate OOM crashes.
**Constraints**: 
- Absolute immutability of `DESIGN.md`.
- Strict theme token authority via `apps/web/src/lib/theme.ts`.
- Zero capsule pill badges; unboxed 6px dots with micro-halos for status indicators.
- Pure PostgREST execution (zero raw SQL `db.query` or `isLegacyClient` branches).
- Zero local builds/tests run by agent; verification offloaded to remote GitHub Actions CI.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle 1 (Spec-Driven Development)**: Comprehensive artifacts maintained in `specs/045-platform-audit-remediation/`.
- [x] **Principle 2 (Strict Theme Token Authority)**: All UI components reference `apps/web/src/lib/theme.ts`. `status-dot.tsx` uses `STATUS_SIGNALS` with zero hardcoded hex literals.
- [x] **Principle 3 (Absolute Immutability of DESIGN.md)**: No modifications or overwrites to `DESIGN.md`.
- [x] **Principle 4 (Pure PostgREST Route Execution)**: All legacy `db.query(...)` and `isLegacyClient` branches removed in favor of typed `@supabase/supabase-js`.
- [x] **Principle 5 (Zero Technical Plumbing Leaks & Public UX Voice)**: Errors sanitized via `sanitizeAuthErrorMessage`; public SaaS copy used everywhere.
- [x] **Principle 6 (Elimination of Local Builds / Remote CI Gate)**: No local `pnpm turbo build/test` or `cargo check` executed; remote GitHub Actions CI verifies all changes on PR creation.
- [x] **Principle 7 (Versioned Forward Migrations Only)**: All database schema modifications written to `supabase/migrations/20261018000000_platform_audit_remediation.sql`. No Supabase MCP mutations.
- [x] **Principle 8 (Single Combined PR Protocol)**: Code, migrations, documentation, and specs committed together in one atomic PR.

## Project Structure

### Documentation (this feature)

```text
specs/045-platform-audit-remediation/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Architecture decisions & resolutions
├── data-model.md        # Database schema, constraints & stored procedures
├── quickstart.md        # Verification guide & test flows
├── contracts/           # API contracts & Zod schemas
│   └── platform-audit-contracts.md
├── checklists/          # Requirements & quality checklists
│   └── requirements.md
└── tasks.md             # Sequenced task checklist
```

### Source Code Touched

```text
supabase/migrations/
└── 20261018000000_platform_audit_remediation.sql      # Schema upgrades & atomic RPCs

packages/contracts/
├── src/crypto/token.ts                                 # Master key runtime guard
├── src/domain/queue.ts                                 # 5-format post schemas & constraints
├── src/domain/media.ts                                 # Format eligibility & keyset pagination
├── src/domain/facebook.ts                              # Canonical evaluateGraphApiError
└── tests/                                              # Contracts unit tests

apps/worker/
├── src/dispatcher.ts                                   # Partitioned claims & pacing
├── src/fb-client.ts                                    # Graph API v26.0 publishers
├── src/index.ts                                        # Queue fan-out & downloader endpoints
├── src/insights-sync.ts                                # Paginated insights sync
├── src/services/downloader-engine.ts                   # Pre-stream HEAD & TransformStream abort
└── src/settlement.ts                                   # Atomic settle_queue_item_outcome RPC

apps/web/
├── src/app/api/auth/facebook/route.ts                  # Sanitized error boundary
├── src/app/api/auth/forgot-password/route.ts           # Corrected public reset copy
├── src/app/api/tenant/[subdomain]/media/check-duplicates/route.ts # Server duplicate check
├── src/app/api/tenant/[subdomain]/media/route.ts       # Keyset pagination handler
├── src/app/api/tenant/[subdomain]/pages/route.ts       # Elimination of write amplification
├── src/app/api/tenant/[subdomain]/publishing/queue/route.ts # Aggregated status counts
├── src/components/accounts/account-card.tsx            # Token health countdown & CTA
├── src/components/media/media-library-explorer.tsx     # Keyset pagination & R2 WebP thumbnails
├── src/components/pages/dedicated/tab-dashboard.tsx    # 5-format publishing UI
├── src/components/pages/dedicated/tab-insights.tsx     # Dual-series chart & skeleton loader
├── src/components/pages/dedicated/tab-queue.tsx        # Format badges & skipped/cancelled tabs
├── src/components/ui/status-dot.tsx                    # Strict theme tokens (no hex literals)
├── src/components/workspace/workspace-lifecycle-guard.tsx # StrictMode fetch restoration guard
├── src/lib/insights/insights-cache.ts                  # Real Upstash Redis REST caching
├── src/lib/rbac.ts                                     # Empathetic permission denial copy
└── src/lib/route-auth.ts                               # Removal of legacy db.query branches

docs/
└── foundational-knowledge.md                           # Updated architectural documentation
```

## Structure Decision

Monorepo-wide updates spanning database migrations, shared contracts, Cloudflare Worker edge backend, Next.js 16 web application, and foundational documentation.
