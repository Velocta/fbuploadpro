# Feature Specification: Complete Elimination of Webhooks

**Feature Branch**: `feat/048-remove-webhooks`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "create a SDD to remove webhooks entirely"

## Clarifications

### Session 2026-10-15
- Q: Should 'webhook' remain in the reserved subdomains list to prevent subdomain takeover? → A: Remove 'webhook' from RESERVED_SUBDOMAINS as well.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Simplified Meta App Settings UI (Priority: P1)

As a workspace administrator configuring custom Facebook Developer App credentials (BYOC), I want the Meta App Setup section in Workspace Settings to only display the required OAuth Redirect URI and essential app credentials without any unused Webhook Callback URL or webhook tokens, so that the setup instructions are concise and eliminate configuration steps for non-existent webhook ingestion.

**Why this priority**: Eliminates user confusion during custom Meta App setup by ensuring the UI only requests and presents configurations that the application actually uses.

**Independent Test**: Mount the BYOC settings view and verify that only the OAuth Redirect URI copy box is displayed and no "Webhook Callback URL" or webhook token elements are rendered.

**Acceptance Scenarios**:

1. **Given** a user navigates to `/tenant/[subdomain]/settings` under the BYOC credentials card, **When** inspecting the Meta App Setup instructions, **Then** only the OAuth Redirect URI (`https://app.fbuploadpro.com/api/auth/facebook/callback`) is displayed with its copy button.
2. **Given** the Meta App Setup section, **When** searching for webhook elements, **Then** no Webhook Callback URL field, copy button, or webhook helper instructions exist in the view.

---

### User Story 2 - Purge Webhook Columns & Backend Handlers (Priority: P1)

As a backend engineer, I want the database schema and BYOC API routes to drop `webhook_verify_token` and remove all webhook parsing and resolution logic, so that the persistence layer and API contracts have zero vestigial webhook fields.

**Why this priority**: Ensures schema hygiene and prevents dead code or orphaned database columns from accumulating in the production database.

**Independent Test**: Call `GET /api/tenant/[subdomain]/settings/byoc` and `POST /api/tenant/[subdomain]/settings/byoc` and verify responses and payloads do not contain `webhookVerifyToken`, and verify database schema migration drops `webhook_verify_token`.

**Acceptance Scenarios**:

1. **Given** the `workspace_byoc_credentials` table, **When** applying the forward migration, **Then** the `webhook_verify_token` column is safely dropped.
2. **Given** a request to `GET /api/tenant/[subdomain]/settings/byoc`, **When** the response is received, **Then** `webhookVerifyToken` is not present in the returned JSON object.
3. **Given** a request to `POST /api/tenant/[subdomain]/settings/byoc`, **When** updating Facebook credentials, **Then** `webhook_verify_token` is neither accepted nor written to the database.

---

### User Story 3 - Contracts Cleanliness & Subdomain Purge (Priority: P2)

As a system architect, I want `@fbuploadpro/contracts` to remove `webhookVerifyToken` from workspace validation schemas and database row types, and remove `'webhook'` from `RESERVED_SUBDOMAINS`, so that domain types strictly represent active features.

**Why this priority**: Aligns domain contracts with the actual system capabilities and fulfills the explicit user directive to remove `'webhook'` from reserved subdomains.

**Independent Test**: Inspect `@fbuploadpro/contracts` exports and verify that `SubdomainSchema.safeParse('webhook').success` evaluates to `true` and that `webhookVerifyToken` is not on `BYOCCredentialsViewSchema`.

**Acceptance Scenarios**:

1. **Given** `packages/contracts/src/domain/workspace.ts`, **When** inspecting `BYOCCredentialsViewSchema` and `SaveBYOCCredentialsRequestSchema`, **Then** `webhookVerifyToken` is absent from both schemas.
2. **Given** `packages/contracts/src/domain/database.ts`, **When** inspecting `workspace_byoc_credentials` row definitions, **Then** `webhook_verify_token` is absent.
3. **Given** `packages/contracts/src/domain/user.ts`, **When** inspecting `RESERVED_SUBDOMAINS`, **Then** `'webhook'` is removed from the array.

---

### Edge Cases

- **Existing BYOC Credentials**: When migrating existing rows in `workspace_byoc_credentials`, dropping the `webhook_verify_token` column must not affect `fb_app_id`, `encrypted_fb_app_secret`, `status`, or `last_tested_at`.
- **Legacy Test Payloads**: All test suites in `apps/web` and `packages/contracts` that pass or assert `webhook_verify_token` or `webhookVerifyToken` must be updated so they do not fail against updated schemas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST create a forward migration `supabase/migrations/YYYYMMDDHHmmss_drop_byoc_webhook_verify_token.sql` dropping column `webhook_verify_token` from `public.workspace_byoc_credentials`.
- **FR-002**: System MUST remove `webhookVerifyToken` from `BYOCCredentialsViewSchema` and `SaveBYOCCredentialsRequestSchema` in `packages/contracts/src/domain/workspace.ts`.
- **FR-003**: System MUST remove `webhook_verify_token` from database row type definitions in `packages/contracts/src/domain/database.ts`.
- **FR-004**: System MUST remove `'webhook'` from `RESERVED_SUBDOMAINS` in `packages/contracts/src/domain/user.ts`.
- **FR-005**: System MUST remove `webhookVerifyToken` and `webhook_verify_token` from `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/route.ts` and `apps/web/src/lib/server/byoc-resolver.ts`.
- **FR-006**: System MUST remove `webhookUrl` prop, copy trigger, and display elements from `MetaAppSetupSection` in `apps/web/src/components/settings/byoc-settings-view.tsx`.

### Key Entities

- **WorkspaceBYOCCredentials**: Updated table schema without `webhook_verify_token`.
- **BYOCCredentialsView**: View contract containing `{ workspaceId, subdomain, fbAppId, hasSecret, status, lastTestedAt }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 occurrences of active webhook fields, routes, or UI components remaining in application source code (`apps/web/src`, `apps/worker/src`, `packages/contracts/src`).
- **SC-002**: Forward database migration successfully drops `webhook_verify_token` without impacting existing app credentials.
- **SC-003**: 100% of existing and updated unit tests pass across `packages/contracts` and `apps/web`.
- **SC-004**: Zero UI regressions in the Workspace Settings BYOC configuration workflow.

## Assumptions

- Production publishing and insights analytics continue to operate via Cloudflare Workers cron jobs and Facebook Graph API v26.0 polling.
- Inbound real-time webhook subscriptions are not required for core posting or slot execution.
