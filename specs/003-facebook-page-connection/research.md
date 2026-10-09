# Research: Facebook Graph API OAuth & Multi-Account Social Connection

This document details the architectural decisions, trade-offs, and technical rationale for Spec 003: Facebook Graph API OAuth & Multi-Account Social Connection.

---

## 1. Multi-Account Facebook OAuth 2.0 & CSRF State Verification

### Decision
Implement standard Facebook OAuth 2.0 authorization code flow with signed, tamper-proof state parameters:
1. **OAuth Dialog URL**:
   ```text
   https://www.facebook.com/v26.0/dialog/oauth?
     client_id={FACEBOOK_APP_ID}&
     redirect_uri={ENCODED_REDIRECT_URI}&
     state={SIGNED_STATE}&
     scope=pages_show_list,pages_read_engagement,pages_manage_posts,business_management&
     response_type=code
   ```
2. **State Envelope & CSRF Protection**:
   Generate an ephemeral state envelope containing `{ tenantSubdomain, userId, nonce, iat, exp }`. Sign the payload using native HMAC-SHA256 (`crypto.subtle`), identical to the session token signing standard established in Spec 002.
3. **State Verification**:
   Upon callback, the system verifies the HMAC signature and expiration (<10 minutes), asserts that `userId` and `tenantSubdomain` match the active session, preventing CSRF and login injection attacks.
4. **Multi-Account Handling**:
   Facebook OAuth dialog allows connecting different Facebook accounts. Connecting Account A, followed by Account B, results in distinct authorization codes corresponding to distinct Facebook user profiles.

### Rationale
- Stateless CSRF defense: Eliminates server-side session stores for OAuth state while guaranteeing the callback originates from the same authenticated tenant session.
- Seamless multi-account onboarding: Each successful OAuth authorization represents a discrete external Facebook user profile linked to the tenant's workspace.

### Alternatives Considered
- **Plain Random Nonce in Cookie**: Does not bind the OAuth callback to the specific tenant subdomain and user identity, risking session fixation.
- **Client-Side Facebook JavaScript SDK**: Exposes Facebook App credentials to the browser, violates server-side credential isolation, and is fragile in edge/hybrid environments.

---

## 2. Graph API Token Exchange: Code -> Short-Lived -> Long-Lived (60-Day) Token

### Decision
Implement two-stage token exchange in server-side route handlers:
1. **Stage 1 (Code Exchange)**:
   POST to `https://graph.facebook.com/v26.0/oauth/access_token`:
   - `client_id`: Facebook App ID
   - `client_secret`: Facebook App Secret
   - `redirect_uri`: Configured callback URL
   - `code`: Temporary authorization code from callback
   Returns: Short-lived user access token (valid ~1-2 hours).
2. **Stage 2 (Long-Lived Token Exchange)**:
   GET to `https://graph.facebook.com/v26.0/oauth/access_token`:
   - `grant_type`: `fb_exchange_token`
   - `client_id`: Facebook App ID
   - `client_secret`: Facebook App Secret
   - `fb_exchange_token`: Short-lived user access token
   Returns: Long-lived user access token with `expires_in` (~60 days = 5,184,000 seconds).
3. **User Profile Retrieval**:
   GET to `https://graph.facebook.com/v26.0/me?fields=id,name`:
   Extracts `fb_account_id` and profile `display_name`.

### Rationale
- 60-day longevity: Long-lived tokens prevent frequent session expirations and enable reliable automated background publishing.
- Safe server-side exchange: Client secrets and temporary tokens never touch the client browser.

### Alternatives Considered
- **Using Short-Lived Tokens Directly**: Unacceptable for automated scheduling; would require user re-authentication every 2 hours.
- **Permanent System User Tokens**: Only applicable for platform-owned Business Managers, not applicable for multi-tenant users managing their own personal and client Facebook Pages.

---

## 3. Zero-Trust Token Encryption via Native Web Crypto API (AES-256-GCM)

### Decision
Encrypt all access tokens (Facebook user tokens and Page access tokens) using **AES-256-GCM** with the **Web Crypto API (`crypto.subtle`)**:
1. **Key Management**:
   A 256-bit symmetric encryption key (`TOKEN_ENCRYPTION_KEY`, 64 hex characters or 32 raw bytes) configured via environment variables.
2. **Encryption Process**:
   - Generate a cryptographically random 12-byte Initialization Vector (IV): `crypto.getRandomValues(new Uint8Array(12))`.
   - Encrypt token plaintext using `crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)`.
   - Serialize into a standard format: `iv:ciphertext:tag` (in hex or base64url).
3. **Decryption Process**:
   - Parse IV and ciphertext.
   - Decrypt with `crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)`.
   - Return decrypted token only in isolated backend services when actively communicating with Graph API.

