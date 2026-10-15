# Feature Specification: 047 Workspace Subdomain BYOC OAuth Alignment

**Feature Directory**: `specs/047-workspace-subdomain-oauth`  
**Feature Branch**: `feat/047-workspace-subdomain-oauth`  
**Status**: In Progress  
**Created**: 2026-10-15  
**Source**: User Request ("no i want it to be users workspace subdomain just like its showing in the UI implement this using SDD")  
**Constitution Authority**: Principle 20 (Dedicated Facebook Accounts Management Section & Dual-Mode Multi-Browser Connection Architecture) & Principle 24 (Tenant Data Isolation)

---

## 1. Executive Summary & Problem Statement

In FBUploadPro's multi-tenant architecture, workspace operators configure Bring Your Own Credentials (BYOC) by providing their own Meta Developer App ID and App Secret. In the Settings UI (`apps/web/src/components/settings/byoc-settings-view.tsx`), the "Valid OAuth Redirect URI" helper card displays the workspace's canonical subdomain URL:
```text
https://{subdomain}.vinsmokemedia.online/api/auth/facebook/callback
```
However, the backend OAuth initiation routes (`/api/auth/facebook` and `/connect/facebook`) previously hardcoded:
```ts
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const redirectUri = `${appUrl}/api/auth/facebook/callback`;
```
which in production sent Facebook `redirect_uri=https://app.vinsmokemedia.online/api/auth/facebook/callback`.

Because Meta OAuth requires an exact string match between the URI whitelisted in the Meta Developer Portal, the `redirect_uri` sent to the OAuth dialog, and the `redirect_uri` sent during code-for-token exchange:
1. Operators who followed the UI instructions and whitelisted their workspace subdomain URL encountered Meta OAuth errors (`URL Blocked: This redirect failed because the redirect URI is not whitelisted...`).
2. Even if whitelisted, the flow bypassed the tenant's clean subdomain callback URL.

This specification aligns the entire OAuth pipeline so that **the workspace subdomain URL (`https://{subdomain}.{rootDomain}/api/auth/facebook/callback`) is the single canonical redirect URI** used in the UI, sent to Meta's OAuth dialog, signed into the state envelope, and supplied to Meta Graph API during token exchange.

---

## 2. User Scenarios & Prioritized User Stories

### User Story 1 (P1): Subdomain-Targeted Direct OAuth Initiation
**As a** workspace operator clicking "Connect Facebook Account",  
**I want** the OAuth flow to register my workspace subdomain (`https://{subdomain}.{rootDomain}/api/auth/facebook/callback`) as the `redirect_uri` in Facebook's OAuth dialog,  
**So that** Facebook redirects directly to my workspace subdomain and matches the "Valid OAuth Redirect URI" configured in my Meta Developer App.

**Acceptance Scenarios**:
1. **Given** a user in workspace `shahzebpycozgy` on `rootDomain = "vinsmokemedia.online"`,  
   **When** they initiate OAuth at `/api/auth/facebook`,  
   **Then** the redirect URL to `https://www.facebook.com/v26.0/dialog/oauth` includes `redirect_uri=https%3A%2F%2Fshahzebpycozgy.vinsmokemedia.online%2Fapi%2Fauth%2Ffacebook%2Fcallback`.
2. **Given** a local development or preview deployment without root domain subdomains,  
   **When** they initiate OAuth,  
   **Then** the redirect URI cleanly falls back to the current origin `/api/auth/facebook/callback` or `/tenant/{subdomain}/api/auth/facebook/callback` via `buildTenantUrl`.

---

### User Story 2 (P1): Exact Redirect URI Token Exchange & Subdomain Landing
**As a** workspace operator completing Facebook authorization,  
**When** Facebook redirects back to `https://{subdomain}.{rootDomain}/api/auth/facebook/callback?code=...&state=...`,  
**Then** the callback exchanges the code using the exact workspace subdomain `redirect_uri` that was initiated, saves the account under the workspace, refreshes page tokens, and lands cleanly on `/accounts?connected=1` on that same subdomain.

