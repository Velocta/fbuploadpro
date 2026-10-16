# Spec 056: Sidebar Sign-Out Resilience & Cross-Environment Logout Gateway

## 1. Executive Summary
This specification defines the remediation and hardening of the authentication sign-out flow triggered from the workspace sidebar studio footer (`WorkspaceStudioFooter` in `apps/web/src/components/workspace/workspace-studio-footer.tsx`). 

Previously, clicking the sidebar sign-out button executed a synchronous, client-only stub that never invoked the server-side logout route (`/api/auth/logout`). Because the primary session cookie `fbup_session` is `httpOnly`, client-side `document.cookie` cannot clear it, leaving the user's session active and causing `middleware.ts` to immediately bounce the user back into their workspace. Furthermore, client-side URL construction via `buildCentralAppUrl` improperly combined `localhost` with the default root domain `fbuploadpro.com`, producing unresolvable URLs (`app.fbuploadpro.com:3000`) that resulted in `ERR_NAME_NOT_RESOLVED` browser errors.

This specification:
1. Replaces the synchronous stub in `WorkspaceStudioFooter` with an asynchronous, state-managed sign-out handler calling `POST /api/auth/logout` with `keepalive: true`.
2. Adds explicit loading and disabled states (`isSigningOut`) with "Signing out..." copy and accessible button states.
3. Hardens `packages/contracts/src/domain/routing.ts` (`buildCentralAppUrl`) to prevent invalid hybrid host generation (`app.fbuploadpro.com:3000`) when running locally without explicit root domain configuration.
4. Harmonizes `apps/web/src/app/api/auth/logout/route.ts` default root domain fallback to `'localhost:3000'` to match the rest of the application.
5. Implements comprehensive unit and contract tests verifying API dispatch, cookie invalidation, and fallback routing.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Reliable Sidebar Sign-Out & Backend Session Invalidation (P1)
**As an** authenticated workspace operator,  
**I want** clicking "Sign Out" in the sidebar footer dropdown to terminate my session both on the server and in the browser,  
**So that** I am safely and completely logged out across all tabs without being bounced back into the workspace.

- **Acceptance Criteria**:
  - `handleSignOut` in `WorkspaceStudioFooter` is asynchronous.
  - It dispatches a `POST` request to `/api/auth/logout` with `keepalive: true`.
  - The server invalidates the Supabase session (`supabase.auth.signOut()`) and returns response cookies expiring `fbup_session` (`Max-Age=0`).
  - It broadcasts the `LOGOUT` event across tabs via `broadcastLogout()`.
  - It clears client-accessible cookies and redirects the browser to `data.redirectUrl` returned by `/api/auth/logout`.
  - If the network request fails or the user is offline, it gracefully falls back to canonical client-side redirection via `redirectToLogout()`.

### User Story 2: Professional Asynchronous Sign-Out UX & Race-Condition Prevention (P1)
**As a** workspace user clicking "Sign Out",  
**I want** immediate, clear visual feedback that sign-out is in progress,  
**So that** I know the system is working and cannot accidentally click multiple times.

- **Acceptance Criteria**:
  - The "Sign Out" button transitions text from "Sign Out" to "Signing out..." when clicked.
  - The button is disabled (`disabled={isSigningOut}` and `aria-disabled="true"`) to prevent duplicate clicks and race conditions.
  - Cursor updates to `not-allowed` and opacity reduces subtly while in progress.
  - The dropdown popover menu is dismissed or locked during transit to prevent erratic UI states.

### User Story 3: Resilient Gateway URL Construction Across Local, Preview, and Production (P1)
**As a** developer or user in local development, Vercel preview, or production,  
**I want** sign-out redirection to always resolve to a valid, reachable host,  
**So that** I never encounter `ERR_NAME_NOT_RESOLVED` or unresolvable port collisions like `app.fbuploadpro.com:3000`.

- **Acceptance Criteria**:
  - In `packages/contracts/src/domain/routing.ts`, `resolveRequestGatewayBase` guards against mixing local hosts (`localhost`, `127.0.0.1`, `*.localhost`) with external production root domains (`fbuploadpro.com`).
  - If `cleanHost` is local and `cleanRoot` is not local (e.g. defaulted to `fbuploadpro.com`), the function adapts `effectiveRoot` to `'localhost'`, producing `http://app.localhost:${port}` (or local origin) rather than `http://app.fbuploadpro.com:3000`.
  - On `.vercel.app` preview deployments, redirection continues to preserve the preview origin (`https://preview-deploy.vercel.app/login?logout=success`).
  - In production (`fbuploadpro.com` / `vinsmokemedia.online`), redirection continues to route canonically to `https://app.{rootDomain}/login?logout=success`.
  - In `apps/web/src/app/api/auth/logout/route.ts`, fallback `rootDomain` is aligned to `'localhost:3000'`.

### User Story 4: Automated Verification & Regression Prevention (P1)
**As a** software engineer maintaining FBUploadPro,  
**I want** unit tests covering sidebar sign-out and gateway URL construction,  
**So that** regressions in session termination or domain resolution are caught automatically.

- **Acceptance Criteria**:
  - Unit tests in `apps/web/tests/ui/` verify that clicking the sign-out button triggers `fetch('/api/auth/logout', ...)`, shows the signing out state, and navigates to the returned redirect URL.
  - Contract routing tests in `packages/contracts/tests/routing.test.ts` verify that `buildCentralAppUrl` produces valid URLs when called from `http://localhost:3000` without explicit `rootDomain`.

---

## 3. Success Criteria
1. **Zero Session Leakage**: `fbup_session` is terminated by the server and Supabase session is revoked upon sign-out.
2. **Zero DNS / Gateway Failures**: Redirections on `localhost`, `.vercel.app`, and production environments always resolve to valid, active hosts without `ERR_NAME_NOT_RESOLVED`.
3. **Impeccable UX**: Clear "Signing out..." indicator and disabled button state during asynchronous sign-out.
4. **All Tests Green**: 100% pass rate across monorepo test suites in CI.