### Rationale
- **Principle II & IV Compliance**: Native Web Crypto API (`crypto.subtle`) works uniformly in Node.js, Next.js Edge Runtime, and Cloudflare Workers without native OpenSSL or Node TCP bindings.
- **Authenticated Encryption**: AES-256-GCM provides both confidentiality and data authenticity (tamper-proofing) through authentication tags.
- **Zero Exposure**: Raw tokens are never stored in plaintext in PostgreSQL, and never serialized into client-facing JSON view models or diagnostic logs.

### Alternatives Considered
- **PostgreSQL `pgcrypto` (`pgp_sym_encrypt`)**: Binds encryption to database queries, leaking encryption keys in SQL queries and connection parameters.
- **Node.js `crypto.createCipheriv`**: Fails in Cloudflare Workers and Edge Runtime due to lack of Node stream bindings.

---

## 4. Facebook Page Discovery (`/me/accounts`) & Strict Groups Exclusion

### Decision
Implement account-specific Page discovery and user-driven selective import:
1. **Discovery Endpoint**:
   GET `https://graph.facebook.com/v26.0/me/accounts?fields=id,name,category,tasks,access_token,followers_count`:
   - Authenticated with the specific Facebook account's decrypted access token.
   - Returns all Pages where the user has administrative or task-based permissions.
2. **Strict Facebook Groups Exclusion**:
   - The platform exclusively queries `/me/accounts` (Facebook Pages).
   - Under no circumstances is `/me/groups` queried, and any legacy group entities are rejected.
   - The UI and domain contracts only define `FacebookPage`, with zero group models or endpoints.
3. **Selective Import Process**:
   - Discovered Pages are presented to the user with status: "New" or "Already Imported".
   - The user selects one or more Pages to import.
   - For each selected Page:
     * Extract Page Access Token (`access_token` returned by `/me/accounts` for that page).
     * Symmetrically encrypt the Page Access Token using AES-256-GCM.
     * Persist to `facebook_pages` linked to `(user_id, facebook_account_id)`.
     * Store metadata: `page_name`, `followers_count`, `category`, `tasks`.

### Rationale
- User Autonomy: Users who manage dozens of pages across different clients only import the pages relevant to their current workspace.
- Indefinite Page Token Validity: When derived from a long-lived user token, Page access tokens do not expire unless the user changes their password or revokes the app permissions.
- Absolute Scope Boundaries: Eliminates ambiguity and deprecation risks associated with Facebook Groups API.

### Alternatives Considered
- **Auto-import All Pages**: Causes workspace clutter, excessive token storage, and potential permission confusion for users with many irrelevant pages.
- **Requesting Individual Page Tokens via Page ID**: Redundant since `/me/accounts` already returns Page access tokens for all authorized pages in a single call.

---

## 5. Multi-Account Tenant Architecture & Composite Isolation

### Decision
Enforce a 1:N multi-account hierarchy per tenant workspace:
- `users (tenant)` 1:N `facebook_accounts` (`user_id`)
- `facebook_accounts` 1:N `facebook_pages` (`(user_id, facebook_account_id)`)
- Constraints:
  * `uq_fb_accounts_user_account UNIQUE (user_id, fb_account_id)`: A tenant can connect multiple distinct Facebook accounts, but cannot duplicate the same account.
  * `uq_fb_pages_user_page UNIQUE (user_id, fb_page_id)`: A tenant cannot import duplicate page instances, guaranteeing unambiguous publishing targets.
  * `fk_fb_pages_user_account FOREIGN KEY (user_id, facebook_account_id)`: Enforces composite foreign key defense-in-depth, preventing cross-tenant account-page leakage.
- Disconnection Isolation:
  * Disconnecting an individual Page purges its encrypted token and marks it disconnected / deleted.
  * Disconnecting Account A cascades only to Account A's Pages, leaving Account B and its Pages fully operational.

### Rationale
- Supports modern social media agency workflows where multiple client or staff accounts manage different brand assets under one workspace.
- Guarantees strict multi-tenant boundary isolation without cross-tenant leakage.

---

## 6. Health Monitoring, Token Lifecycle & Error Handling

### Decision
Implement structured error handling and lifecycle status tracking:
1. **OAuth Error 190 (Invalid/Expired Token)**:
   - When Graph API responds with error subcode 458 (app uninstalled), 460 (password changed), or 463 (token expired):
   - Transition account status to `expired`.
   - Transition linked pages to `invalid_token`.
   - Display prominent reconnection banner in workspace.
2. **Graph API Rate Limiting (Codes 4, 17, 32)**:
   - Transition page/account status to `fb_rate_limited`.
   - Prevent background automated retries until rate limit backoff period elapses.
3. **Zero Plaintext Leakage**:
   - All client responses, view models, and error envelopes strip encrypted and raw token fields.
   - Logs never record token values, HTTP Authorization headers, or decryption keys.
