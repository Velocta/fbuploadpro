# Implementation Tasks: Spec 022 — Left-Aligned Authentication Split Layout Architecture

**Branch**: `feat/spec-022-left-aligned-auth-layout`  
**Spec Directory**: `specs/022-left-aligned-auth-split-layout`  
**Constitution Reference**: FBUploadPro Constitution v2.11.0 (Principle 16)  

---

## Phase 1: Foundational Enhancements (AuthSplitLayout Component)

- [x] T001 [P] [Foundational] Update `apps/web/src/components/auth/auth-split-layout.tsx` to support `formPosition?: 'left' | 'right'` (default `'left'`), re-ordering DOM elements and applying appropriate styling (`.auth-showcase-right`, `border-left`, and right-quadrant radial gradient).
- [x] T002 [Foundational] Update `apps/web/tests/auth/auth-components.test.tsx` with component test assertions for default left-form alignment, DOM hierarchy, and optional right-form alignment.

---

## Phase 2: Page Integration & Verification (All Auth Routes)

- [x] T003 [P] [Pages] Verify `/login`, `/signup`, `/forgot-password`, and `/reset-password` render with left-aligned forms and test mobile responsive breakpoint (<1024px).

---

## Phase 3: Quality Gates, Docs Synchronization & Delivery

- [x] T004 Run `pnpm turbo run build lint typecheck test` to ensure 100% green tests and zero errors.
- [x] T005 Synchronize documentation: update roadmap in `docs/foundational-knowledge.md` for Spec 022 in the SAME pull request.
- [x] T006 Commit changes atomically, push feature branch, create PR, and surface Vercel preview link for user approval.
