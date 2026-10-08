# Feature Specification: Facebook Graph API OAuth & Multi-Account Social Connection

**Feature Branch**: `spec/003-facebook-page-connection`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Facebook Graph API OAuth & Social Account Connection: Multi-account architecture where users can connect multiple Facebook accounts per tenant workspace, store encrypted access tokens for each account, discover and selectively import Facebook Pages from any connected account, store encrypted page access tokens, and manage multi-account lifecycles. Strictly limited to Facebook Pages (zero support for Facebook Groups)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connecting Multiple Facebook Accounts & Encrypted Token Storage (Priority: P1) 🎯 MVP

A tenant workspace user can connect multiple distinct Facebook accounts (for example, a personal profile, an agency manager account, or client representative profiles) to their single tenant workspace. For each account connection, the user initiates a secure OAuth 2.0 flow from the workspace dashboard. Upon authorization on Facebook, the platform securely receives and exchanges the authorization code for a long-lived user access token (valid up to 60 days). The system records the Facebook account's identity (`fb_account_id`), display name, token validity period, and connection status, encrypting the access token with AES-256-GCM before persisting it in the database. When the user connects additional Facebook accounts, each new account is added alongside existing accounts without overriding or conflicting with previously connected accounts.

**Why this priority**: Users and agencies manage social media across multiple personal or client Facebook profiles. Enabling multi-account connection with isolated encrypted token storage is the core foundation for all downstream page discovery and publishing.

**Independent Test**: Can be tested by executing the OAuth connection flow for Account A and then executing it for Account B under the same tenant workspace, asserting that both accounts are persisted with `active` status, unique `fb_account_id` values, encrypted access tokens, and independent token lifecycles.

**Acceptance Scenarios**:

1. **Given** an authenticated tenant workspace user, **When** they initiate Facebook OAuth and authorize Account A, **Then** the platform exchanges the code for a long-lived access token, encrypts the token, and creates an account record for Account A under the user's tenant ID.
2. **Given** a workspace with Account A already connected, **When** the user initiates Facebook OAuth with Account B, **Then** Account B is created as an additional connected account under the same tenant workspace without overwriting Account A.
3. **Given** an already connected Facebook account (e.g. Account A), **When** the user re-authenticates Account A (reconnection/refresh), **Then** the system updates Account A's encrypted token and refreshed expiration timestamp without creating duplicate account rows.
4. **Given** an OAuth failure, user cancellation, or invalid code during an account connection attempt, **When** returned to the application, **Then** the system displays a clear error explanation and preserves all previously connected accounts without corruption.

---

### User Story 2 - Account Discovery & Granular Facebook Page Selection (Priority: P2)

Once one or more Facebook accounts are connected, the user can select any specific connected account to initiate a discovery scan of all Facebook Pages that account manages. The system uses that specific account's encrypted access token to query Facebook Graph API (`/me/accounts`), retrieving each Page's identity, page name, category, and publishing permissions. The user is presented with a list of discovered Pages and can explicitly select which Pages to import and activate in their workspace. For each selected Page, the system stores the Page metadata and the Page-specific access token (encrypted at rest), explicitly attributed to both the tenant workspace and the parent Facebook account. Unselected Pages remain unimported. Under no circumstances are Facebook Groups discovered, listed, or imported.

**Why this priority**: Users often manage dozens of personal or client pages across different accounts. Allowing granular page selection per account prevents workspace clutter and ensures only desired publishing destinations are activated.

**Independent Test**: Can be tested by querying page discovery for a specific connected account, asserting that the returned list displays authentic Facebook Pages, selecting a subset of pages, and verifying that only the chosen pages are imported with encrypted page access tokens and valid foreign keys to the parent Facebook account.

**Acceptance Scenarios**:

1. **Given** multiple connected Facebook accounts (e.g. Account A and Account B), **When** the user selects Account A to discover pages, **Then** the system queries Facebook using Account A's token and displays all manageable Pages belonging to Account A.
2. **Given** a list of discovered Facebook Pages for a chosen account, **When** the user selects one or more Pages and confirms import, **Then** the system persists each selected Page in the workspace linked to the parent Facebook account with an encrypted Page access token.
3. **Given** a Facebook Page that has already been imported into the tenant workspace, **When** discovery is run on any connected account that also manages that Page, **Then** the system identifies the Page as "Already Imported" and prevents duplicate duplicate records.
4. **Given** any connected Facebook account that manages or belongs to Facebook Groups, **When** the discovery scan runs, **Then** the system strictly excludes groups, returning only authentic Facebook Pages.

---

### User Story 3 - Multi-Account Health Monitoring, Token Expiration & Re-Authentication (Priority: P3)

