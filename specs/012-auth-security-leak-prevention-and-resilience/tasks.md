# Tasks: Auth Security Leak Prevention & Fault-Tolerant Resilience (Spec 012)

**Input**: Design documents from `specs/012-auth-security-leak-prevention-and-resilience/`  
**Prerequisites**: `spec.md`, `plan.md`, `checklists/requirements.md`

---

## Phase 1: Foundational Error Sanitization & Utilities

**Purpose**: Create centralized server & client sanitizers that scrub technical plumbing tokens.

- [x] T001 [Foundational] Implement `formatAuthErrorResponse` and `sanitizeAuthErrorMessage` in `apps/web/src/lib/auth-errors.ts`
- [x] T002 [Foundational] Add unit tests for sanitizer utility in `apps/web/tests/auth/auth-error-sanitization.test.ts`

---

## Phase 2: Resilient Auth Services & API Endpoints (Priority: P1) 🎯 MVP

**Purpose**: Query Supabase PostgREST over HTTPS when configured, and guard all auth API routes.

- [x] T003 [P1] [US2] Update `apps/web/src/lib/supabase-auth.ts` to query `users` and `user_storage_quotas` via Supabase client with safe fallback
- [x] T004 [P1] [US1] Refactor `/api/auth/login`, `/api/auth/signup`, `/api/auth/forgot-password`, and `/api/auth/reset-password` to route all caught errors through `formatAuthErrorResponse`

---

## Phase 3: Client-Side Defensive Boundary (Priority: P2)

**Purpose**: Defensively sanitize all error messages before rendering in UI forms.

- [x] T005 [P2] [US3] Integrate `sanitizeAuthErrorMessage` into `apps/web/src/app/login/page.tsx` and `apps/web/src/app/signup/page.tsx`
- [x] T006 [P2] [US3] Integrate `sanitizeAuthErrorMessage` into `apps/web/src/app/forgot-password/page.tsx` and `apps/web/src/app/reset-password/page.tsx`

---

## Phase 4: Integration Testing & Quality Gate (Priority: P3)

**Purpose**: Rigorously test error masking under connection failure conditions and verify zero regressions.

- [x] T007 [P3] [QA] Add integration test suite asserting zero leak of `ECONNREFUSED` or `127.0.0.1` under simulated database outages in `apps/web/tests/auth/auth-resilience.test.tsx`
- [x] T008 [QA] Execute `pnpm turbo run build lint typecheck test` and ensure 100% test pass rate with 0 errors
