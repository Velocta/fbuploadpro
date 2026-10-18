# Tasks: Vercel Web Analytics Integration

**Branch**: `feat/067-vercel-analytics-integration` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Dependency Setup
- [x] T001 Install `@vercel/analytics` into `apps/web/package.json` using pnpm

## Phase 2: User Story 1 & 2 - Layout Integration & Next.js App Router Compliance (Priority: P1)
- [x] T002 [US1/US2] Import `{ Analytics }` from `@vercel/analytics/next` in `apps/web/src/app/layout.tsx`
- [x] T003 [US1/US2] Mount `<Analytics />` within `<body>` of `apps/web/src/app/layout.tsx`
- [x] T004 [US1/US2] Add unit test suite in `apps/web/tests/ui/root-layout-analytics.test.tsx` verifying `RootLayout` renders `<Analytics />` cleanly

## Phase 3: Documentation & Knowledge Synchronization
- [x] T005 Update `docs/foundational-knowledge.md` to document the Vercel Analytics telemetry integration
