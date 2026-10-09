# Tasks: Spec 018 - 6-Digit OTP Password Reset Flow

**Feature**: `specs/018-password-reset-otp-flow`  
**Branch**: `feat/018-password-reset-otp-flow`  
**Status**: Ready for Implementation  

---

## Phase 1: Setup & Contracts

**Purpose**: Define data contracts and shared types in `@fbuploadpro/contracts`

- [x] T001 [P] [Contracts] Define `ForgotPasswordRequestSchema`, `ResetPasswordOtpRequestSchema`, and response types in `packages/contracts/src/domain/auth.ts`
- [x] T002 [Contracts] Export new OTP schemas and types in `packages/contracts/src/index.ts`

---

## Phase 2: Foundational (Backend Services & Templates)

**Purpose**: Implement OTP management, email templating, and password mutation logic

- [x] T003 [P] [Backend] Implement `createPasswordResetOtp`, `verifyPasswordResetOtp`, `resendPasswordResetOtp`, and memory cleanup in `apps/web/src/lib/otp-service.ts`
- [x] T004 [P] [Backend] Implement `sendPasswordResetOtpEmail` with dedicated HTML and plaintext templates in `apps/web/src/lib/email-service.ts`
- [x] T005 [Backend] Implement `resetUserPasswordWithOtp` with session invalidation (`passwordUpdatedAt`) in `apps/web/src/lib/supabase-auth.ts`

---

## Phase 3: User Story 1 - 6-Digit OTP Generation & API Endpoints (Priority: P1) 🎯 MVP

**Goal**: Enable users to request a 6-digit OTP to their canonical Gmail address and resend it respecting cooldown

- [x] T006 [P] [US1] Write unit/integration tests for OTP generation, delivery, and rate limiting in `apps/web/tests/auth/password-reset-otp.test.ts`
- [x] T007 [US1] Update `POST /api/auth/forgot-password` route to generate 6-digit OTP, send email, and return OTP status in `apps/web/src/app/api/auth/forgot-password/route.ts`
- [x] T008 [US1] Add `POST /api/auth/forgot-password/resend` route with 60-second cooldown enforcement in `apps/web/src/app/api/auth/forgot-password/resend/route.ts`

---

## Phase 4: User Story 2 - OTP Verification, Password Mutation & Invalidation (Priority: P1)

**Goal**: Enable users to submit 6-digit OTP, set a new password, invalidate prior sessions, and transition to login

- [x] T009 [P] [US2] Write unit/integration tests for OTP verification, invalid attempts lockout, and session invalidation in `apps/web/tests/auth/password-reset-otp.test.ts`
- [x] T010 [US2] Update `POST /api/auth/reset-password` route to accept `{ email, otp, password }`, verify code with timing-safe comparison, update password, and invalidate existing sessions in `apps/web/src/app/api/auth/reset-password/route.ts`

---

## Phase 5: User Story 3 - Frontend Two-Step Flow & Seamless Routing (Priority: P2)

**Goal**: Build intuitive two-step UI on `/forgot-password` and redirect `/reset-password`

- [x] T011 [US3] Update `apps/web/src/app/forgot-password/page.tsx` with Step 1 (Gmail input) and Step 2 (6-digit OTP, new password, confirm password, 60s cooldown resend timer, "Change email address" link) adhering to theme tokens
- [x] T012 [US3] Update `apps/web/src/app/reset-password/page.tsx` to redirect or guide users cleanly to `/forgot-password`
- [x] T013 [US3] Write UI tests verifying two-step transition and validation in `apps/web/tests/auth/forgot-password-ui.test.tsx` (or equivalent test suite)

---

## Phase 6: Polish & Quality Gate

**Purpose**: End-to-end verification, quality gate execution, and documentation sync

- [x] T014 Run full Turborepo test and validation suite: `pnpm turbo run build lint typecheck test`
- [x] T015 Synchronize milestone status in `docs/foundational-knowledge.md`
