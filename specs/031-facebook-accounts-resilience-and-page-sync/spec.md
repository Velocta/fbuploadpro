# Feature Specification: Facebook Accounts Resilience, Page Token Sync, Expandable Linked Pages & Reconnect Mismatch Guard

**Feature Branch**: `031-facebook-accounts-resilience-and-page-sync`
**Created**: 2026-10-11
**Status**: Approved
**Input**: User request to implement 5 targeted improvements to the Facebook Accounts section (`Spec 031`):
1. Fix Remote Magic Link Error & Cancellation Redirects (`isMagic` Leak)
2. Auto-Refresh Linked Page Tokens on Account Reconnect (refresh `page_access_token` only and for all pages connected, not only `invalid_token` ones; only set `status = 'active'` for `invalid_token` ones)
3. Broken Avatar Fallback (`onError`) for Expired Facebook CDN URLs
4. Show Which Pages Are Linked (Expandable toggle on `"X pages linked"` on Card & explicit page names inside Disconnect Dialog)
5. Wrong-Account Detection During Reconnect (`reconnectingAccount` Mismatch) + Already-Connected Refresh on New Connect

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remote Magic Link Error & Cancellation Isolation (Priority: P1)

When an operator or client opens a Magic Link (`/connect/facebook?token=...`) in an unauthenticated remote browser and either cancels the Facebook authorization prompt (`?error=access_denied`) or encounters a token/profile exchange failure, the browser must redirect to `/connect/facebook/error?reason=...` rather than the authenticated tenant workspace URL (`https://{subdomain}.{rootDomain}/accounts?error=...`) so the remote browser never bounces to `/login`.

**Acceptance Scenarios**:
1. **Given** an `OAuthStatePayload` with `isMagic: true`, **When** Facebook redirects to `/api/auth/facebook/callback?error=access_denied&state=...`, **Then** the server redirects to `/connect/facebook/error?reason=cancelled` and the page renders `"Connection Canceled"` with `"Connection canceled. No changes were made. You can close this tab."`
2. **Given** an `OAuthStatePayload` with `isMagic: true`, **When** short-lived token exchange, long-lived token exchange, or `/me` profile fetch fails, **Then** the server redirects to `/connect/facebook/error?reason=oauth_failed` and the page renders `"Couldn't Connect to Facebook"` with `"Couldn't connect to Facebook. Check your permissions and try again."`

---

### User Story 2 - Auto-Refresh Linked Page Tokens on Account Re-Authentication (Priority: P1)

Whenever an existing Facebook account is re-authenticated in `/api/auth/facebook/callback`, the backend automatically fetches `/me/accounts?fields=id,access_token` using the new long-lived user access token, encrypts each returned `access_token`, and updates `encrypted_page_token` (and `token_expires_at`) for all linked `facebook_pages` belonging to that account—while only changing `facebook_pages.status` to `'active'` for pages whose status was `'invalid_token'`.

**Acceptance Scenarios**:
1. **Given** a Facebook account with 3 linked pages (`Page A` with `status = 'invalid_token'`, `Page B` with `status = 'paused'`, `Page C` with `status = 'active'`), **When** the account completes OAuth in `/api/auth/facebook/callback`, **Then** all 3 pages have their `encrypted_page_token` updated with the newly encrypted page token from `/me/accounts`, `Page A` transitions from `'invalid_token'` to `'active'`, `Page B` remains `'paused'`, and `Page C` remains `'active'`.
2. **Given** `/me/accounts` returns pages that are not yet imported into `facebook_pages`, **When** the callback runs, **Then** those unimported pages are not auto-imported; only already-linked pages (`status != 'disconnected'`) have their `encrypted_page_token` refreshed.

---

### User Story 3 - Broken Avatar Fallback (`onError`) for Expired Facebook CDN URLs (Priority: P1)

When Facebook's signed CDN profile picture URL (`scontent.*.fbcdn.net`) expires and returns HTTP 403/404 in the browser, `AccountCard` catches `onError` on `<img data-testid="account-avatar-img" />` and seamlessly renders the monogram initials avatar (`data-testid="account-avatar-initials"`).

**Acceptance Scenarios**:
1. **Given** an `AccountCard` with a non-null `profilePictureUrl`, **When** the `<img>` fires `onError`, **Then** `AccountCard` switches to rendering `data-testid="account-avatar-initials"` displaying the account's 2-letter uppercase initials.

---

### User Story 4 - Expandable Linked Pages on Card & Page Names in Disconnect Dialog (Priority: P1)

`GET /api/tenant/[subdomain]/accounts` returns a `connectedPages` array (`id`, `pageName`, `profilePictureUrl`) for each account. On `AccountCard`, when `connectedPagesCount > 0`, clicking `"X page(s) linked"` toggles an inline expandable list showing each linked page's avatar (or initials) and name. Inside `DisconnectAccountDialog`, when `connectedPagesCount > 0`, the destructive warning box lists the linked page names so the user knows exactly which pages will be removed.

