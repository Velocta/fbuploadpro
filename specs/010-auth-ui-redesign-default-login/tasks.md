# Tasks: Professional Auth UI/UX Redesign & Default Login Page

**Input**: Design documents from `specs/010-auth-ui-redesign-default-login/`

**Prerequisites**: `spec.md`, `plan.md`, `checklists/requirements.md`

---

## Phase 1: Foundational Components (Shared Infrastructure)

**Purpose**: Build reusable UI components needed by the redesigned authentication views.

- [x] T001 [Foundational] Create `PasswordInput` component with show/hide password toggle in `apps/web/src/components/auth/password-input.tsx`
- [x] T002 [Foundational] Create `AuthSplitLayout` component featuring brand showcase, feature highlights, and responsive container in `apps/web/src/components/auth/auth-split-layout.tsx`

---

## Phase 2: User Story 1 (Priority: P1) 🎯 MVP - Default Root Navigation to Login

**Purpose**: Eliminate the placeholder landing card and make `/login` the default page on root (`/`).

- [x] T003 [P1] [US1] Replace placeholder landing card in `apps/web/src/app/page.tsx` with server-side `redirect('/login')`
- [x] T004 [P1] [US1] Verify and align `apps/web/src/middleware.ts` for root request handling to direct unauthenticated visitors to `/login`
- [x] T005 [P1] [US1] Add unit test asserting root page redirects to `/login` in `apps/web/tests/auth/root-redirect.test.tsx`

---

## Phase 3: User Story 2 (Priority: P2) - Professional Split-Screen Login Experience

**Purpose**: Remake `/login` into a high-craft split-screen authentication portal.

- [x] T006 [P2] [US2] Redesign `apps/web/src/app/login/page.tsx` using `AuthSplitLayout`, `PasswordInput`, and Spec 008 primitives
- [x] T007 [P2] [US2] Wire up error state handling with accessible `Alert`, loading indicator on submit button, and `returnUrl` preservation in `apps/web/src/app/login/page.tsx`

---

## Phase 4: User Story 3 (Priority: P3) - Professional Split-Screen Sign Up Experience

**Purpose**: Remake `/signup` into the matching split-screen layout, removing the subdomain preview badge.

- [x] T008 [P3] [US3] Redesign `apps/web/src/app/signup/page.tsx` using `AuthSplitLayout` and `PasswordInput`, removing the subdomain preview box
- [x] T009 [P3] [US3] Wire up form validation, error alert banner, submit button loading state, and redirection to tenant dashboard in `apps/web/src/app/signup/page.tsx`

---

## Phase 5: Verification & Quality Gates

**Purpose**: Ensure 100% test pass rate, strict lint/type compliance, and clean build.

- [x] T010 [QA] Add unit and component tests for `AuthSplitLayout` and `PasswordInput` in `apps/web/tests/auth/auth-components.test.tsx`
- [x] T011 [QA] Execute `pnpm turbo run build lint typecheck test` and ensure all quality gates pass with zero errors
