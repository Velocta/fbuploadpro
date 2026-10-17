# Implementation Tasks: Spec 064 Temporary Signup Pause Toggle

## Phase 1: Core Guard Helper & Client UI (P1)

- [x] **Task 1 (P1)**: Create `isSignupEnabled` helper in `packages/contracts/src/auth/signup-guard.ts` (and re-export in contracts index) and unit tests.
- [x] **Task 2 (P1)**: Create `<SignupPausedCard />` in `apps/web/src/components/auth/signup-paused-card.tsx` with official brand mark, theme tokens, and primary CTA to `/login`.
- [x] **Task 3 (P1)**: Integrate signup guard into `apps/web/src/app/signup/page.tsx` rendering `<SignupPausedCard />` when disabled unless `step === 'otp'`.
- [x] **Task 4 (P1)**: Enforce server-side guard in `apps/web/src/app/api/auth/signup/route.ts` returning HTTP 403 when signups are disabled.

## Phase 2: Configuration & Environment Sync (P2)

- [x] **Task 5 (P2)**: Register `NEXT_PUBLIC_SIGNUPS_ENABLED` in `.github/scripts/sync-vercel-env.mjs` and `.github/workflows/sync-vercel-env.yml`.
- [x] **Task 6 (P2)**: Synchronize `.env.example`, `.env.production.example`, `docs/secrets-checklist.md`, and `docs/deployment-guide.md`.

## Phase 3: Automated Verification & Unit Tests (P1)

- [x] **Task 7 (P1)**: Create test suites in `apps/web/tests/ui/signup-paused.test.tsx` and `apps/web/tests/api/signup-disabled.test.ts` verifying UI rendering, API rejection, and OTP flow preservation.
