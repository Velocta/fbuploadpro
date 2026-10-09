# Tasks: Auth UX Refinement, Inline Error Highlighting & Edge-Case Hygiene (Spec 016)

**Input**: Design documents from `specs/016-auth-ux-refinement-inline-errors-and-edge-cases/`  
**Prerequisites**: `spec.md`, `plan.md`, `checklists/requirements.md`

---

## Phase 1: Contracts & Phone Validation Helpers (Priority: P1) 🎯 MVP

- [x] T001 [P1] [US2] Implement `validateClientPhoneNumber` in `packages/contracts/src/domain/auth.ts` handling `asdf`, `+32433`, empty, non-digit inputs, and valid E.164 formats, with tests in `packages/contracts/tests/auth-hardening.test.ts`.

---

## Phase 2: UI Components & Password Strength Meter Removal (Priority: P1) 🎯 MVP

- [x] T002 [P1] [US5] Create `<FormErrorCallout>` component in `apps/web/src/components/auth/form-error-callout.tsx` adhering to theme tokens (`PALETTE.accent3`, `RADII.sm`).
- [x] T003 [P1] [US4] Remove `<PasswordStrengthMeter>` component usage from `apps/web/src/app/signup/page.tsx` and export from auth index.

---

## Phase 3: Signup Page UX & Edge-Case Refactoring (Priority: P1) 🎯 MVP

- [x] T004 [P1] [US1, US2, US3, US6] Refactor `apps/web/src/app/signup/page.tsx`:
  - Replace top `<Alert severity="error">` with field-level inline error states (`name`, `phone`, `email`, `password`, `confirmPassword`).
  - Wire client-side `validateClientPhoneNumber` to highlight phone field in red for `asdf`, `+32433`, etc.
  - Wire hybrid live error clearing on `onChange`.
  - Wire server 400 `details` error unpacking to field states.
  - Render `<FormErrorCallout>` directly above the submit button for general errors (e.g., rate limits, network errors).

---

## Phase 4: Login, Forgot Password & Reset Password Refactoring (Priority: P1) 🎯 MVP

- [x] T005 [P1] [US1, US5, US6] Refactor `apps/web/src/app/login/page.tsx`:
  - Add inline error highlighting on email and password inputs.
  - Wire hybrid live error clearing on `onChange`.
  - Render compact `<FormErrorCallout>` above "Sign In" button for invalid credentials, rate limits, or network errors.
- [x] T006 [P1] [US1, US5, US6] Refactor `apps/web/src/app/forgot-password/page.tsx`:
  - Add inline error highlighting on email input.
  - Wire hybrid live error clearing on `onChange`.
  - Render compact `<FormErrorCallout>` above "Send Recovery Link" button.
- [x] T007 [P1] [US1, US5, US6] Refactor `apps/web/src/app/reset-password/page.tsx`:
  - Add inline error highlighting on password and confirmPassword inputs.
  - Render password mismatch error directly under confirmPassword input.
  - Wire hybrid live error clearing on `onChange`.
  - Render compact `<FormErrorCallout>` above "Update Password" button.

---

## Phase 5: Automated Testing & Edge-Case Coverage (Priority: P2)

- [x] T008 [P2] [US1-US6] Create comprehensive component test suite in `apps/web/tests/auth/auth-inline-errors.test.tsx` verifying inline error highlights on invalid inputs, phone edge cases (`asdf`, `+32433`), absence of top alert dialogue, live clearing on keystroke, and removal of `PasswordStrengthMeter`.
- [x] T009 [P2] [Regression] Update existing auth tests in `apps/web/tests/auth/` and `apps/web/tests/components/auth-pages.test.tsx` to align with the refined inline error interface.

---

## Phase 6: Quality Gates & Verification (Priority: P3)

- [x] T010 [P3] [QA] Run full monorepo verification: `pnpm turbo run build lint typecheck test` ensuring 100% pass rate with 0 errors.
- [x] T011 [P3] [Docs] Update documentation in `docs/foundational-knowledge.md` reflecting auth inline validation and UI craft standards.
