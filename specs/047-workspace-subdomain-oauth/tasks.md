# Implementation Tasks: 047 Workspace Subdomain BYOC OAuth Alignment

**Feature Directory**: `specs/047-workspace-subdomain-oauth`  
**Status**: Implemented & Converged  

---

## Task Breakdown

### Phase 1: Shared Contracts
- [x] **T001 [P1]**: Update `OAuthStatePayloadSchema` in `packages/contracts/src/domain/oauth.ts` to include `redirectUri: z.string().url().optional()`.
- [x] **T002 [P1]**: Add unit tests in `packages/contracts/tests/oauth.test.ts` verifying `redirectUri` schema parsing and state signing/verification.

### Phase 2: Backend OAuth Initiation & Callback
- [x] **T003 [P1]**: Update `apps/web/src/app/api/auth/facebook/route.ts` to dynamically construct `redirectUri` using `buildSubdomainOAuthRedirectUri(session.subdomain, request.url, rootDomain, appUrlFallback)`, embed in `state`, and set on Meta dialog URL.
- [x] **T004 [P1]**: Update `apps/web/src/app/connect/facebook/route.ts` to dynamically construct `redirectUri` using `buildSubdomainOAuthRedirectUri(payload.tenantSubdomain, request.url, rootDomain, appUrlFallback)`, embed in `state`, and set on Meta dialog URL.
- [x] **T005 [P1]**: Update `apps/web/src/app/api/auth/facebook/callback/route.ts` to resolve `effectiveRedirectUri` from `statePayload.redirectUri` (with fallback to `buildSubdomainOAuthRedirectUri` or `appUrl`) and supply it in token exchange POST to `https://graph.facebook.com/v26.0/oauth/access_token`.

### Phase 3: Frontend Settings & Tests
- [x] **T006 [P1]**: Update `apps/web/src/components/settings/byoc-settings-view.tsx` to compute `redirectUri` and `webhookUrl` using `window.location.origin` (or host/protocol) in browser context.
- [x] **T007 [P1]**: Update tests in `apps/web/tests/api/auth-facebook.test.ts` to verify subdomain-targeted `redirect_uri` in both authorization URL and token exchange.

### Phase 4: Documentation & Synchronization
- [x] **T008 [P1]**: Update `docs/foundational-knowledge.md` to document the workspace subdomain BYOC OAuth architecture and exact redirect URI alignment.
