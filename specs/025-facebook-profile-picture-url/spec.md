# Feature Specification: Spec 025 — Facebook Account & Page Profile Picture URL Ingestion & Persistence

**Feature ID**: `025-facebook-profile-picture-url`  
**Status**: Approved  
**Created**: 2026-10-10  
**Constitution Authority**: Principle 19 (Facebook Account & Page Profile Picture URL Ingestion & Persistence)

---

## 1. Executive Summary & Problem Statement

Currently, neither the `facebook_accounts` table nor the `facebook_pages` table stores a profile picture URL (`profile_picture_url`). When a user connects a Facebook profile or discovers and imports Facebook Pages, the platform only stores text identifiers (`fb_account_id`, `display_name`, `fb_page_id`, `page_name`, `category`). Adding `profile_picture_url` (`TEXT`, nullable) to both tables—and automatically populating it from Facebook Graph API v26.0 (`fields=id,name,picture{url}`) during OAuth connection, Page discovery, and Page import—enables the workspace to display authentic profile avatars and Page logos across account and page management views.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1: Automatic Facebook Account Profile Picture Ingestion on OAuth Callback (Priority: P1)
**As a** workspace operator connecting a Facebook profile via OAuth,  
**When** Facebook redirects back to `/api/auth/facebook/callback`,  
**Then** the platform fetches the user's profile with `fields=id,name,picture{url}` and persists the profile picture URL into `facebook_accounts.profile_picture_url` (or `NULL` if Facebook does not return a picture URL), updating it on subsequent reconnections.

**Acceptance Scenarios**:
1. **Given** a valid OAuth callback and a Graph API `/me?fields=id,name,picture{url}` response containing `picture.data.url`, **When** the account is upserted into `facebook_accounts`, **Then** `profile_picture_url` stores the exact URL string.
2. **Given** a Graph API `/me` response where `picture` or `picture.data.url` is omitted, **When** the account is upserted, **Then** `profile_picture_url` gracefully stores `null` without failing the OAuth connection.
3. **Given** a connected Facebook account with `profile_picture_url`, **When** the operator calls `GET /api/tenant/[subdomain]/accounts`, **Then** each item in `accounts` includes `profilePictureUrl` (`string | null`) with zero token exposure.

### User Story 2: Automatic Facebook Page Profile Picture Discovery & Selective Import (Priority: P1)
**As a** workspace operator discovering and importing Facebook Pages from a connected Facebook account,  
**When** I query `/api/tenant/[subdomain]/accounts/[accountId]/pages/discover` and import selected Pages via `/api/tenant/[subdomain]/pages/import`,  
**Then** each discovered Page includes its `profilePictureUrl`, and each imported Page persists `profile_picture_url` into `facebook_pages` and returns it via `GET /api/tenant/[subdomain]/pages`.

**Acceptance Scenarios**:
1. **Given** a connected Facebook account, **When** `GET /api/tenant/[subdomain]/accounts/[accountId]/pages/discover` queries Graph API `/me/accounts?fields=id,name,category,tasks,access_token,followers_count,picture{url}`, **Then** each discovered page in the response includes `profilePictureUrl: string | null`.
2. **Given** selected Page IDs submitted to `POST /api/tenant/[subdomain]/pages/import`, **When** the Pages are upserted into `facebook_pages`, **Then** `profile_picture_url` is persisted from `picture.data.url` (or `null` if absent) and updated on conflict.
3. **Given** imported Facebook Pages in `facebook_pages`, **When** `GET /api/tenant/[subdomain]/pages` is requested, **Then** each returned Page view model includes `profilePictureUrl: string | null` while never exposing encrypted or raw access tokens.

---

## 3. Functional Requirements

- **FR-001**: Database schema MUST add `profile_picture_url TEXT` (nullable) to `public.facebook_accounts` and `public.facebook_pages` via a forward SQL migration in `supabase/migrations/`.
- **FR-002**: `@fbuploadpro/contracts` MUST extend `FacebookUserProfileResponseSchema` to accept optional nested `picture: { data: { url: string } }`.
- **FR-003**: `@fbuploadpro/contracts` MUST include `profilePictureUrl: z.string().url().nullable().optional()` (defaulting or normalizing to `null` when absent) on `FacebookAccountSchema`, `FacebookAccountViewSchema`, `FacebookPageSchema`, `FacebookPageViewSchema`, and `DiscoveredPageSchema`.
- **FR-004**: `/api/auth/facebook/callback` MUST request `fields=id,name,picture{url}` from Graph API v26.0 `/me` and upsert `profile_picture_url` in `facebook_accounts`.
- **FR-005**: `/api/tenant/[subdomain]/accounts` MUST select `a.profile_picture_url` and map it to `profilePictureUrl` in the `ListFacebookAccountsResponseSchema` payload.
- **FR-006**: `/api/tenant/[subdomain]/accounts/[accountId]/pages/discover` MUST include `picture{url}` in the Graph API v26.0 `/me/accounts` fields query and map `item.picture?.data?.url ?? null` to `profilePictureUrl` on each discovered page.
- **FR-007**: `/api/tenant/[subdomain]/pages/import` MUST include `picture{url}` in the Graph API v26.0 `/me/accounts` fields query and persist `profile_picture_url` during the `INSERT INTO facebook_pages ... ON CONFLICT (user_id, fb_page_id) DO UPDATE` statement.
- **FR-008**: `/api/tenant/[subdomain]/pages` MUST select `p.profile_picture_url` and map it to `profilePictureUrl` in the `ListFacebookPagesResponseSchema` payload.

---

## 4. Edge Cases & Constraints

- **Missing Picture Object**: If a Facebook profile or Page has no picture or Graph API omits `picture.data.url`, the system MUST store and return `null` rather than throwing a validation error.
- **Reconnection / Re-Import Updates**: When an existing Facebook account or Page is reconnected or re-imported (`ON CONFLICT DO UPDATE`), `profile_picture_url` MUST be updated to reflect the latest URL from Facebook Graph API.
- **Zero Token Exposure**: Adding `profilePictureUrl` to view schemas MUST NOT alter the strict exclusion of `encrypted_access_token` and `access_token` from all API responses.

---

## 5. Success Criteria

- **SC-001**: 100% of connected Facebook accounts and imported Facebook Pages persist and return `profilePictureUrl` (`string | null`) across OAuth callback, Page discovery, Page import, and list endpoints.
- **SC-002**: All unit and integration test suites across `@fbuploadpro/database`, `@fbuploadpro/contracts`, and `apps/web` pass with 0 errors under `pnpm turbo run build lint typecheck test`.
