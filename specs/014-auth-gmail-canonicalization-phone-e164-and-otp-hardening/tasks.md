# Tasks: Auth Gmail Canonicalization, Phone E.164 & Hardened OTP Security (Spec 014)

**Input**: Design documents from `specs/014-auth-gmail-canonicalization-phone-e164-and-otp-hardening/`  
**Prerequisites**: `spec.md`, `plan.md`, `checklists/requirements.md`

---

## Phase 1: Contracts & Dependencies (Priority: P1) 🎯 MVP

- [x] T001 [P1] [Foundational] Install `libphonenumber-js` in `packages/contracts`
- [x] T002 [P1] [US1, US2] Implement `canonicalizeGmailAddress` and `validateAndFormatE164Phone` in `packages/contracts/src/domain/auth.ts`, updating `SignupRequestSchema` and `LoginRequestSchema`
- [x] T003 [P1] [Unit Tests] Add unit tests for Gmail canonicalization and E.164 phone validation in `packages/contracts/tests/auth-hardening.test.ts`

---

## Phase 2: Database Substrate & Schema Migrations (Priority: P1) 🎯 MVP

- [x] T004 [P1] [US1, US2] Create Supabase migration `supabase/migrations/20261009120000_auth_hardening_canonical_email_e164.sql` adding `normalized_email`, unique index, and check constraints
- [x] T005 [P1] [US1, US2] Mirror migration to `packages/database/migrations/0007_auth_hardening_canonical_email_e164.sql` and update migration schema tests

---

## Phase 3: Rate Limiting & OTP Hardening (Priority: P1) 🎯 MVP

- [x] T006 [P1] [US3] Implement sliding-window rate limiter utility in `apps/web/src/lib/rate-limiter.ts`
- [x] T007 [P1] [US3] Harden `apps/web/src/lib/otp-service.ts` with constant-time verification (`timingSafeEqual`), lockout tracking, and password hashing in pending state
- [x] T008 [P1] [Unit Tests] Add unit tests for rate limiter and hardened OTP verification in `apps/web/tests/auth/rate-limiter.test.ts` and update `otp-service.test.ts`
- [x] T009 [P1] [US1] Update `apps/web/src/lib/supabase-auth.ts` to query, register, and persist `normalized_email`

---

## Phase 4: API Endpoints & Abuse Shield (Priority: P1) 🎯 MVP

- [x] T010 [P1] [US1, US3] Update `POST /api/auth/signup` and `POST /api/auth/signup/resend-otp` with rate limiting, Gmail canonicalization, and Resend delivery validation
- [x] T011 [P1] [US1, US4] Update `POST /api/auth/login` and `POST /api/auth/forgot-password` with email canonicalization and safe user-enumeration resilience
- [x] T012 [P1] [Integration Tests] Update auth integration tests in `apps/web/tests/api/signup-otp.test.ts` and `apps/web/tests/api/auth-endpoints.test.ts`

---

## Phase 5: Client-Side UI & UX Copy Alignment (Priority: P2)

- [x] T013 [P2] [US1, US2] Update `apps/web/src/app/signup/page.tsx` and `apps/web/src/app/login/page.tsx` with Gmail-only and international E.164 phone formatting and validation
- [x] T014 [P2] [US1] Update `apps/web/src/app/forgot-password/page.tsx` with Gmail-only helper copy and canonicalization

---

## Phase 6: Verification & Quality Gates (Priority: P3)

- [x] T015 [P3] [QA] Run full test suite: `pnpm turbo run build lint typecheck test` ensuring 100% pass rate with 0 errors
- [x] T016 [P3] [Docs] Update documentation roadmap in `docs/foundational-knowledge.md`
