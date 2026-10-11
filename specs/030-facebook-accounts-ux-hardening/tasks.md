# Implementation Tasks: Spec 029 — Facebook Accounts UX, OAuth Subdomain Redirect & Multi-Account Scale Hardening

**Feature ID**: `029-facebook-accounts-ux-hardening`  
**Plan**: [`plan.md`](./plan.md)  
**Specification**: [`spec.md`](./spec.md)

---

## Phase 1: Domain Contracts & Backend OAuth / Accounts Sorting (`backend-engineer`)

- [x] **T301**: Implement `buildTenantUrl(subdomain, pathname, requestUrl, rootDomain)` in `packages/contracts/src/domain/routing.ts` to construct canonical `https://{subdomain}.{rootDomain}{pathname}` URLs in production while preserving `/tenant/{subdomain}{pathname}` fallback on `localhost`, `127.0.0.1`, and `.vercel.app`.
- [x] **T302**: Update `apps/web/src/app/api/auth/facebook/callback/route.ts` to use `buildTenantUrl(tenantSubdomain, '/accounts', request.url, process.env.NEXT_PUBLIC_ROOT_DOMAIN)` for both success (`?connected=1`) and error redirects.
- [x] **T303**: Update `apps/web/src/app/api/tenant/[subdomain]/accounts/route.ts` so `handleListAccounts` sorts accounts with `status === 'expired'` pinned to the top, followed by `createdAt DESC`.

---

## Phase 2: Frontend UX & Component Enhancements (`frontend-engineer`)

- [x] **T304**: Update `DisconnectAccountDialog` in `apps/web/src/components/accounts/disconnect-account-dialog.tsx` so when `pagesCount === 0` it renders a calm neutral subtle container (`var(--bg-subtle)` with hairline border) and the exact text `"No Facebook pages are linked to this account yet. its safe to remove, You can reconnect it anytime."`, while keeping the red destructive notice when `pagesCount > 0`.
- [x] **T305**: Update `ConnectAccountModal` in `apps/web/src/components/accounts/connect-account-modal.tsx` to:
  1. Support `reconnectingAccount?: { id: string; displayName: string } | null` and render `"Reconnect {reconnectingAccount.displayName}"` as the `DialogTitle` when present.
  2. Detect reconnection completion in `pollAccounts()` when an existing expired/reconnecting account transitions to `status === 'active'` or updates its `updatedAt` timestamp.
  3. Stop background polling when `remainingSeconds <= 0` and replace the link input row with an inline `"Link expired — Generate a new link"` button (`data-testid="magic-regenerate-button"`).
  4. Allow clicking anywhere on `data-testid="magic-url-input"` to auto-copy the Magic Link URL.
- [x] **T306**: Update `TenantAccountsPage` in `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx` to:
  1. Open `ConnectAccountModal` with `reconnectingAccount` when `"Reconnect account"` is clicked on an expired `AccountCard`.
  2. Automatically pin `status === 'expired'` accounts to the top of the displayed grid.
  3. Render a lightweight search input (`data-testid="accounts-search-input"`) and status filter tabs (`All`, `Active`, `Expired`) when `accounts.length > 4`.

---

## Phase 3: Integration & Unit Test Verification (`qa-engineer`)

- [x] **T307**: Add unit tests for `buildTenantUrl` in `packages/contracts/tests/routing.test.ts` and verify subdomain redirect behavior in `apps/web/tests/api/auth-facebook.test.ts`.
- [x] **T308**: Expand `apps/web/tests/ui/accounts.test.tsx` to verify 0-page vs 1+-page `DisconnectAccountDialog`, `ConnectAccountModal` reconnect title, click-to-copy input, `0:00` timer expiry `"Link expired — Generate a new link"` recovery button, expired account top-pinning, and `> 4` accounts search/filter bar.