The workspace dashboard provides a unified social accounts overview where users can view all connected Facebook accounts and their respective imported Pages. Each account and Page displays real-time operational status (`Active`, `Expired`, `Rate Limited`, `Disconnected`) and token expiration horizons. If Account A's token expires or is invalidated upstream (e.g. via password change), Account A is flagged with an expiration warning, while Account B and its associated Pages remain fully active and functional. Users can refresh or reconnect any individual account with a single click.

**Why this priority**: Long-lived Facebook user tokens expire after approximately 60 days, and upstream permission changes can invalidate tokens at any time. Multi-account health monitoring ensures partial credential failures do not halt operations for healthy accounts.

**Independent Test**: Can be tested by simulating an expired token on Account A while Account B remains valid, asserting that Account A displays "Expired" status and reconnection prompts while Account B and its pages remain "Active" and operational.

**Acceptance Scenarios**:

1. **Given** multiple connected accounts, **When** viewing the social accounts management interface, **Then** each account displays its display name, connection date, token expiration horizon, and current status badge.
2. **Given** Account A whose token has expired upstream, **When** status checks evaluate the workspace, **Then** Account A transitions to "Expired", while Account B remains "Active" and its publishing capabilities are unaffected.
3. **Given** an expired account, **When** the user completes a reconnection flow for that specific account, **Then** that account's token is refreshed, and its imported active Pages have their tokens restored to "Active".

---

### User Story 4 - Granular Disconnection & Isolated Multi-Tenant Governance (Priority: P4)

A user can disconnect an individual Facebook Page or an entire Facebook account at any time. Disconnecting a single Page safely purges its encrypted credentials without affecting any other Page or parent account. Disconnecting one Facebook account (e.g. Account A) detaches all Pages associated with Account A and permanently deletes Account A's stored tokens, while leaving Account B and all of Account B's Pages completely unaffected. Cross-tenant isolation is strictly enforced: users in Tenant 1 cannot view, discover, import, or disconnect accounts or Pages belonging to Tenant 2.

**Why this priority**: Users require granular control over their connected assets, along with absolute security guarantees that disconnecting one profile does not disrupt others, and that multi-tenant boundaries cannot be breached.

**Independent Test**: Can be tested by disconnecting one account out of multiple connected accounts, verifying that only that account's records and tokens are removed, and asserting that cross-tenant access attempts fail with authorization denials.

**Acceptance Scenarios**:

1. **Given** an imported Facebook Page, **When** the user confirms disconnection of that Page, **Then** the Page is detached and its encrypted access token is purged without affecting the parent Facebook account or sibling Pages.
2. **Given** multiple connected Facebook accounts (Account A with Pages 1 and 2, and Account B with Page 3), **When** the user disconnects Account A, **Then** Account A and Pages 1 and 2 are removed, while Account B and Page 3 remain active and untouched.
3. **Given** User 1 belonging to Tenant 1 and User 2 belonging to Tenant 2, **When** User 2 attempts to query, discover, or disconnect User 1's Facebook accounts or Pages, **Then** the system rejects the request with an authorization denial.

---

### Edge Cases

