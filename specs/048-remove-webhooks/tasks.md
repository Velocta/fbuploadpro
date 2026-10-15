# Implementation Tasks: Complete Elimination of Webhooks

**Feature**: Complete Elimination of Webhooks  
**Branch**: `feat/048-remove-webhooks`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Validate workspace status and inspect existing webhook references across packages and apps.

- [x] T001 Inspect all remaining occurrences of `webhook_verify_token`, `webhookVerifyToken`, and `webhookUrl` in `packages/contracts` and `apps/web`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the forward database migration and update the shared contract schemas that all UI, API, and resolver layers depend upon.

**⚠️ CRITICAL**: Must be completed before API routes, resolvers, and UI components can be updated to match the clean schemas.

- [x] T002 [P] Create forward database migration `supabase/migrations/20261020000000_drop_byoc_webhook_verify_token.sql` dropping column `webhook_verify_token` from `workspace_byoc_credentials`
- [x] T003 [P] Remove `webhookVerifyToken` from `BYOCCredentialsViewSchema` and `SaveBYOCCredentialsRequestSchema` in `packages/contracts/src/domain/workspace.ts`
- [x] T004 [P] Remove `webhook_verify_token` from `workspace_byoc_credentials` Row and Insert types in `packages/contracts/src/domain/database.ts`

**Checkpoint**: Foundation ready - database migration and core schema types updated.

---

## Phase 3: User Story 1 - Simplified Meta App Settings UI (Priority: P1) 🎯 MVP

**Goal**: Remove all webhook callback URL displays, copy buttons, and webhook instructions from the Meta App Setup UI in Workspace Settings.

**Independent Test**: Mount `byoc-settings-view` and assert that only the OAuth Redirect URI copy box is displayed and no "Webhook Callback URL" or webhook token elements are rendered.

### Implementation for User Story 1

- [x] T005 [US1] Remove `webhookUrl` prop and Webhook Callback URL copy box from `MetaAppSetupSection` in `apps/web/src/components/settings/byoc-settings-view.tsx`
- [x] T006 [US1] Update UI unit test harness in `apps/web/tests/ui/byoc-settings.test.tsx` to remove `webhookUrl` prop and assert absence of webhook callback text

**Checkpoint**: User Story 1 complete - Meta App Settings UI only displays OAuth Redirect URI.

---

## Phase 4: User Story 2 - Purge Webhook Columns & Backend Handlers (Priority: P1)

**Goal**: Drop `webhook_verify_token` handling and resolution logic from the backend BYOC resolver and settings API route.

**Independent Test**: Call `GET /api/tenant/[subdomain]/settings/byoc` and `POST /api/tenant/[subdomain]/settings/byoc` and verify responses and payloads do not contain `webhookVerifyToken`, and verify `byoc-resolver` returns clean credentials without webhook verify tokens.

### Implementation for User Story 2

- [x] T007 [P] [US2] Update `apps/web/src/lib/server/byoc-resolver.ts` to remove `webhookVerifyToken` from `WorkspaceBYOCCredentials` interface and remove `webhook_verify_token` from SQL queries
- [x] T008 [P] [US2] Update `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/route.ts` to remove `webhook_verify_token` from select query and update mutations
- [x] T009 [P] [US2] Update resolver unit tests in `apps/web/tests/lib/byoc-resolver.test.ts` to remove webhook verify token fixtures and assertions
- [x] T010 [P] [US2] Update settings API unit tests in `apps/web/tests/api/byoc-settings-api.test.ts` to remove webhook verify token assertions

**Checkpoint**: User Story 2 complete - API routes and server resolvers are completely free of webhook logic.

---

## Phase 5: User Story 3 - Contracts Cleanliness & Subdomain Purge (Priority: P2)

**Goal**: Remove `'webhook'` from `RESERVED_SUBDOMAINS` in `@fbuploadpro/contracts` and update all security/auth tests that reserved `'webhook'`.

**Independent Test**: Assert that `SubdomainSchema.safeParse('webhook').success` evaluates to `true` and that `BYOCCredentialsViewSchema.safeParse` succeeds without `webhookVerifyToken`.

### Implementation for User Story 3

- [x] T011 [P] [US3] Remove `'webhook'` from `RESERVED_SUBDOMAINS` in `packages/contracts/src/domain/user.ts`
- [x] T012 [P] [US3] Update workspace contract tests in `packages/contracts/tests/workspace.test.ts` to remove `webhookVerifyToken`
- [x] T013 [P] [US3] Update auth hardening test in `packages/contracts/tests/auth-hardening.test.ts` to remove assertion that `webhook@gmail.com` throws reserved subdomain error
- [x] T014 [P] [US3] Update Gmail canonicalization test in `apps/web/tests/security/gmail-canonicalization-bounds.test.ts` to remove assertion that `webhook@gmail.com` throws reserved subdomain error
- [x] T015 [P] [US3] Update workspace ownership hijack test in `apps/web/tests/security/workspace-ownership-hijack.test.ts` to remove `webhook_verify_token` mock fields

**Checkpoint**: User Story 3 complete - `'webhook'` is removed from reserved subdomains and all contract tests pass.

---

## Phase 6: Polish & Documentation

**Purpose**: Update architectural documentation and roadmap milestones.

- [x] T016 [P] Update `docs/foundational-knowledge.md` to document the complete elimination of webhooks (Spec 048) and update milestone status
- [x] T017 Verify full compliance with `specs/048-remove-webhooks/quickstart.md` and finalize spec artifacts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - Phase 3 (US1 - UI) and Phase 4 (US2 - Backend) can proceed in parallel once Phase 2 is complete
  - Phase 5 (US3 - Subdomain Purge & Contracts) can proceed in parallel once Phase 2 is complete
- **Polish (Final Phase)**: Depends on all user stories being complete

### Parallel Opportunities

- Within Phase 2: T002 (migration), T003 (workspace contracts), T004 (database contracts) can run in parallel
- Within Phase 4: T007 (resolver), T008 (API route), T009 (resolver test), T010 (API test) can run in parallel
- Within Phase 5: T011 (user domain), T012 (contracts test), T013 (auth test), T014 (bounds test), T015 (hijack test) can run in parallel
