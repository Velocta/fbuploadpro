# Implementation Plan: Cloudflare Asynchronous Media Downloader

**Branch**: `feat/043-cloudflare-async-media-downloader` | **Date**: 2026-10-15 | **Spec**: [specs/043-cloudflare-async-media-downloader/spec.md](spec.md)

**Input**: Feature specification from `specs/043-cloudflare-async-media-downloader/spec.md`

## Summary

Migrate the Cloud Media Downloader from its synchronous Vercel serverless execution to an **Asynchronous Edge Job Queue** executing on **Cloudflare Workers** (`apps/worker`), streaming directly into **Cloudflare R2** with zero egress fees, using **Supabase PostgreSQL** for job state persistence and real-time status synchronization to the Next.js frontend (`apps/web`).

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 22 LTS, Cloudflare Workers V8 Isolate runtime  
**Primary Dependencies**: Cloudflare Workers runtime, `@fbuploadpro/contracts`, `@supabase/supabase-js`, Zod, Next.js 16, React 19  
**Storage**: Cloudflare R2 (S3-compatible Object Storage for media assets), Supabase PostgreSQL (`media_download_jobs`, `media_items`, `user_storage_quotas`)  
**Testing**: Vitest 3.x, MSW, mocked Fetch / R2 bindings  
**Target Platform**: Cloudflare Edge Workers + Vercel Next.js 16 Web App  
**Project Type**: Edge API service + Web Application  
**Performance Goals**: Enqueue response < 100ms; continuous streaming up to 500 MB without timeout; 0% Vercel compute bandwidth consumption  
**Constraints**: Zero local builds/tests run by agent; zero modification to `DESIGN.md`; all styling strictly from `@web/lib/theme` and `globals.css`; no Supabase MCP schema mutations  
**Scale/Scope**: Support 500 MB media files, concurrent asynchronous edge streaming, multi-tenant compound isolation by `user_id`  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle 1 (Spec-Driven Development)**: Full SpecKit workflow (spec -> plan -> tasks -> implement -> converge -> PR).
- [x] **Principle 2 (Thin Client / Fat Edge IP Isolation)**: All heavy media extraction, streaming, and R2 uploads run in `apps/worker` edge runtime.
- [x] **Principle 3 (Zero Local Builds / Remote CI Gate)**: Agent does not run local turbo/cargo builds; all verification runs via GitHub Actions CI on PR.
- [x] **Principle 4 (Strict Theme & Design System Authority)**: No arbitrary colors or capsule pill badges; only theme tokens from `@web/lib/theme`. `DESIGN.md` remains strictly untouched.
- [x] **Principle 5 (Versioned Forward Migrations Only)**: All schema changes are written to `supabase/migrations/` as versioned `.sql` files. No Supabase MCP schema mutation.
- [x] **Principle 6 (Single Combined PR Protocol)**: Code, specs, and docs are committed together in the same PR.

## Project Structure

### Documentation (this feature)

```text
specs/043-cloudflare-async-media-downloader/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Technical research & decisions
├── data-model.md        # Database schema & job state machine
├── quickstart.md        # Verification and API testing guide
├── contracts/           # API contracts for job queue & progress
├── checklists/          # Verification checklists
└── tasks.md             # Dependency-ordered task list
```

### Source Code Touched

```text
supabase/migrations/
└── 20261017000000_media_download_jobs.sql           # Job tracking table, enums, RLS

packages/contracts/
├── src/domain/downloader.ts                         # Schemas, types, SSRF edge validation
└── tests/downloader-contracts.test.ts               # Contract tests

apps/worker/
├── src/index.ts                                     # Downloader endpoints (/enqueue, /jobs/:id)
├── src/services/downloader-engine.ts                # Edge TransformStream R2 ingestion engine
└── tests/downloader-worker.test.ts                  # Worker unit & integration tests

apps/web/
├── src/app/api/tenant/[subdomain]/media/downloader/route.ts # Web API proxy/delegation
├── src/components/media/CloudDownloaderModal.tsx    # Asynchronous non-blocking modal UI
└── src/components/media/MediaLibraryView.tsx        # Auto-refresh & background job indicators
```

## Implementation Phases

- **Phase 0**: Research & architecture decisions (`research.md`).
- **Phase 1**: Data model (`data-model.md`), contracts (`contracts/`), and quickstart (`quickstart.md`).
- **Phase 2**: Quality checklists (`checklists/`).
- **Phase 3**: Task decomposition (`tasks.md`).
- **Phase 4**: Single-agent execution (`speckit-implement`).
- **Phase 5**: Convergence audit (`speckit-converge`).
- **Phase 6**: Branch push & PR creation (`gh pr create`).
