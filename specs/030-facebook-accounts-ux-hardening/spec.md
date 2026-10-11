# Feature Specification: Spec 029 — Facebook Accounts UX, OAuth Subdomain Redirect & Multi-Account Scale Hardening

**Feature ID**: `029-facebook-accounts-ux-hardening`  
**Status**: Approved  
**Created**: 2026-10-10  
**Constitution Authority**: Principle 20 (Dedicated Facebook Accounts Management Section & Dual-Mode Multi-Browser Connection Architecture)

---

## 1. Executive Summary & Problem Statement

Following the launch of the dedicated Facebook Accounts section in Spec 027 and its UX copy refinement, five focused operational and UX improvements are required:

1. **Smarter Disconnect Dialog When `0` Pages Are Linked (Improvement B)**:
   - Currently, disconnecting an account with `0` linked pages displays a red destructive warning stating *"0 linked Facebook pages will be Removed, and any scheduled content on them will be removed as well."*
   - When `0` pages are linked, the dialog must instead display a calm, neutral subtle container (`var(--bg-subtle)` with hairline border) and the reassurance copy: `"No Facebook pages are linked to this account yet. its safe to remove, You can reconnect it anytime."`
2. **Subdomain Redirect Consistency After OAuth (Improvement D)**:
   - Because Facebook Graph API requires a single static OAuth callback URL (`app.vinsmokemedia.online/api/auth/facebook/callback`), completing direct OAuth currently redirects to `new URL('/tenant/' + tenantSubdomain + '/accounts', request.url)` on the central app gateway rather than returning the user to their clean workspace subdomain (`{subdomain}.vinsmokemedia.online/accounts?connected=1`).
   - The callback redirect helper must use `buildTenantUrl(tenantSubdomain, '/accounts?connected=1')` (when `NEXT_PUBLIC_ROOT_DOMAIN` is configured, with clean fallback for local/preview environments) so operators always land back on their exact workspace subdomain.
3. **Magic Link Timer Expiry Handling & Click-to-Copy (Improvement E)**:
   - When the 15-minute Magic Link countdown reaches `0:00`, the modal currently stays stuck on *"Waiting for Facebook approval... Link expires in 0:00"* and continues polling `/api/tenant/[subdomain]/accounts` every 3 seconds indefinitely.
   - Polling must automatically stop when `remainingSeconds === 0`, the expired link input must be replaced with an inline **"Link expired — Generate a new link"** action button, and clicking anywhere on the read-only link input when active must auto-copy the URL.
4. **Reconnect via Magic Link Option (Improvement F)**:
   - Clicking `Reconnect account` on an expired card currently triggers `window.location.href = '/api/auth/facebook'`, forcing reconnection in the current browser even if the profile was originally connected from a different browser via Magic Link.
   - Clicking `Reconnect account` must instead open the `ConnectAccountModal` (with header title `"Reconnect {account.displayName}"`) offering both **This browser** and **Different browser or device (Magic Link)**, and background polling must detect when an existing reconnecting account transitions back to `status === 'active'` (or its `updatedAt` timestamp advances).
5. **Auto-Sort Expired Accounts to Top & Agency Search/Filter (Improvement G)**:
   - Accounts are currently sorted strictly by `created_at DESC`, meaning an expired account among 15+ profiles can be buried at the bottom of the page.
   - Expired accounts (`status === 'expired'`) must automatically be pinned to the top of the grid, and once a workspace has more than 4 connected accounts (`accounts.length > 4`), a lightweight search input (filtering by display name) and status filter tabs (`All`, `Active`, `Expired`) must appear.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1: Context-Aware Disconnect Dialog for 0 vs 1+ Linked Pages (Priority: P1)
**As a** workspace operator disconnecting a Facebook account,  
**When** the account has `0` linked Facebook Pages,  
**Then** I see a calm, neutral notice box confirming no pages are linked, whereas when `1+` pages are linked, I see the destructive red warning.

**Acceptance Criteria**:
1. When `account.connectedPagesCount === 0`, `DisconnectAccountDialog` renders a neutral subtle container (`backgroundColor: var(--bg-subtle)`, hairline border) with the exact copy:  
   `"No Facebook pages are linked to this account yet. its safe to remove, You can reconnect it anytime."`
2. When `account.connectedPagesCount > 0`, `DisconnectAccountDialog` renders the red destructive notice container with `"Before you disconnect"` and `"{pagesCount} linked {pagesCount === 1 ? 'Facebook page' : 'Facebook pages'} will be Removed, and any scheduled content on them will be removed as well."`

---

