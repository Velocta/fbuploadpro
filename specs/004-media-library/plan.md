# Implementation Plan: Dedicated User Media Library & Cloudflare R2 Uploads

**Branch**: `feat/004-media-library-plan` | **Date**: 2026-10-07 | **Spec**: [specs/004-media-library/spec.md](spec.md)

**Input**: Feature specification from `/specs/004-media-library/spec.md`

## Summary

Implement an isolated, dedicated Media Library per user workspace supporting direct-from-PC uploads of short-form videos and images directly to Cloudflare R2 via presigned `PUT` URLs. Enforce a 5 GB default baseline storage quota with two-phase reservation and atomic accounting. Support custom organizational folders with non-destructive deletion (`ON DELETE SET NULL`), multi-tag taxonomy with JSONB indexing, client-side metadata and thumbnail extraction (HTML5 Canvas/Video), a reusable copywriting caption templates vault, full-screen playback/inspection modals, and safe asset purging with instant quota reclamation. Deliver an interactive React 19 / Next.js 16 UI at `/tenant/[subdomain]/media`.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode across all packages: `"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`)

**Primary Dependencies**: Next.js 16 (App Router), React 19, Zod (runtime boundary validation schemas in `@fbuploadpro/contracts`), `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (Cloudflare R2 S3-compatible presigned URL generation and object lifecycle)

**Storage**: PostgreSQL (`media_items`, `media_folders`, `caption_templates`, `user_storage_quotas`) via forward DDL migration `0003_media_library.sql`, and Cloudflare R2 object storage for media files and thumbnail previews

**Testing**: Vitest (`@fbuploadpro/contracts`, `@fbuploadpro/database`, `@fbuploadpro/web`)

**Target Platform**: Next.js App Router (Node.js runtime & Edge middleware runtime) and Cloudflare R2 object storage

**Project Type**: Web Application, Multi-Tenant Database Substrate, Shared Contracts & Object Storage Service

**Performance Goals**: Direct client-to-R2 upload bypasses web servers 100%; presigned upload URL generation in <50ms; media filtering over 500+ items in <200ms; quota check in <5ms

**Constraints**: Zero heavy media streaming through Next.js servers; Strict composite tenant isolation `(user_id, folder_id)`; Non-destructive folder deletion (`ON DELETE SET NULL`); Real-time storage quota enforcement (5 GB default); Clean decoupling via `IStorageService` allowing offline mock execution in CI

**Scale/Scope**: Dedicated per-user media library supporting hundreds of video/image assets per creator, vertical 9:16 Reels, and campaign-level tagging

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I: Spec-Driven Development (SDD) as Single Source of Truth**: Approved specification at `specs/004-media-library/spec.md`. TDD approach enforced with test tasks planned before implementation code.
- [x] **Principle II: Modular Architecture & Strict Service Boundary Isolation**: Zero Node.js TCP socket or stream dependencies in edge runtimes. Abstract `IStorageService` in `@fbuploadpro/contracts` decouples Cloudflare R2 operations. Heavy media payloads stream directly from browser to R2 via presigned URLs without routing through Next.js web application servers.
- [x] **Principle III: Multi-Tenant Defense-in-Depth & Data Isolation**: Tenant ownership is verified on all media operations (`user_id`). Composite foreign keys `(user_id, folder_id)` and `(user_id, caption_template_id)` prevent cross-tenant asset associations. Storage paths are isolated via `users/${userId}/...` key namespaces.
- [x] **Principle IV: Zero-Trust Boundary Validation & Sanitization**: All upload parameters, metadata confirmations, folder modifications, and caption templates are validated with strict Zod schemas. R2 secret access keys never leave server environment variables.
- [x] **Principle V: Atomic PRs & Linear Git Hygiene**: All tasks decomposed into atomic increments (<150–200 LoC each) delivered via dedicated PRs referencing GitHub Issues.

## Project Structure

### Documentation (this feature)

```text
specs/004-media-library/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Architectural decisions & research
├── data-model.md        # Entities, DDL migration & state transitions
├── quickstart.md        # Validation commands & test scenarios
├── contracts/           # Interface contracts
│   ├── media.md         # Upload, confirm, list, filter & purge contracts
│   ├── folders.md       # Custom folders API contracts
│   ├── captions.md      # Caption templates vault contracts
│   └── storage.md       # IStorageService & storage quota contracts
└── checklists/          # Requirements & quality checklists
    └── requirements.md  # Quality validation checklist
```

### Source Code

```text
packages/contracts/
├── src/
│   ├── domain/
│   │   ├── media.ts      # MediaItem, UploadUrl, ConfirmUpload schemas
│   │   ├── folder.ts     # MediaFolder schemas
│   │   ├── caption.ts    # CaptionTemplate schemas
│   │   └── storage.ts    # StorageQuota & IStorageService interface
│   └── index.ts
└── tests/
    └── media-contracts.test.ts # Zod schema validation tests

packages/database/
├── migrations/
│   └── 0003_media_library.sql  # DDL migration for media, folders, captions & quotas
└── tests/
    └── media-library.test.ts   # Multi-tenant isolation & non-destructive delete tests

apps/web/
├── src/
│   ├── lib/
│   │   └── storage.ts          # R2StorageProvider & MockStorageProvider factory
│   ├── app/
│   │   ├── api/tenant/[subdomain]/media/
│   │   │   ├── route.ts                 # List media items (filters, tags, pagination)
│   │   │   ├── upload-url/route.ts      # Generate presigned R2 upload URLs
│   │   │   ├── confirm/route.ts         # Confirm upload & commit storage quota
│   │   │   ├── quota/route.ts           # Get user storage quota utilization
│   │   │   ├── folders/
│   │   │   │   ├── route.ts             # List & create folders
│   │   │   │   └── [folderId]/route.ts  # Update & non-destructively delete folder
│   │   │   ├── captions/
│   │   │   │   ├── route.ts             # List & create caption templates
│   │   │   │   └── [captionId]/route.ts # Update & delete caption template
│   │   │   └── [mediaId]/route.ts       # Get, update & purge media item
│   │   └── tenant/[subdomain]/
│   │       └── media/
│   │           └── page.tsx             # Interactive Media Library UI
│   └── components/
│       └── media/
│           ├── storage-meter.tsx        # Storage quota meter bar & stats
│           ├── upload-modal.tsx         # Drag-and-drop file upload & progress
│           ├── folder-sidebar.tsx       # Folder navigation tree & tag badges
│           ├── media-grid.tsx           # Asset grid with thumbnails & badges
│           ├── media-preview-modal.tsx  # Video player & technical inspector
│           └── caption-modal.tsx        # Caption template manager modal
└── tests/
    ├── storage-service.test.ts          # Storage provider unit tests
    ├── media-upload-flow.test.ts        # Presigned upload & confirm integration tests
    ├── folders-api.test.ts              # Folder non-destructive delete tests
    └── captions-api.test.ts             # Caption templates CRUD tests
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | All designs adhere strictly to constitutional constraints and modular boundaries. | N/A |
