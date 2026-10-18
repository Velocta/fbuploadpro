# Implementation Tasks: Spec 068 Downloader Namespace Separation

**Branch**: `feat/068-downloader-namespace-separation` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Phase 1: Component Relocation (Priority: P1)

- [x] T001 [US1] Create `apps/web/src/components/downloader/media-downloader.tsx` with full Downloader UI component and updated endpoint calls to `/api/tenant/${subdomain}/downloader`
- [x] T002 [US1] Convert `apps/web/src/components/media/media-downloader.tsx` into a backward-compatible re-export from `@/components/downloader/media-downloader`
- [x] T003 [US1] Update `apps/web/src/app/tenant/[subdomain]/downloader/page.tsx` import to `@/components/downloader/media-downloader`

---

## Phase 2: API Route Relocation & Backward Compatibility (Priority: P1)

- [x] T004 [US2] Create `apps/web/src/app/api/tenant/[subdomain]/downloader/route.ts` containing the full GET and POST handlers
- [x] T005 [US2] Update `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts` as a backward-compatible re-export from `@/app/api/tenant/[subdomain]/downloader/route`

---

## Phase 3: Tests & Verification (Priority: P2)

- [x] T006 [US3] Update `apps/web/tests/ui/media-downloader.test.tsx` to import from `@/components/downloader/media-downloader` and mock `/api/tenant/[subdomain]/downloader`
- [x] T007 [US3] Update `apps/web/tests/api/media-downloader.test.ts` to test `/api/tenant/[subdomain]/downloader` and verify legacy route pass-through

---

## Phase 4: Documentation & Constitution Synchronization

- [x] T008 [P] Add Principle 32 (*Downloader Namespace & Architecture Boundary Separation*) to `.specify/memory/constitution.md`
- [x] T009 [P] Update `docs/foundational-knowledge.md` to document the dedicated Downloader namespace and endpoints
- [x] T010 Update checklists and mark completed tasks
