# Quality Checklist: Spec 029 — UX, OAuth Redirect & Multi-Account Scale

**Feature**: `029-facebook-accounts-ux-hardening`

## 1. UX & Visual Craft (`frontend-engineer`)
- [x] `DisconnectAccountDialog` renders a calm neutral subtle container (`var(--bg-subtle)`) with `"No Facebook pages are linked to this account yet. its safe to remove, You can reconnect it anytime."` when `connectedPagesCount === 0`.
- [x] `DisconnectAccountDialog` preserves the destructive red warning container when `connectedPagesCount > 0`.
- [x] `ConnectAccountModal` stops 3-second polling immediately when `remainingSeconds === 0` and replaces the expired link input with an inline `"Link expired — Generate a new link"` button.
- [x] Clicking the read-only Magic Link input (`data-testid="magic-url-input"`) auto-copies the URL to clipboard.
- [x] Clicking `"Reconnect account"` on an expired card opens `ConnectAccountModal` with title `"Reconnect {account.displayName}"` and supports both direct and Magic Link reconnection.
- [x] Expired accounts (`status === 'expired'`) are automatically pinned to the top of the accounts grid.
- [x] Search input and status filter tabs (`All`, `Active`, `Expired`) appear strictly when `accounts.length > 4`.
- [x] All styling strictly references tokens from `apps/web/src/lib/theme.ts`; `DESIGN.md` remains untouched.

## 2. Backend & Routing Consistency (`backend-engineer`)
- [x] `buildTenantUrl` in `@fbuploadpro/contracts` constructs `https://{subdomain}.{rootDomain}{pathname}` on production domains and `/tenant/{subdomain}{pathname}` on localhost/Vercel preview.
- [x] `/api/auth/facebook/callback` uses `buildTenantUrl` so direct OAuth returns operators to their canonical workspace subdomain.
- [x] `/api/tenant/[subdomain]/accounts` returns expired accounts sorted first (`status === 'expired'`), followed by `createdAt DESC`.

## 3. Quality & Testing (`qa-engineer`)
- [x] Unit tests added for `buildTenantUrl` in `packages/contracts/tests/routing.test.ts`.
- [x] Callback subdomain redirect test added in `apps/web/tests/api/auth-facebook.test.ts`.
- [x] UI component tests added in `apps/web/tests/ui/accounts.test.tsx` covering 0-page vs 1+-page disconnect dialog, Magic Link expiry button, click-to-copy input, reconnect modal title, expired account top-pinning, and `> 4` accounts search/filter bar.
