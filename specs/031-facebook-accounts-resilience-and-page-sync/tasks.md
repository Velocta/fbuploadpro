# Tasks: Facebook Accounts Resilience, Page Token Sync, Expandable Linked Pages & Reconnect Mismatch Guard (Spec 031)

**Input**: Design documents from `/specs/031-facebook-accounts-resilience-and-page-sync/`
**Prerequisites**: `plan.md`, `spec.md`, `checklists/requirements.md`

---

## Phase 1: Contracts & Backend OAuth / Accounts API (`backend-engineer`)

- [x] T401 [P] [US1/US4/US5] Extend `OAuthStatePayloadSchema`, `MagicLinkTokenPayloadSchema` (optional `expectedFbAccountId`, `expectedDisplayName`) and `FacebookAccountSummarySchema` (optional `connectedPages` array of `{ id, pageName, profilePictureUrl }`) in `packages/contracts/src/domain/facebook.ts`, and rebuild `@fbuploadpro/contracts`.
- [x] T402 [US5] Update `GET /api/auth/facebook/route.ts`, `POST /api/tenant/[subdomain]/accounts/magic-link/route.ts`, and `GET /connect/facebook/route.ts` to accept and forward optional `expectedFbAccountId` and `expectedDisplayName` into the signed tokens.
- [x] T403 [US1/US2/US5] Update `GET /api/auth/facebook/callback/route.ts`:
  - Route `isMagic: true` cancellations (`access_denied`, `user_cancelled`) to `/connect/facebook/error?reason=cancelled` and exchange failures to `/connect/facebook/error?reason=oauth_failed`.
  - Check whether `(user_id, fb_account_id)` already existed prior to upsert.
  - Refresh `encrypted_page_token` (and `token_expires_at`) from `/me/accounts?fields=id,access_token` for all linked `facebook_pages` (`status != 'disconnected'`) belonging to that account, and set `status = 'active'` strictly for pages whose status was `'invalid_token'`.
  - Redirect Direct OAuth with `?reconnected_mismatch=1&newAccountName=...&expectedAccountName=...` on reconnect mismatch, or `?connected=already&accountName=...` when connecting an already-connected account during a standard connect flow.
- [x] T404 [US4] Update `GET /api/tenant/[subdomain]/accounts/route.ts` to return `connectedPages: Array<{ id, pageName, profilePictureUrl }>` for each account.

---

## Phase 2: Frontend Components & UX Hardening (`frontend-engineer`)

- [x] T405 [US1] Update `apps/web/src/app/connect/facebook/error/page.tsx` to display reason-aware titles and descriptions (`cancelled` vs `oauth_failed` vs `expired_or_invalid`).
- [x] T406 [US3/US4] Update `apps/web/src/components/accounts/account-card.tsx` to add `onError` avatar fallback to monogram initials (`data-testid="account-avatar-initials"`) and an expandable toggle on `"X page(s) linked"` (`data-testid="account-pages-toggle"`) revealing `data-testid="account-linked-pages-list"` with each linked page's avatar/initials and name.
- [x] T407 [US4] Update `apps/web/src/components/accounts/disconnect-account-dialog.tsx` to render the linked page names (`data-testid="disconnect-linked-pages-list"`) inside `data-testid="disconnect-linked-pages-warning"` when `connectedPages` is non-empty.
- [x] T408 [US5] Update `apps/web/src/components/accounts/connect-account-modal.tsx` and `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx` to pass `expectedFbAccountId` & `expectedDisplayName` when reconnecting, and display the exact notices for both reconnect account mismatch (`"You signed into {newAccountName} instead of {expectedAccountName}. {expectedAccountName} still needs to be reconnected."`) and already-connected refresh (`"This Facebook account ({accountName}) is already connected — its session was refreshed."`) across both Direct Browser and Magic Link flows.

---

## Phase 3: Verification & Regression Testing (`qa-engineer`)

- [x] T409 [P] [US1/US2/US4/US5] Expand backend unit/integration tests in `apps/web/tests/api/auth-facebook.test.ts` and `apps/web/tests/api/multi-account-oauth.test.ts` covering `isMagic` error/cancellation redirects, `/me/accounts` page token refresh (`encrypted_page_token` updated for all linked pages, `status = 'active'` only for `'invalid_token'` pages), reconnect mismatch redirect, already-connected redirect, and `connectedPages` aggregation.
- [x] T410 [P] [US3/US4/US5] Expand frontend unit tests in `apps/web/tests/ui/accounts.test.tsx` covering `AccountCard` avatar `onError` fallback, expandable linked pages list, `DisconnectAccountDialog` linked page names list, and `ConnectAccountModal` / `TenantAccountsPage` mismatch and already-connected notices.

