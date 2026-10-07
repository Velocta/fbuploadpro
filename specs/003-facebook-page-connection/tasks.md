# Tasks: Facebook Graph API OAuth & Multi-Account Social Connection

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Branch**: `spec/003-facebook-page-connection`

This document decomposes the implementation plan into dependency-ordered, atomic tasks (<150–200 LoC each) adhering strictly to Spec-Driven Development, TDD, native Web Crypto token encryption, and Facebook Graph API v26.0.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment configuration and test setup for Facebook OAuth credentials and cryptographic token encryption.

- [X] T050 Configure environment variables template with `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, and 256-bit `TOKEN_ENCRYPTION_KEY` in `apps/web/.env.example` (Issue: #85)

---

## Phase 2: Foundational (Encryption & Database Schema Prerequisites)

**Purpose**: Web Crypto AES-256-GCM encryption/decryption utilities and PostgreSQL database migration adding encrypted token columns to `facebook_accounts` and `facebook_pages`.

**⚠️ CRITICAL**: No user story work can begin until this foundational phase is complete.

### Tests for Foundational Infrastructure (TDD) ⚠️
- [X] T051 [P] Write unit tests for native Web Crypto AES-256-GCM token encryption and decryption utilities asserting random 12-byte IV, valid round-trip decryption, authentication tag validation on tamper, and zero plaintext leakage in `packages/contracts/tests/crypto.test.ts` (Issue: #86)
- [X] T052 [P] Write database integration tests asserting multi-account `CONSTRAINT uq_fb_accounts_user_account UNIQUE (user_id, fb_account_id)` and page uniqueness `CONSTRAINT uq_fb_pages_user_page UNIQUE (user_id, fb_page_id)` in `packages/database/tests/facebook-tokens.test.ts` (Issue: #87)

### Implementation of Foundational Infrastructure
- [X] T053 [P] Implement `encryptToken` and `decryptToken` using native `crypto.subtle` (AES-256-GCM, 12-byte IV, `{iv_hex}:{ciphertext_hex}` format) in `packages/contracts/src/crypto/token.ts` (Issue: #88)
- [X] T054 [P] Implement `OAuthStatePayloadSchema`, `FacebookOAuthCallbackQuerySchema`, and `FacebookTokenExchangeResponseSchema` targeting Graph API v26.0 in `packages/contracts/src/domain/oauth.ts` (Issue: #89)
- [X] T055 [P] Update `FacebookAccountSchema` and `FacebookPageSchema` adding `encryptedAccessToken TEXT NOT NULL`, `tokenExpiresAt TIMESTAMPTZ`, `category VARCHAR(100)`, and `tasks JSONB NOT NULL DEFAULT '[]'::jsonb` in `packages/contracts/src/domain/facebook.ts` (Issue: #90)
- [X] T056 Export crypto utilities, OAuth schemas, and updated Facebook schemas in `packages/contracts/src/index.ts` (Issue: #91)
- [X] T057 Create forward database migration `0002_facebook_tokens.sql` adding `encrypted_access_token TEXT NOT NULL`, `token_expires_at TIMESTAMPTZ` to `facebook_accounts` and `encrypted_access_token TEXT NOT NULL`, `category VARCHAR(100)`, `tasks JSONB NOT NULL DEFAULT '[]'::jsonb` to `facebook_pages` in `packages/database/migrations/0002_facebook_tokens.sql` (Issue: #92)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Multi-Account Facebook OAuth Connection & Encrypted Token Storage (Priority: P1) 🎯 MVP

**Goal**: Deliver OAuth 2.0 flow connecting multiple distinct Facebook accounts per tenant workspace, exchanging codes for 60-day long-lived tokens via Graph API v26.0, encrypting tokens with AES-256-GCM, and storing distinct accounts under `(user_id, fb_account_id)`.

**Independent Test**: Can be validated using Vitest by sending mock OAuth initiation requests, executing simulated Graph API v26.0 callbacks for Account A and Account B, and asserting both accounts are persisted with `active` status, unique `fb_account_id` values, and encrypted tokens in the database.

### Tests for User Story 1 (TDD) ⚠️
- [X] T058 [P] [US1] Write unit and integration tests for Facebook OAuth initiation and callback route handlers verifying CSRF state signing, code exchange, and encrypted token persistence in `apps/web/tests/api/auth-facebook.test.ts` (Issue: #93)
- [X] T059 [P] [US1] Write integration tests verifying multiple distinct Facebook accounts can be connected to the same tenant workspace without collision or overwriting in `apps/web/tests/api/multi-account-oauth.test.ts` (Issue: #94)

### Implementation for User Story 1
- [X] T060 [US1] Implement `GET /api/auth/facebook` route handler generating signed HMAC-SHA256 OAuth state envelope and redirecting to `https://www.facebook.com/v26.0/dialog/oauth` with required scopes `pages_show_list,pages_read_engagement,pages_manage_posts,business_management` in `apps/web/src/app/api/auth/facebook/route.ts` (Issue: #95)
- [X] T061 [US1] Implement `GET /api/auth/facebook/callback` route handler verifying state signature and expiration, exchanging code for 60-day long-lived token via `https://graph.facebook.com/v26.0/oauth/access_token`, retrieving profile from `https://graph.facebook.com/v26.0/me?fields=id,name`, encrypting token with AES-256-GCM, and upserting into `facebook_accounts` on conflict `(user_id, fb_account_id)` in `apps/web/src/app/api/auth/facebook/callback/route.ts` (Issue: #96)

**Checkpoint**: User Story 1 complete — multi-account Facebook OAuth connection and encrypted token storage functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Account Discovery & Facebook Page Selection (Priority: P2)

**Goal**: Enable users to select any connected Facebook account, query Graph API v26.0 `/me/accounts` to discover manageable Pages (strictly excluding groups), and selectively import chosen Pages with encrypted Page access tokens into `facebook_pages`.

**Independent Test**: Can be validated by executing discovery for a specific connected account, asserting that discovered pages match Graph API v26.0 responses (zero groups), selecting specific pages for import, and verifying persisted records in `facebook_pages` linked to `(user_id, facebook_account_id)` with encrypted tokens.

### Tests for User Story 2 (TDD) ⚠️
- [X] T062 [P] [US2] Write unit and integration tests for Graph API v26.0 `/me/accounts` page discovery and selective import route handlers asserting strict groups exclusion and encrypted page token persistence in `apps/web/tests/api/facebook-pages.test.ts` (Issue: #97)

### Implementation for User Story 2
- [X] T063 [US2] Implement `GET /api/tenant/[subdomain]/accounts/[accountId]/pages/discover` route handler decrypting account token, querying `https://graph.facebook.com/v26.0/me/accounts?fields=id,name,category,tasks,access_token,followers_count`, filtering for pages only, and returning `DiscoveredPage` list with `isImported` status in `apps/web/src/app/api/tenant/[subdomain]/accounts/[accountId]/pages/discover/route.ts` (Issue: #98)
- [X] T064 [US2] Implement `POST /api/tenant/[subdomain]/pages/import` route handler encrypting Page access tokens with AES-256-GCM and upserting selected pages into `facebook_pages` enforcing `CONSTRAINT fk_fb_pages_user_account FOREIGN KEY (user_id, facebook_account_id)` and `CONSTRAINT uq_fb_pages_user_page UNIQUE (user_id, fb_page_id)` in `apps/web/src/app/api/tenant/[subdomain]/pages/import/route.ts` (Issue: #99)
- [X] T065 [US2] Implement `GET /api/tenant/[subdomain]/pages` route handler returning sanitized imported Facebook Pages for the tenant workspace in `apps/web/src/app/api/tenant/[subdomain]/pages/route.ts` (Issue: #100)

**Checkpoint**: User Story 2 complete — Facebook Page discovery and selective import fully functional with zero groups.

---

## Phase 5: User Story 3 - Multi-Account Health Monitoring, Token Expiration & Re-Authentication (Priority: P3)

**Goal**: Provide real-time health monitoring for multiple connected accounts and imported pages, detecting expiration / Graph API error 190, alerting users, and providing single-click re-authentication.

**Independent Test**: Can be validated by simulating an expired token on Account A and valid token on Account B, asserting that Account A transitions to `expired` status while Account B remains `active`, and verifying reconnection triggers update credentials without duplicating records.

### Tests for User Story 3 (TDD) ⚠️
- [X] T066 [P] [US3] Write unit and integration tests for account and page health status evaluation, Graph API OAuth error 190 handling, and token expiry calculation in `apps/web/tests/domain/facebook-health.test.ts` (Issue: #101)

### Implementation for User Story 3
- [X] T067 [US3] Implement health status evaluator mapping Graph API errors (error 190 subcodes 458/460/463 to `expired` / `invalid_token`, rate limit codes 4/17/32 to `fb_rate_limited`) and token expiry horizons in `packages/contracts/src/domain/facebook-health.ts` (Issue: #102)
- [X] T068 [US3] Implement `GET /api/tenant/[subdomain]/accounts` route handler returning sanitized multi-account status summary with connected page counts in `apps/web/src/app/api/tenant/[subdomain]/accounts/route.ts` (Issue: #103)

**Checkpoint**: User Story 3 complete — multi-account health monitoring and expiration handling operational.

---

## Phase 6: User Story 4 - Granular Disconnection & Isolated Multi-Tenant Governance (Priority: P4)

**Goal**: Allow users to disconnect individual Facebook Pages or entire Facebook accounts with zero impact on sibling accounts, purging encrypted tokens, and enforcing strict multi-tenant isolation.

**Independent Test**: Can be validated by disconnecting a single page and asserting only that page is removed, disconnecting an account and asserting only that account's pages are removed while sibling accounts remain active, and asserting cross-tenant requests fail with authorization errors.

### Tests for User Story 4 (TDD) ⚠️
- [X] T069 [P] [US4] Write integration tests for granular page and account disconnection and cross-tenant authorization denial in `apps/web/tests/api/facebook-disconnect.test.ts` (Issue: #104)

### Implementation for User Story 4
- [X] T070 [US4] Implement `DELETE /api/tenant/[subdomain]/pages/[pageId]` route handler deleting page record and purging encrypted token under `(user_id, pageId)` in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/route.ts` (Issue: #105)
- [X] T071 [US4] Implement `DELETE /api/tenant/[subdomain]/accounts/[accountId]` route handler deleting account record and cascading deletion of linked pages under `(user_id, accountId)` without affecting other connected accounts in `apps/web/src/app/api/tenant/[subdomain]/accounts/[accountId]/route.ts` (Issue: #106)

**Checkpoint**: User Story 4 complete — granular disconnection and multi-tenant isolation fully verified.

---

## Phase 7: UI & Dashboard Integration

**Purpose**: Deliver user interface components for multi-account management, account switching, page discovery, and selective import at `/tenant/[subdomain]/accounts`.

- [X] T072 [P] Implement multi-account switcher and account card component displaying display name, status badge, token expiration horizon, and connect/disconnect buttons in `apps/web/src/components/facebook/account-list.tsx` (Issue: #107)
- [X] T073 [P] Implement Facebook Page discovery modal component with selective checkboxes, follower counts, and import confirmation in `apps/web/src/components/facebook/page-discovery-modal.tsx` (Issue: #108)
- [X] T074 Implement tenant accounts page integrating account list, imported pages table, discovery modal, and status indicators in `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx` (Issue: #109)

---

## Phase 8: Polish & Monorepo Quality Gates

**Purpose**: Security verification asserting zero plaintext token leakage and full Turborepo pipeline validation.

- [X] T075 [P] Run security audit test asserting zero raw or encrypted token leakage across all client-facing view models and error responses in `apps/web/tests/security/token-leakage.test.ts` (Issue: #110)
- [X] T076 Execute quickstart validation scenarios defined in `specs/003-facebook-page-connection/quickstart.md` (Issue: #111)
- [X] T077 Verify all Turborepo quality gates pass cleanly (`pnpm turbo run build lint typecheck test`) across all monorepo packages (Issue: #112)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational (Phase 2).
- **User Story 2 (Phase 4 - P2)**: Depends on User Story 1 (Phase 3).
- **User Story 3 (Phase 5 - P3)**: Depends on User Story 1 & 2.
- **User Story 4 (Phase 6 - P4)**: Depends on User Story 1 & 2.
- **UI Integration (Phase 7)**: Depends on Phases 3, 4, 5, 6.
- **Polish & Quality Gates (Phase 8)**: Depends on all implementation phases complete.

### Parallel Opportunities
- Foundational tests (T051, T052) and domain schemas (T053, T054, T055) can run in parallel.
- User story tests (T058, T059, T062, T066, T069) can be written in parallel before implementation.
- UI components (T072, T073) can be built in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (T050)
2. Complete Phase 2: Foundational (T051–T057)
3. Complete Phase 3: User Story 1 (T058–T061)
4. Validate User Story 1 independently with multi-account OAuth tests.

### Incremental Delivery
1. Add User Story 2 (T062–T065) ➔ Facebook Page discovery and selective import (zero groups).
2. Add User Story 3 (T066–T068) ➔ Multi-account health monitoring & error 190 handling.
3. Add User Story 4 (T069–T071) ➔ Granular disconnection and tenant isolation.
4. Add UI Integration (T072–T074) ➔ Multi-account dashboard view at `/tenant/[subdomain]/accounts`.
5. Polish & Quality Gates (T075–T077) ➔ Security audit and Turborepo 100% clean.
