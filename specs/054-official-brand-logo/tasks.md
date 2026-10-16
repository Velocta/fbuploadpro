# Implementation Tasks: Spec 054 Official Brand Logo

## Phase 1: Brand Components & Core Assets (US1 & US5)

- [x] T001 [US1] Create canonical `<BrandMark />` and `<BrandLogo />` components in `apps/web/src/components/brand/brand-logo.tsx`
- [x] T002 [US1] Export brand components from `apps/web/src/components/brand/index.ts`
- [x] T003 [US5] Create native browser web icon `apps/web/src/app/icon.svg` with 64x64 SVG vector mark
- [x] T004 [US1] Create unit test suite `apps/web/tests/ui/brand-logo.test.tsx` asserting geometry, size scaling, theme tokens, and accessibility

## Phase 2: Shell & Layout Integration (US2, US3, US4)

- [x] T005 [US2] Replace temporary triangle mark with `<BrandMark size={20} />` in `apps/web/src/components/workspace/workspace-sidebar.tsx`
- [x] T006 [US3] Replace local placeholder with `<BrandMark size={28} />` in `apps/web/src/components/auth/auth-split-layout.tsx`
- [x] T007 [US4] Replace `"FB"` text monogram with `<BrandMark size={16} />` in `apps/web/src/components/desktop/desktop-titlebar.tsx`
- [x] T008 [US4] Replace `.titlebar-monogram` with inline SVG vector in `apps/desktop/public/index.html`

## Phase 3: Test Suite Alignment & Documentation Synchronization

- [x] T009 Update `apps/web/tests/ui/workspace-sidebar.test.tsx`, `apps/web/tests/auth/auth-components.test.tsx`, and `apps/web/tests/ui/desktop-titlebar.test.tsx` for brand mark assertions
- [x] T010 Document Spec 054 in `docs/foundational-knowledge.md` under Section 20
