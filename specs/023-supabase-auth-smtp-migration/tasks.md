# Implementation Tasks: Spec 023 — Supabase Auth Native SMTP OTP Delivery Architecture

**Branch**: `feat/spec-023-supabase-auth-smtp-migration`  
**Spec Directory**: `specs/023-supabase-auth-smtp-migration`  
**Constitution Reference**: FBUploadPro Constitution v2.12.0 (Principle 17)  

---

## Phase 1: Foundational Enhancements & Resend Dependency Removal

- [x] T001 [P] [Foundational] Remove `resend` dependency from `apps/web/package.json` and delete `apps/web/src/lib/email-service.ts`.
- [x] T002 [Foundational] Update `apps/web/src/lib/supabase-auth.ts` with `signUpTenantUser`, `verifySignupOtpViaSupabase`, `resendSignupOtpViaSupabase`, and `resetPasswordWithSupabaseOtp` supporting both Supabase Auth API and test/offline fallback.

---

## Phase 2: Route Handler Migrations (Signup & Login)

- [x] T003 [P] [US1] Update `apps/web/src/app/api/auth/signup/route.ts` to register users with status `pending_verification` via Supabase Auth `signUp`.
- [x] T004 [US2] Update `apps/web/src/app/api/auth/signup/verify-otp/route.ts` to verify 6-digit OTP via `supabase.auth.verifyOtp` and activate profile to `active`.
- [x] T005 [US3] Update `apps/web/src/app/api/auth/signup/resend-otp/route.ts` to trigger fresh code via `supabase.auth.resend`.
- [x] T006 [US1] Update `apps/web/src/app/api/auth/login/route.ts` to detect `status === 'pending_verification'`, resend OTP via Supabase Auth, and return 403 `requiresOtp: true`.

---

## Phase 3: Route Handler Migrations (Password Recovery)

- [x] T007 [P] [US4] Update `apps/web/src/app/api/auth/forgot-password/route.ts` and `resend/route.ts` to dispatch recovery token via `supabase.auth.resetPasswordForEmail` or `resend({ type: 'recovery' })`.
- [x] T008 [US4] Update `apps/web/src/app/api/auth/reset-password/route.ts` to verify recovery token via `supabase.auth.verifyOtp` and update password via `supabase.auth.updateUser`.

---

## Phase 4: Test Suite Updates & CI Quality Gates

- [x] T009 [P] [Tests] Update test suites in `apps/web/tests/auth/` and `apps/web/tests/api/` to reflect Supabase Auth native OTP dispatch and zero Resend imports.
- [x] T010 Run `pnpm turbo run build lint typecheck test` to ensure 100% green tests and zero errors.

---

## Phase 5: Documentation & Pull Request Delivery

- [x] T011 Synchronize documentation: update roadmap in `docs/foundational-knowledge.md` for Spec 023 in the SAME pull request.
- [x] T012 Commit changes atomically, push feature branch, create PR, and surface Vercel preview link for user approval.
