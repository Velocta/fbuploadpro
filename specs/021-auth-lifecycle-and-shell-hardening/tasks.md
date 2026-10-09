# Implementation Tasks: Spec 021 — Comprehensive Auth Lifecycle, Resilient Session Termination & Workspace Shell Usability Hardening

**Branch**: `feat/spec-021-auth-lifecycle-and-shell-hardening`  
**Spec Directory**: `specs/021-auth-lifecycle-and-shell-hardening`  
**Constitution Reference**: FBUploadPro Constitution v2.10.0 (Principle 15)  

---

## Phase 1: Foundational Enhancements (Pending Signups & Password Pre-Hashing)

- [x] T001 [P] [Foundational] Extend `apps/web/src/lib/otp-service.ts` with helper methods: `findPendingSignup(email)`, `verifyPendingSignupPassword(email, candidatePassword)`, and `refreshPendingSignupOtp(email)` while ensuring PBKDF2 hash verification.
- [x] T002 [Foundational] Write unit tests in `apps/web/src/lib/__tests__/otp-service.test.ts` for pending signup lookup, password verification, and fresh OTP generation.

---

## Phase 2: User Story 1 (P1) — Pending Registration Recovery & OTP Onboarding Resilience

- [x] T003 [P] [US1] Update `apps/web/src/app/api/auth/login/route.ts` to detect unverified pending registrations: verify password hash, issue fresh OTP via Resend, and return HTTP 403 with `{ requiresOtp: true, email: canonicalEmail }`. If password is wrong, return standard 401.
- [x] T004 [US1] Update `apps/web/src/app/login/page.tsx` to handle `requiresOtp: true` by redirecting to `/signup?step=otp&email=${encodeURIComponent(email)}&notice=pending_verification`.
- [x] T005 [US1] Update `apps/web/src/app/signup/page.tsx` to support URL search params (`step=otp` and `email`), render contextual banner when `notice=pending_verification`, add "Wrong email? Edit details" action button preserving form state, handle expired OTP with 1-click "Send fresh code", and render actionable "Sign in instead" & "Reset password" links on 409 Conflict.
- [x] T006 [US1] Write test cases asserting login unverified account routing and OTP onboarding recovery in `apps/web/src/app/api/auth/login/__tests__/login-unverified.test.ts`.

---

## Phase 3: User Story 2 (P1) — Bulletproof Sign Out & Multi-Tab Synchronization

- [x] T007 [P] [US2] Update `apps/web/src/components/workspace/workspace-user-menu.tsx` to immediately expire client session cookies (`fbup_session`), broadcast logout across tabs via `BroadcastChannel('fbup_auth')` and `localStorage`, and navigate directly to `https://app.${rootDomain}/login?logout=success`.
- [x] T008 [US2] Update `apps/web/src/middleware.ts` to check `request.nextUrl.searchParams.get('logout') === 'success'` and permit `/login` access without triggering auto-forward session redirects.
- [x] T009 [US2] Add bfcache prevention headers (`Cache-Control: no-store, no-cache, must-revalidate`) in `middleware.ts` for authenticated tenant responses, and add `window.addEventListener('pageshow', ...)` reload listener in tenant workspace layout.
- [x] T010 [US2] Add cross-tab logout synchronization listener in `apps/web/src/app/tenant/[subdomain]/layout.tsx` listening on `BroadcastChannel('fbup_auth')` and `storage` events.
- [x] T011 [US2] Add test coverage for logout handling and middleware bypass in `apps/web/src/__tests__/logout-resilience.test.ts`.

---

## Phase 4: User Story 3 (P2) — Workspace Shell Responsive Navigation & Theme Persistence

- [x] T012 [P] [US3] Update `apps/web/src/components/workspace/workspace-user-menu.tsx` to persist theme toggles into both `localStorage` and cookie `fbup_theme` with 1-year maxAge.
- [x] T013 [US3] Update `apps/web/src/components/workspace/workspace-sidebar.tsx` so navigation link clicks trigger `setOpenMobile(false)` on mobile viewports (<768px).
- [x] T014 [US3] Update `apps/web/src/app/tenant/[subdomain]/layout.tsx` to ensure layout canvas reserves responsive mobile left gutter (`pl-14` / 56px) preventing floating hamburger button overlap.
- [x] T015 [US3] Ensure user popover menu in `workspace-user-menu.tsx` applies collision detection and safe positioning bounds.

---

## Phase 5: User Story 4 (P2) & Story 5 (P3) — Sign In, Security Hygiene & Recovery Feedback

- [x] T016 [P] [US4] Add accessible Caps Lock indicator badge to `apps/web/src/components/auth/password-input.tsx`.
- [x] T017 [US4] Update `apps/web/src/app/login/page.tsx` with uniform rate-limiting messages and banner notice for `reason=password_changed`.
- [x] T018 [US4] Add client-side fetch interceptor/wrapper in tenant workspace to transition to `/account-suspended` on 403 `ACCOUNT_SUSPENDED`.
- [x] T019 [US5] Update password recovery in `apps/web/src/app/forgot-password/page.tsx` with clear notice when subsequent OTP invalidates previous codes, clean cancellation returning to login, and enforce `autoComplete="new-password"`.

---

## Phase 6: Quality Gates, Docs Synchronization & Convergence

- [x] T020 Run `pnpm turbo run build lint typecheck test` to ensure 100% passing tests and zero errors.
- [x] T021 Synchronize documentation: update roadmap in `docs/foundational-knowledge.md` for Spec 021 in the SAME pull request.
- [x] T022 Commit changes atomically, push feature branch, create PR, and surface Vercel preview link for user approval.