**Acceptance Scenarios**:
1. **Given** an authorization code from Facebook with signed state containing `tenantSubdomain: "shahzebpycozgy"` and `redirectUri: "https://shahzebpycozgy.vinsmokemedia.online/api/auth/facebook/callback"`,  
   **When** `/api/auth/facebook/callback` executes,  
   **Then** `POST https://graph.facebook.com/v26.0/oauth/access_token` is called with `redirect_uri = "https://shahzebpycozgy.vinsmokemedia.online/api/auth/facebook/callback"`.
2. **Given** a legacy state envelope without `redirectUri`,  
   **When** the callback executes,  
   **Then** it deterministically reconstructs the workspace subdomain redirect URI via `buildTenantUrl(statePayload.tenantSubdomain, '/api/auth/facebook/callback', request.url, rootDomain)` and successfully completes exchange.
3. **Given** a completed token exchange,  
   **When** the user is redirected to their workspace,  
   **Then** they land on `https://{subdomain}.{rootDomain}/accounts?connected=1`.

---

### User Story 3 (P2): Consistent Magic Link & BYOC Settings Copy Helpers
**As a** workspace operator configuring Meta BYOC in Settings or connecting via Magic Link,  
**I want** the copyable helper in Settings and the Magic Link OAuth flow to use the exact workspace subdomain callback URI,  
**So that** copying the URI into Meta App Settings is 100% reliable and matches all connection methods.

**Acceptance Scenarios**:
1. **Given** the operator visits `/settings?tab=byoc` on `https://{subdomain}.{rootDomain}`,  
   **When** viewing the "Valid OAuth Redirect URI",  
   **Then** the copy box displays `https://{subdomain}.{rootDomain}/api/auth/facebook/callback` (handling protocol and port gracefully in both production and development).
2. **Given** a Magic Link connection initiated via `/connect/facebook?token=...`,  
   **When** the user opens the link on a secondary device,  
   **Then** the OAuth dialog and callback are similarly anchored to the workspace's subdomain callback URL.

---

## 3. Requirements

### Functional Requirements
- **FR-001**: `packages/contracts` MUST extend `OAuthStatePayloadSchema` to support an optional `redirectUri: z.string().url().optional()`.
- **FR-002**: `apps/web/src/app/api/auth/facebook/route.ts` MUST compute `redirectUri` using `buildTenantUrl(session.subdomain, '/api/auth/facebook/callback', request.url, rootDomain).toString()`, embed it in the signed `OAuthStatePayload`, and set it on the Facebook OAuth dialog URL.
- **FR-003**: `apps/web/src/app/connect/facebook/route.ts` MUST compute `redirectUri` using `buildTenantUrl(payload.tenantSubdomain, '/api/auth/facebook/callback', request.url, rootDomain).toString()`, embed it in the signed `OAuthStatePayload`, and set it on the Facebook OAuth dialog URL.
- **FR-004**: `apps/web/src/app/api/auth/facebook/callback/route.ts` MUST extract `redirectUri` from the verified `OAuthStatePayload` (falling back to `buildTenantUrl(statePayload.tenantSubdomain, '/api/auth/facebook/callback', request.url, rootDomain).toString()` or `process.env.NEXT_PUBLIC_APP_URL`) and supply it to `https://graph.facebook.com/v26.0/oauth/access_token`.
- **FR-005**: `apps/web/src/components/settings/byoc-settings-view.tsx` MUST construct `redirectUri` and `webhookUrl` reliably using `window.location.origin` (or protocol + host) when in a browser environment, maintaining exact visual and functional consistency with the backend.

---

## 4. Edge Cases & Resilience

- **Apex Domain / Localhost**: On `localhost:3000` or local dev without wildcard DNS, `buildTenantUrl` falls back to `/tenant/{subdomain}/api/auth/facebook/callback` or `http://localhost:3000/api/auth/facebook/callback` cleanly, preserving test suite compatibility.
- **Legacy States**: Any OAuth flow initiated before this change (or missing `redirectUri` in state) will gracefully reconstruct the tenant redirect URI or fall back to `NEXT_PUBLIC_APP_URL` without throwing exceptions.
- **State Tampering**: `redirectUri` inside the state envelope is protected by HMAC-SHA256 signature verification (`signOAuthState` / `verifyOAuthState`); if the state is altered, verification fails immediately.