### User Story 2: Canonical Tenant Subdomain Redirect After Direct OAuth (Priority: P1)
**As a** workspace operator completing or cancelling Direct OAuth from `{subdomain}.{rootDomain}`,  
**When** Facebook redirects back to `/api/auth/facebook/callback`,  
**Then** I am redirected back to `https://{subdomain}.{rootDomain}/accounts?connected=1` (or `?error=...`) instead of staying on `app.{rootDomain}/tenant/{subdomain}/accounts`.

**Acceptance Criteria**:
1. When `NEXT_PUBLIC_ROOT_DOMAIN` is configured and non-localhost, `/api/auth/facebook/callback` constructs the tenant destination URL using `buildTenantUrl(tenantSubdomain, '/accounts', protocol, rootDomain)`.
2. Query parameters (`?connected=1` or `?error=...`) are appended cleanly to the tenant URL.
3. On localhost or environments without `NEXT_PUBLIC_ROOT_DOMAIN` where `statePayload.tenantSubdomain` is present, it falls back gracefully so local development and existing tests continue to work seamlessly.

---

### User Story 3: Magic Link Expiry Recovery & Input Click-to-Copy (Priority: P1)
**As a** workspace operator using a Magic Link in `ConnectAccountModal`,  
**When** I click the link input or when the 15-minute countdown expires (`0:00`),  
**Then** clicking the input copies the URL immediately, and reaching `0:00` stops polling and shows an inline `"Link expired — Generate a new link"` button.

**Acceptance Criteria**:
1. Clicking anywhere on the read-only Magic Link `<input>` (`data-testid="magic-url-input"`) triggers clipboard copy and activates the `"Copied!"` feedback state.
2. When `remainingSeconds === 0`, the 3-second `/api/tenant/[subdomain]/accounts` polling interval is cleared and does not fire further requests.
3. When `remainingSeconds === 0`, the link input row is replaced by an inline button (`data-testid="magic-regenerate-button"`) labeled `"Link expired — Generate a new link"`, which calls `handleStartMagicLink()` to issue a fresh 15-minute link.

---

### User Story 4: Dual-Mode Reconnect Flow via Connect Modal (Priority: P1)
**As a** workspace operator with an expired Facebook account (`status === 'expired'`),  
**When** I click `"Reconnect account"` on the card,  
**Then** the `ConnectAccountModal` opens with title `"Reconnect {account.displayName}"`, allowing me to reconnect via **This browser** or **Different browser or device (Magic Link)**.

**Acceptance Criteria**:
1. Clicking `"Reconnect account"` on `AccountCard` opens `ConnectAccountModal` with `reconnectingAccount` set to that account.
2. When `reconnectingAccount` is provided, the modal `DialogTitle` renders `"Reconnect {reconnectingAccount.displayName}"` (and `"Connect Facebook Account"` when adding a new account).
3. During Magic Link polling, completion is triggered if either:
   - A new account ID appears that was not in the initial set, OR
   - An existing account that was `'expired'` (or matches `reconnectingAccount.id`) transitions to `status === 'active'` or has a newer `updatedAt` timestamp.

---

### User Story 5: Expired Account Pinning & Multi-Account Search/Filter Bar (Priority: P2)
**As a** workspace operator managing multiple connected Facebook accounts,  
**When** one or more accounts expire or when I have more than 4 connected accounts,  
**Then** expired accounts are automatically pinned to the top of the grid, and a search/filter bar appears when `accounts.length > 4`.

**Acceptance Criteria**:
1. Both the backend query (`GET /api/tenant/[subdomain]/accounts`) and frontend grid sort connected accounts with `status === 'expired'` pinned first, followed by `createdAt DESC`.
2. When `accounts.length <= 4`, the search and filter bar is hidden to keep the UI minimal.
3. When `accounts.length > 4`, a toolbar (`data-testid="accounts-filter-bar"`) renders above the grid containing:
   - A search input (`data-testid="accounts-search-input"`, placeholder `"Search accounts..."`) filtering cards case-insensitively by `displayName`.
   - Status filter buttons (`All`, `Active`, `Expired`) filtering cards by status.
4. If no accounts match the active search/filter criteria, a clean inline empty filter state is shown with a `"Clear filters"` action.

---

## 3. Clarifications Resolved (Phase 0 & Phase 3)
- **Q1 (0-Page Disconnect Styling)**: Use a neutral subtle container (`var(--bg-subtle)` with hairline border) and the exact copy `"No Facebook pages are linked to this account yet. its safe to remove, You can reconnect it anytime."`
- **Q2 (Filter Controls for > 4 Accounts)**: Include both a search input (by account name) and status filter tabs (`All` / `Active` / `Expired`).
- **Q3 (Reconnect Modal Header & Polling)**: Display `"Reconnect {account.displayName}"` as the modal title and auto-detect when its status returns to `'active'` during Magic Link polling.
