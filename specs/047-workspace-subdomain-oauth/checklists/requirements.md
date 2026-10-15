# Requirements Checklist: 047 Workspace Subdomain BYOC OAuth Alignment

**Feature Directory**: `specs/047-workspace-subdomain-oauth`  
**Status**: Completed  

---

## 1. Domain & Routing Requirements
- [x] `OAuthStatePayloadSchema` accepts optional `redirectUri: z.string().url().optional()`.
- [x] `/api/auth/facebook` constructs `redirectUri` using `buildSubdomainOAuthRedirectUri(session.subdomain, request.url, rootDomain, appUrlFallback)` when initiating OAuth.
- [x] `/api/auth/facebook` embeds `redirectUri` into the signed `OAuthStatePayload`.
- [x] `/api/auth/facebook` sets `redirect_uri` in the query parameters sent to Meta's OAuth dialog.
- [x] `/connect/facebook` (Magic Link flow) constructs `redirectUri` using `buildSubdomainOAuthRedirectUri(payload.tenantSubdomain, request.url, rootDomain, appUrlFallback)`.
- [x] `/connect/facebook` embeds `redirectUri` into the signed `OAuthStatePayload`.
- [x] `/api/auth/facebook/callback` extracts `redirectUri` from verified `statePayload`.
- [x] `/api/auth/facebook/callback` uses the extracted `redirectUri` when calling Meta Graph API `/oauth/access_token`.
- [x] `/api/auth/facebook/callback` falls back gracefully to `buildSubdomainOAuthRedirectUri` or `NEXT_PUBLIC_APP_URL` if `redirectUri` is missing from legacy state.
- [x] `BYOCSettingsView` computes `redirectUri` and `webhookUrl` safely using `window.location.origin` (or host/protocol) in browser context.

## 2. Multi-Tenant Security & Isolation
- [x] `redirectUri` is protected inside HMAC-SHA256 signed `state` payload to prevent open redirect tampering.
- [x] Tokens are isolated strictly per `workspace_id`.
