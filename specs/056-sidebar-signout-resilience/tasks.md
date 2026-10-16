# Implementation Tasks: Spec 056 Sidebar Sign-Out Resilience

## Phase 1: Domain Routing & Server Endpoint Hardening (US3)

- [x] T001 [US3] Harden `resolveRequestGatewayBase` in `packages/contracts/src/domain/routing.ts` to adapt `cleanRoot` to `'localhost'` when `cleanHost` is local and `cleanRoot` is default non-local, preventing invalid hybrid hosts (`app.fbuploadpro.com:3000`).
- [x] T002 [US3] Align default fallback `rootDomain` in `apps/web/src/app/api/auth/logout/route.ts` to `process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'`.
- [x] T003 [US3] Add contract unit tests in `packages/contracts/tests/routing.test.ts` verifying `buildCentralAppUrl` local host fallback without explicit root domain.

## Phase 2: Sidebar Studio Footer Asynchronous Sign-Out UX & Lifecycle (US1 & US2)

- [x] T004 [US1, US2] Update `PopoverMenuActions` in `apps/web/src/components/workspace/workspace-studio-footer.tsx` to receive `isSigningOut`, render "Signing out..." copy, disable button during transit, and apply disabled styles.
- [x] T005 [US1, US2] Update `WorkspaceStudioFooter` in `apps/web/src/components/workspace/workspace-studio-footer.tsx` with `isSigningOut` state, dismiss popover, execute asynchronous `handleSignOut` calling `POST /api/auth/logout` with `keepalive: true`, clear client session cookies, broadcast logout, and navigate to returned `redirectUrl` with resilient fallback.

## Phase 3: Automated Test Verification & Documentation Synchronization (US4)

- [x] T006 [US4] Add comprehensive unit test suite in `apps/web/tests/ui/workspace-studio-footer.test.tsx` verifying API dispatch, "Signing out..." state, error resilience, and redirect handling.
- [x] T007 [US4] Synchronize architectural documentation in `docs/foundational-knowledge.md` under Section 22 documenting Spec 056.