**Acceptance Scenarios**:
1. **Given** an account with 2 linked pages (`"Acme Fitness"` and `"Acme Nutrition"`), **When** the user clicks the `"2 pages linked"` toggle button on `AccountCard`, **Then** an inline panel (`data-testid="account-linked-pages-list"`) expands showing `"Acme Fitness"` and `"Acme Nutrition"`.
2. **Given** an account with 2 linked pages, **When** the user opens `DisconnectAccountDialog`, **Then** the warning box (`data-testid="disconnect-linked-pages-warning"`) lists `"Acme Fitness"` and `"Acme Nutrition"`.

---

### User Story 5 - Reconnect Wrong-Account Mismatch Guard & Already-Connected Refresh (Priority: P1)

When reconnecting a specific account (`reconnectingAccount`), the target `expectedFbAccountId` and `expectedDisplayName` are passed into OAuth state / Magic Link. If the user authorizes a different Facebook profile (`newAccountName`), the newly authorized account is still saved/updated (and set to `'active'`), and the UI displays: `"You signed into {newAccountName} instead of {expectedAccountName}. {expectedAccountName} still needs to be reconnected."` Conversely, if the user clicks standard **Connect Facebook Account** (Direct or Magic Link) and authorizes an account that is already connected in the workspace, its token and `status = 'active'` (if expired) are refreshed, and the UI displays: `"This Facebook account ({accountName}) is already connected — its session was refreshed."`

**Acceptance Scenarios**:
1. **Given** an expired account `"John Doe"` (`fbAccountId = 'fb-john'`), **When** the user clicks **Reconnect account** and signs into `"Jane Smith"` (`fbAccountId = 'fb-jane'`), **Then** `"Jane Smith"` is saved/activated in `facebook_accounts`, `"John Doe"` remains `'expired'`, and the UI displays `"You signed into Jane Smith instead of John Doe. John Doe still needs to be reconnected."`
2. **Given** an already-connected account `"John Doe"` (either `'active'` or `'expired'`), **When** the user clicks **Connect Facebook Account** (via Direct Browser or Magic Link) and signs into `"John Doe"`, **Then** `"John Doe"` has its token refreshed, its status set to `'active'`, its linked page tokens refreshed, and the UI displays `"This Facebook account (John Doe) is already connected — its session was refreshed."`

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `OAuthStatePayloadSchema` and `MagicLinkTokenPayloadSchema` in `@fbuploadpro/contracts` MUST support optional `expectedFbAccountId?: string` and `expectedDisplayName?: string`.
- **FR-002**: `FacebookAccountSummarySchema` in `@fbuploadpro/contracts` MUST support optional `connectedPages?: Array<{ id: string; pageName: string; profilePictureUrl?: string | null }>`.
- **FR-003**: `GET /api/auth/facebook/callback` MUST route all errors and cancellations to `/connect/facebook/error?reason=...` whenever `statePayload?.isMagic === true`.
- **FR-004**: `GET /api/auth/facebook/callback` MUST check whether `(user_id, fb_account_id)` already existed prior to upsert, refresh `encrypted_page_token` (from `/me/accounts?fields=id,access_token`) for all linked `facebook_pages` (`status != 'disconnected'`) belonging to the upserted account, and set `facebook_pages.status = 'active'` strictly for pages whose status was `'invalid_token'`.
- **FR-005**: When `statePayload.expectedFbAccountId` is present and `meProfile.id !== statePayload.expectedFbAccountId`, `GET /api/auth/facebook/callback` MUST still save/activate the authorized account and redirect Direct OAuth to `destinationUrl` with `reconnected_mismatch=1`, `newAccountName`, and `expectedAccountName`.
- **FR-006**: When `statePayload.expectedFbAccountId` is NOT present and `(user_id, fb_account_id)` already existed in `facebook_accounts`, `GET /api/auth/facebook/callback` MUST update its token, set its status to `'active'`, refresh its linked page tokens, and redirect Direct OAuth to `destinationUrl` with `connected=already&accountName={meProfile.name}`.
- **FR-007**: `AccountCard` MUST handle `<img onError>` by falling back to `data-testid="account-avatar-initials"`, and MUST provide an interactive toggle on `"X page(s) linked"` (`data-testid="account-pages-toggle"`) when `connectedPagesCount > 0` to expand/collapse `data-testid="account-linked-pages-list"`.
- **FR-008**: `DisconnectAccountDialog` MUST render the names of linked pages inside `data-testid="disconnect-linked-pages-warning"` when `connectedPages` is non-empty.