- **Multiple Account OAuth in Same Browser**: When a user connects Account A and then connects Account B, their browser may hold an active Facebook session for Account A. The OAuth flow must allow or prompt switching Facebook accounts, or handle the re-authorization cleanly.
- **Duplicate Account Reconnection**: If a user attempts to connect an account that is already connected to their tenant workspace, the system must detect the matching `(user_id, fb_account_id)` and update the existing account's credentials rather than inserting a duplicate record.
- **Cross-Account Page Overlap**: If Account A and Account B both have administrator access to the same Facebook Page, and the user already imported that Page under Account A, attempting to import it from Account B must recognize the existing `(user_id, fb_page_id)` constraint and either update the token association or inform the user that the Page is already active.
- **Partial Account Token Invalidation**: When one of multiple connected accounts has its token revoked by Facebook (e.g. OAuth error code 190), only that specific account and its linked pages transition to `expired` or `invalid_token`. Other accounts remain healthy.
- **Facebook API Rate Limiting**: If Graph API returns rate limit responses (e.g. codes 4/17/32 or `X-App-Usage` headers) during page discovery for an account, the system must back off and flag the affected account as `fb_rate_limited` without affecting other accounts.
- **Strict Exclusion of Facebook Groups**: Any Facebook Graph API responses containing group nodes or community objects must be strictly filtered out across all accounts; under no circumstances may groups be displayed, imported, or stored.
- **Zero-Plaintext Credential Leakage**: Under all circumstances, raw access tokens (user tokens and page tokens) must never appear in server log outputs, client JSON payloads, or error responses. All stored tokens must be symmetrically encrypted with AES-256-GCM before database persistence.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support connecting multiple distinct Facebook accounts per tenant workspace (1:N relationship between tenant `user_id` and `facebook_accounts`).
- **FR-002**: The system MUST provide an OAuth 2.0 authorization entry point with cryptographically secure `state` parameter verification to prevent CSRF attacks.
- **FR-003**: The system MUST request required Facebook Page publishing scopes (`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management`).
- **FR-004**: The system MUST exchange temporary authorization codes for long-lived Facebook User Access Tokens (valid up to 60 days) for each connected account.
- **FR-005**: The system MUST encrypt all Facebook user access tokens and Page access tokens at rest using AES-256-GCM encryption before database persistence.
- **FR-006**: The system MUST persist each connected account linked to the tenant `user_id`, enforcing compound uniqueness on `(user_id, fb_account_id)`.
- **FR-007**: The system MUST allow users to select any specific connected Facebook account and discover manageable Facebook Pages via Graph API `/me/accounts` using that account's token.
- **FR-008**: The system MUST allow users to selectively import specific Facebook Pages into their workspace, persisting Page details (`fb_page_id`, `page_name`, `followers_count`, `category`) and encrypted Page access tokens.
- **FR-009**: The system MUST enforce composite foreign key relationships on imported Pages `(user_id, facebook_account_id)` and compound uniqueness on `(user_id, fb_page_id)`.
- **FR-010**: The system MUST strictly exclude Facebook Groups from all discovery queries, selection interfaces, and database storage (Pages only).
- **FR-011**: The system MUST independently track operational status for each connected account (`active`, `expired`, `disconnected`) and each imported page (`active`, `fb_rate_limited`, `invalid_token`, `disconnected`).
- **FR-012**: The system MUST allow users to disconnect an individual Facebook account, safely detaching its linked pages and destroying its encrypted tokens, without affecting other connected accounts.
- **FR-013**: The system MUST allow users to disconnect individual Facebook Pages without affecting sibling pages or the parent Facebook account.
- **FR-014**: The system MUST sanitize all API responses and client view models to ensure zero exposure of raw access tokens or encryption keys.
- **FR-015**: The system MUST provide a multi-account workspace UI at `/tenant/[subdomain]/accounts` displaying all connected accounts, account switching/filtering, discovered page selection, and real-time connection health (UI slated for recreation following Taste Skill & Impeccable guidelines).

### Key Entities *(include if feature involves data)*

- **Facebook Account**: Represents an authorized Facebook user profile linked to a tenant workspace (1:N per tenant). Attributes: unique ID (UUID), tenant user ID (UUID), external Facebook user ID (`fb_account_id`), profile display name, connection status (`active`, `disconnected`, `expired`), token expiration timestamp, encrypted user access token, created/updated timestamps.
- **Facebook Page**: Represents a specific Facebook Page authorized for video publishing (N:1 to Facebook Account, N:1 to Tenant). Attributes: unique ID (UUID), tenant user ID (UUID), parent Facebook account reference (`facebook_account_id`), external Facebook Page ID (`fb_page_id`), page name, follower count, status (`active`, `fb_rate_limited`, `invalid_token`, `disconnected`), encrypted page access token, created/updated timestamps.
- **OAuth Session State**: Ephemeral state payload for CSRF verification, storing target tenant workspace and timestamp during the OAuth redirect round-trip.
- **Discovered Page (Transient)**: In-memory representation of Facebook Pages returned by Graph API `/me/accounts` prior to explicit user import.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can connect multiple distinct Facebook accounts to a single workspace with zero account collisions.
- **SC-002**: Users can complete OAuth connection and token exchange in under 30 seconds per account.
- **SC-003**: 100% of persisted Facebook account and Page access tokens are encrypted using AES-256-GCM before database insertion.
- **SC-004**: 100% of discovered Facebook Pages can be selectively imported per account, with zero Facebook Groups displayed or imported.
- **SC-005**: Disconnecting one Facebook account has zero impact on other connected accounts or their imported pages.
- **SC-006**: 0% cross-tenant data leakage: users can never view, import, or manage Facebook accounts or Pages belonging to another tenant.
- **SC-007**: 0 raw access tokens, client secrets, or cryptographic keys are leaked in client responses, logs, or error envelopes.
- **SC-008**: Complete test coverage across contracts, database migrations, encryption utilities, and route handlers with 100% pass rate.

## Assumptions

- Facebook App credentials (`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, redirect URI) are provided via secure environment variables.
- Token encryption uses AES-256-GCM with a dedicated 256-bit encryption key (`TOKEN_ENCRYPTION_KEY`) using native Web Crypto APIs to ensure Edge runtime compatibility.
- Discovered Facebook Pages are fetched on demand when the user requests discovery for a specific account, rather than auto-importing all pages.
- Token refresh or re-connection uses Facebook Graph API v26.0 or current standard endpoints.
- All operations are scoped to the active tenant session verified via the middleware authentication guard established in Spec 002.
