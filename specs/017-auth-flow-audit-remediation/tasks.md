# Tasks: Authentication Flow Audit Remediation

**Input**: Design documents from `specs/017-auth-flow-audit-remediation/`  
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `checklists/requirements.md`  

## Phase 1: Setup & Contracts (`packages/contracts`)

- [x] T001 [contracts] Update `LoginRequestSchema` with `.max(128)` on password and export `ResetPasswordRequestSchema` in `packages/contracts/src/domain/auth.ts`
- [x] T002 [contracts] Synchronize default session signing expiration to 30 days (`expiresInSeconds = 86400 * 30`) in `packages/contracts/src/domain/session.ts`
- [x] T003 [contracts] Run contract tests `pnpm --filter @fbuploadpro/contracts test` to verify schemas

---

## Phase 2: Foundational Security Utilities (`apps/web/src/lib`)

- [x] T004 [P] [security] Implement `sanitizeAuthRedirectUrl` in `apps/web/src/lib/auth-redirect.ts` with strict relative path and tenant hostname matching
- [x] T005 [security] Wire `sanitizeAuthRedirectUrl` into `apps/web/src/lib/supabase-auth.ts` and `apps/web/src/app/api/auth/signup/verify-otp/route.ts`

---

## Phase 3: User Story 1 (P1) - Open Redirect Defense & Post-Auth Routing

- [x] T006 [US1] Create unit tests in `apps/web/tests/auth/auth-redirect.test.ts` verifying all open redirect exploit vectors are neutralized
- [x] T007 [US1] Update `apps/web/src/app/login/page.tsx` to consume sanitized redirect URLs

---

## Phase 4: User Story 2 (P1) - Password Recovery Lifecycle & Secure Token Reset

- [x] T008 [US2] Implement IP rate limiting (5 / 60s) on `apps/web/src/app/api/auth/reset-password/route.ts`
- [x] T009 [US2] Update `resetUserPassword` in `apps/web/src/lib/supabase-auth.ts` to require and verify recovery tokens and eliminate arbitrary password overrides
- [x] T010 [US2] Overhaul `apps/web/src/app/reset-password/page.tsx` to parse URL recovery tokens, render an explicit "Invalid or Expired Link" fallback when missing, and pass tokens on submit
- [x] T011 [US2] Create integration test suite in `apps/web/tests/auth/reset-password.test.tsx` verifying token extraction, rate limiting, and invalid link guard states

---

## Phase 5: User Story 3 (P1) - In-Memory Credential Zero-Retention in OTP Staging

- [x] T012 [US3] Update `createPendingSignup` in `apps/web/src/lib/otp-service.ts` and `apps/web/src/app/api/auth/signup/route.ts` to pre-hash passwords with PBKDF2 immediately before staging
- [x] T013 [US3] Update `verifySignupOtp` and `apps/web/src/app/api/auth/signup/verify-otp/route.ts` to provision user with pre-hashed password
- [x] T014 [US3] Add unit tests in `apps/web/tests/auth/otp-memory-hygiene.test.ts` asserting zero cleartext passwords in memory

---

## Phase 6: User Story 4 (P2) - Session Synchronization & Invalidation

- [x] T015 [US4] Verify session token signing passes 30-day expiration (`86400 * 30`) across `loginTenantUser` and `registerTenantUser`
- [x] T016 [US4] Add password update invalidation check in `supabase-auth.ts` and test in `apps/web/tests/auth/session-invalidation.test.ts`

---

## Phase 7: User Story 5 (P2) - WCAG 2.2 AA Accessibility & Usability Hardening

- [x] T017 [P] [US5] In `apps/web/src/app/signup/page.tsx`: add `target="_blank"` and `rel="noopener noreferrer"` to Terms and Privacy links; expand touch target on "Return to form"
- [x] T018 [P] [US5] In `apps/web/src/app/login/page.tsx`: add proactive helper text for Gmail domain and bind `htmlFor` on password label to input ID
- [x] T019 [P] [US5] In `apps/web/src/app/forgot-password/page.tsx`: add `autoComplete="email"` and expand touch target on "Try a different email address"
- [x] T020 [P] [US5] In `apps/web/src/app/reset-password/page.tsx`: add `autoComplete="new-password"` to both password fields
- [x] T021 [P] [US5] In `apps/web/src/components/ui/input.tsx` and `apps/web/src/components/auth/password-input.tsx`: add `:focus-visible` styling to password visibility toggle button

---

## Phase 8: Quality Gates & Convergence

- [x] T022 Execute `pnpm turbo run build lint typecheck test` across entire monorepo with 100% test pass rate
- [x] T023 Update `specs/017-auth-flow-audit-remediation/checklists/security.md` and `checklists/requirements.md` to complete
- [x] T024 Perform `/speckit-converge` verification against original specification
