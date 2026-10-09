# Tasks: Auth OTP Confirmation & Subdomain Hardening (Spec 013)

**Input**: Design documents from `specs/013-auth-otp-confirmation-and-subdomain-hardening/`  
**Prerequisites**: `spec.md`, `plan.md`, `checklists/requirements.md`

---

## Phase 1: Core Services & Utilities (Priority: P1) 🎯 MVP

- [x] T001 [P1] [Foundational] Implement Resend email service with branded template in `apps/web/src/lib/email-service.ts`
- [x] T002 [P1] [Foundational] Implement 6-digit cryptographic OTP generation, storage, and verification in `apps/web/src/lib/otp-service.ts`
- [x] T003 [P1] [Unit Tests] Add unit tests for OTP service in `apps/web/tests/auth/otp-service.test.ts`

---

## Phase 2: API Endpoints (Priority: P1) 🎯 MVP

- [x] T004 [P1] [US1] Update `POST /api/auth/signup` to initiate pending registration and dispatch 6-digit OTP via Resend
- [x] T005 [P1] [US1] Implement `POST /api/auth/signup/verify-otp` to validate OTP, provision user record, and issue session cookie
- [x] T006 [P1] [US1] Implement `POST /api/auth/signup/resend-otp` with 60-second cooldown enforcement
- [x] T007 [P1] [Integration Tests] Add integration tests for signup OTP API routes in `apps/web/tests/api/signup-otp.test.ts`

---

## Phase 3: Subdomain Routing Hardening (Priority: P1) 🎯 MVP

- [x] T008 [P1] [US2] Update `apps/web/src/middleware.ts` to eliminate `isPublicTenantPath` and 307 redirect tenant subdomain requests for `/login`, `/signup`, `/forgot-password`, and `/reset-password` to `app.${rootDomain}` with query parameters preserved
- [x] T009 [P1] [Integration Tests] Add middleware test cases verifying 307 redirects for tenant auth paths in `apps/web/tests/middleware-subdomain-auth.test.ts`

---

## Phase 4: UI Components & UX Enhancements (Priority: P2)

- [x] T010 [P2] [US3] Implement `PasswordStrengthMeter` component with theme tokens in `apps/web/src/components/auth/password-strength-meter.tsx`
- [x] T011 [P2] [US4] Enhance `PasswordInput` with Caps Lock warning detection in `apps/web/src/components/auth/password-input.tsx`
- [x] T012 [P2] [US5] Update `apps/web/src/app/login/page.tsx` to preserve `returnUrl` when linking to `/signup`
- [x] T013 [P2] [US1, US5, US6] Refactor `apps/web/src/app/signup/page.tsx` to include Step 1 (Strength Meter, Caps Lock, Legal Consent, `returnUrl`) and Step 2 (6-digit OTP verification view)

---

## Phase 5: Verification & Quality Gates (Priority: P3)

- [x] T014 [P3] [QA] Run full test suite: `pnpm turbo run build lint typecheck test` ensuring 100% pass rate with 0 errors
- [x] T015 [P3] [Docs] Update documentation roadmap in `docs/foundational-knowledge.md`
