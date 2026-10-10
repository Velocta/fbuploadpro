# Tasks: Spec 027 — Dedicated Facebook Accounts Management Section & Dual-Mode Connection Flow

**Branch**: `feat/027-facebook-accounts-section` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Phase 1: Contracts & Backend Magic Link Endpoints
- [x] T001 [P] Implement magic link signing and verification schemas in `packages/contracts/src/domain/oauth.ts` and export them.
- [x] T002 [P] Implement `POST /api/tenant/[subdomain]/accounts/magic-link` route handler in `apps/web/src/app/api/tenant/[subdomain]/accounts/magic-link/route.ts`.
- [x] T003 [P] Implement public forwarder `GET /connect/facebook/route.ts` validating magic token and redirecting to Facebook OAuth dialog with `isMagic: true` in state.
- [x] T004 [P] Update `GET /api/auth/facebook/callback/route.ts` to redirect to `/connect/facebook/success` when `isMagic: true`.
- [x] T005 [P] Create standalone remote success page in `apps/web/src/app/connect/facebook/success/page.tsx`.

## Phase 2: Frontend Components (Taste & Craft Floor)
- [x] T006 [P] Build `AccountCard` in `apps/web/src/components/accounts/account-card.tsx` with minimalist presentation (no health badge when active, "Re-authentication required" and Reconnect button when expired, Disconnect button).
- [x] T007 [P] Build `AccountsEmptyState` in `apps/web/src/components/accounts/accounts-empty-state.tsx`.
- [x] T008 [P] Build `DisconnectAccountDialog` in `apps/web/src/components/accounts/disconnect-account-dialog.tsx` using `apps/web/src/components/ui/dialog.tsx`.
- [x] T009 [P] Build `ConnectAccountModal` in `apps/web/src/components/accounts/connect-account-modal.tsx` with Direct Connection and Magic Link (15-min countdown, copy button, 3s auto-polling).
- [x] T010 [P] Build main Facebook Accounts page at `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx` integrating header, grid, empty state, and dismissible OAuth banner.

## Phase 3: Tests & Verification (Zero Mock Theater)
- [x] T011 [P] Write unit and integration tests in `apps/web/tests/ui/accounts.test.tsx` verifying grid, card states (active vs expired), empty state, disconnect dialog, and modal.
- [x] T012 [P] Write integration tests for magic link routes in `apps/web/tests/api/magic-link.test.ts`.
- [x] T013 [P] Synchronize `.specify/memory/constitution.md` (Principle 20) and `docs/foundational-knowledge.md`.
- [x] T014 Run full quality gate `pnpm turbo run build lint typecheck test` and verify 100% pass rate.
