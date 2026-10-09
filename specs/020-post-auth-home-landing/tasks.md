# Implementation Tasks: 020 Post-Authentication Workspace Home Landing Route

**Feature ID**: `020-post-auth-home-landing`  
**Date**: 2026-10-09  

---

## Phase 1: Core Redirection & Auth Logic (Priority: P1)

- [X] T001 [P1] [US1] Update `apps/web/src/lib/auth-redirect.ts` to set default post-auth URL to root `${protocol}://${userSubdomain}.${rootDomain}/` (or `/` without subdomain), eliminating `/dashboard`
- [X] T002 [P1] [US1] Update `apps/web/src/lib/supabase-auth.ts` in `registerTenantUser` and `loginTenantUser` to eliminate `/dashboard` and default to tenant root
- [X] T003 [P2] [US4] Update `apps/web/src/middleware.ts` to redirect authenticated users on central app domain (`app.${rootDomain}`) to tenant root instead of `/dashboard`

---

## Phase 2: Password Reset Success & Login Banner (Priority: P1)

- [X] T004 [P1] [US3] Update `apps/web/src/app/forgot-password/page.tsx` to redirect to `/login?reset=success` upon successful password reset
- [X] T005 [P1] [US3] Update `apps/web/src/app/login/page.tsx` to detect `?reset=success` query parameter and display accessible success Alert banner

---

## Phase 3: Unit & Integration Tests (Priority: P1)

- [X] T006 [P1] [US1] Update unit tests in `apps/web/tests/auth/auth-redirect.test.ts` for root URL fallback
- [X] T007 [P1] [US1] Update integration tests in `apps/web/tests/api/auth-endpoints.test.ts` and middleware tests for root landing
- [X] T008 [P1] [US3] Add/update tests in `apps/web/tests/auth/forgot-password.test.tsx` and `apps/web/tests/login.test.tsx` for post-reset redirection and banner rendering

---

## Phase 4: Verification & Quality Gates

- [X] T009 Run full quality gate `pnpm turbo run build lint typecheck test` to assert 100% clean builds, zero lint errors, and all tests passing
