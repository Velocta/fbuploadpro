# Tasks: Password Reset & Recovery Flow

**Input**: Design documents from `specs/011-password-reset-recovery-flow/`

**Prerequisites**: `spec.md`, `plan.md`, `checklists/requirements.md`

---

## Phase 1: Foundational & Service Helpers (Shared Infrastructure)

**Purpose**: Add backend recovery helpers to Supabase Auth library and API endpoints.

- [x] T001 [Foundational] Add `requestPasswordReset` and `resetUserPassword` helpers in `apps/web/src/lib/supabase-auth.ts`
- [x] T002 [Foundational] Implement `POST /api/auth/forgot-password` endpoint in `apps/web/src/app/api/auth/forgot-password/route.ts`
- [x] T003 [Foundational] Implement `POST /api/auth/reset-password` endpoint in `apps/web/src/app/api/auth/reset-password/route.ts`

---

## Phase 2: User Story 1 (Priority: P1) 🎯 MVP - Password Recovery Request & Login Link

**Purpose**: Place the recovery entry point on `/login` and build the `/forgot-password` page.

- [x] T004 [P1] [US1] Add "Forgot password?" link directly above the password field on `apps/web/src/app/login/page.tsx`
- [x] T005 [P1] [US1] Create `/forgot-password` page with `AuthSplitLayout`, email form, loading state, and success confirmation in `apps/web/src/app/forgot-password/page.tsx`
- [x] T006 [P1] [US1] Add unit tests for forgot-password view and API in `apps/web/tests/auth/forgot-password.test.tsx`

---

## Phase 3: User Story 2 (Priority: P2) - Set New Password Page

**Purpose**: Build the `/reset-password` page for completing credential recovery.

- [x] T007 [P2] [US2] Create `/reset-password` page with `AuthSplitLayout`, new password & confirm password inputs in `apps/web/src/app/reset-password/page.tsx`
- [x] T008 [P2] [US2] Wire client validation (password match, minimum 8 characters), alert error handling, and redirection to `/login`
- [x] T009 [P2] [US2] Add unit tests for reset-password view and API in `apps/web/tests/auth/reset-password.test.tsx`

---

## Phase 4: Verification & Quality Gates

**Purpose**: Verify all tests and quality gates pass with zero errors.

- [x] T010 [QA] Execute `pnpm turbo run build lint typecheck test` and ensure all quality gates pass with 0 errors
