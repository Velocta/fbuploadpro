# Tasks: Browser Tab Favicon & Platform Metadata Realignment

**Branch**: `fix/065-browser-tab-favicon-and-metadata` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup & Foundational
- [x] T001 Initialize public asset directory `apps/web/public` for root-level static fallbacks
- [x] T002 Generate high-fidelity multi-resolution `favicon.ico` matching canonical FBUploadPro brand geometry

## Phase 2: User Story 1 - Multi-Tenant Browser Tab Icon Display (Priority: P1)
- [x] T003 [US1] Exempt metadata routes (`/icon`, `/apple-icon`, `/favicon.ico`, `*.ico`) from Edge middleware matcher in `apps/web/src/middleware.ts`
- [x] T004 [US1] Add early return bypass for metadata routes in `apps/web/src/middleware.ts` to prevent tenant rewriting or 307 login redirects
- [x] T005 [US1] Add unit tests in `apps/web/tests/middleware/middleware-routing.test.ts` verifying `/icon`, `/favicon.ico`, and `/apple-icon` bypass tenant rewriting on subdomains

## Phase 3: User Story 2 - Universal Browser Icon Compatibility & Fallbacks (Priority: P1)
- [x] T006 [US2] Install `favicon.ico` at `apps/web/src/app/favicon.ico` and `apps/web/public/favicon.ico`
- [x] T007 [US2] Copy canonical `apps/web/src/app/icon.svg` to `apps/web/public/icon.svg`
- [x] T008 [US2] Explicitly declare `icons` in `apps/web/src/app/layout.tsx` linking vector SVG and ICO formats

## Phase 4: User Story 3 - Public Platform Description Realignment (Priority: P2)
- [x] T009 [US3] Update metadata `description` in `apps/web/src/app/layout.tsx` to `"publishing automation platform"`

## Phase 5: Documentation & Knowledge Synchronization
- [x] T010 Synchronize `docs/foundational-knowledge.md` with Spec 065 brand metadata delivery standards

