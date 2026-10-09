# Implementation Tasks: Spec 024 — Native Supabase Auth Lifecycle

**Branch**: `feat/spec-024-supabase-native-auth-lifecycle`  
**Spec Directory**: `specs/024-supabase-native-auth-lifecycle`  
**Constitution Reference**: Principle 18 (Native Supabase Email Verification Lifecycle)

---

## Phase 1: Contracts & Database Status Cleanup

- [x] T001 [P] Revert `UserStatusSchema` in `packages/contracts/src/domain/user.ts` to `['active', 'suspended']` and update contract tests in `packages/contracts/tests/user.test.ts`.
- [x] T002 Build `@fbuploadpro/contracts` via `pnpm --filter @fbuploadpro/contracts build`.
- [x] T003 Revert or replace `supabase/migrations/20261009210000_add_pending_verification_status.sql` to ensure `users_status_check` constraint strictly enforces `CHECK (status IN ('active', 'suspended'))`.

---

## Phase 2: Supabase Auth Service & Error Handling Hardening

- [x] T004 [P] Update `apps/web/src/lib/auth-errors.ts` to recognize Supabase rate limit messages (`/after (\d+) seconds/i`, `"for security purposes"`) and return HTTP 429 with `retryAfterSeconds`.
- [x] T005 Update `apps/web/src/lib/supabase-auth.ts`:
  - `loginTenantUser`: Catch `Email not confirmed` and throw `code: 'REQUIRES_OTP'`, `requiresOtp: true`.
  - `signUpTenantUser`: If user re-submits same email, update details, catch cooldown, return `requiresOtp: true`. Insert with `status: 'active'`.
  - `resetUserPasswordWithOtp`: Upsert user into `public.users` with `status: 'active'` and provision storage quotas.

---

## Phase 3: Route Handlers & UI Polish

- [x] T006 Update `apps/web/src/app/api/auth/signup/route.ts` and `apps/web/src/app/api/auth/login/route.ts` to seamlessly handle 429 rate limits and 403 `requiresOtp`.
- [x] T007 Update `apps/web/src/app/signup/page.tsx` to handle 429 cooldowns with live button countdown and automatic re-enabling.

---

## Phase 4: Monorepo Quality Gate & Verification

- [x] T008 Run `pnpm turbo run build lint typecheck test` to confirm 100% green tests and 0 errors.

---

## Phase 5: Documentation & Pull Request

- [x] T009 Update `docs/foundational-knowledge.md` and `.specify/memory/constitution.md` for Spec 024 in the SAME pull request.
- [ ] T010 Commit changes atomically, push feature branch, create PR, and surface Vercel preview URL for user approval.
