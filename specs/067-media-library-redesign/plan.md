# Implementation Plan: Media Library Layout, View Modes & Import Flow Redesign

**Branch**: `feat/067-media-library-redesign` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/067-media-library-redesign/spec.md`

## Summary

Redesign the Media Library (`/tenant/[subdomain]/media`, component `MediaLibraryExplorer` and associated child components) in FBUploadPro Studio. Transform the interface into a borderless, unboxed canvas utilizing spacing and single hairline dividers; implement a 2-step staging and 3-concurrency upload engine with leave-page protection; convert subfolders into compact row lists with hover actions; enhance Grid and Table views with visible upload dates and merged detail metrics while removing Schedule CTAs and Facebook eligibility tags; introduce a floating batch pill with replace/append caption modal; build a centered 2-column preview studio modal; and remediate dropdown click, thumbnail fallback, and search synchronization bugs.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), React 19, Next.js 16 App Router
**Primary Dependencies**: Lucide React (icons), Radix UI / headless primitives, Tailwind CSS v4 / theme tokens (`@web/lib/theme`), `@fbuploadpro/contracts`
**Storage**: Cloudflare R2 object storage via presigned PUT URLs, Supabase PostgreSQL substrate (`media_items`, `media_folders`)
**Testing**: Vitest / Playwright component and end-to-end user journey tests
**Target Platform**: Desktop and tablet browsers (Chromium, Firefox, WebKit / Safari)
**Project Type**: Monorepo Web Application (`apps/web`)
**Performance Goals**:
- Live search debounced at 250ms with sub-16ms UI frame budget
- Staged upload queue supporting 100+ files with strict 3-concurrency limit
- Hover video preview playback within 300ms
**Constraints**:
- Strict theme token compliance (`apps/web/src/lib/theme.ts` & `globals.css`)
- Absolute immutability of `DESIGN.md` (0 modifications)
- Zero "box-in-box" nested borders
- Zero raw builds/tests locally (verification offloaded to GitHub Actions CI upon PR)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Requirement | Status |
| :--- | :--- | :--- |
| **I. SDD Single Source of Truth** | All changes rooted in `specs/067-media-library-redesign/spec.md` and decomposed in `tasks.md`. | **PASS** |
| **II. Modular Architecture** | Clean boundary between frontend web (`apps/web`) and shared contracts (`@fbuploadpro/contracts`). | **PASS** |
| **III. Multi-Tenant Data Isolation** | All media queries and operations scoped strictly by `user_id` / authenticated session. | **PASS** |
| **IV. Zero-Trust Validation** | Payloads and schemas validated with Zod contracts. | **PASS** |
| **V. Linear Git Hygiene** | Feature branch `feat/067-media-library-redesign` opened; CI gate enforced. | **PASS** |
| **Theme & Design Standards** | 0 hex literals, 0 capsule pills (`RADII.xs` strictly), no changes to `DESIGN.md`. | **PASS** |
| **UX Writing Standards** | Plain language copy, zero technical plumbing leaks, zero mock status dots. | **PASS** |
| **Downloader Separation** | Zero Downloader UI in `/media`; independent `/downloader` page unchanged. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/067-media-library-redesign/
├── spec.md                  # Feature specification
├── plan.md                  # This implementation plan
├── research.md              # Research & technical decisions
├── data-model.md            # Client-side state & entity models
├── quickstart.md            # Verification & walkthrough guide
├── contracts/               # Component prop contracts and schemas
└── tasks.md                 # Decomposed implementation tasks
```

### Source Code (`apps/web/src/components/media/`)

```text
apps/web/src/components/media/
├── media-library-explorer.tsx      # Main layout orchestrator (header, flat toolbar, breadcrumb context row, subfolders list, view switcher, drag-and-drop)
├── media-asset-card.tsx            # Borderless grid thumbnail tile (metadata underneath, hover checkbox, aspect badge, 300ms hover video, hover preview/menu)
├── media-table-row.tsx             # Hairline table row (sticky header, merged details column, upload date, actions, click-to-edit caption)
├── batch-action-bar.tsx            # Floating bottom pill ('n selected · Move · Set caption · Delete · Clear')
├── batch-set-caption-modal.tsx     # Modal for bulk captioning (Replace vs. Append modes, character counter)
├── media-import-modal.tsx          # 2-step Import Media popup (staging validation, duplicate detection, 3-concurrency upload queue, pause/resume/cancel)
├── media-preview-modal.tsx         # 2-column studio inspector (player/full image + frame capture, metadata rows, name/caption edit, delete/save)
├── new-folder-modal.tsx            # Centered new folder dialog with autofocus, parent folder selector, inline duplicate warning
└── leave-page-guard-dialog.tsx     # Intercept dialog for active upload navigation protection
```
