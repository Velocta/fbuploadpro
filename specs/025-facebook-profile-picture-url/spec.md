# Feature Specification: Spec 025 — Facebook Account & Page Profile Metadata Ingestion & Persistence (`profile_picture_url`, `gender`, `account_link`)

**Feature ID**: `025-facebook-profile-picture-url`  
**Status**: Approved  
**Created**: 2026-10-10  
**Constitution Authority**: Principle 19 (Facebook Account & Page Profile Metadata Ingestion & Persistence)

---

## 1. Executive Summary & Problem Statement

Currently, neither the `facebook_accounts` table nor the `facebook_pages` table stores profile avatar URLs (`profile_picture_url`), nor does `facebook_accounts` store the user's `gender` or profile `account_link`. Adding `profile_picture_url` (`TEXT`, nullable), `gender` (`VARCHAR(50)`, nullable), and `account_link` (`TEXT`, nullable) to `facebook_accounts`—and `profile_picture_url` (`TEXT`, nullable) to `facebook_pages`—and automatically populating them from Facebook Graph API v26.0 (`fields=id,name,gender,link,picture{url}` for `/me` and `picture{url}` for `/me/accounts`) enables the workspace to display and inspect full profile metadata, links, and avatars across account and page management views.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1: Automatic Facebook Account Metadata Ingestion on OAuth Callback (Priority: P1)
**As a** workspace operator connecting a Facebook profile via OAuth,  
**When** Facebook redirects back to `/api/auth/facebook/callback`,  
**Then** the platform fetches the user's profile with `fields=id,name,gender,link,picture{url}` and persists `profile_picture_url`, `gender`, and `account_link` into `facebook_accounts` (or `NULL` for any omitted fields), updating them on subsequent reconnections.

**Acceptance Scenarios**:
1. **Given** a valid OAuth callback and a Graph API `/me?fields=id,name,gender,link,picture{url}` response containing `picture.data.url`, `gender`, and `link`, **When** the account is upserted into `facebook_accounts`, **Then** `profile_picture_url`, `gender`, and `account_link` store those values.
2. **Given** a Graph API `/me` response where `picture`, `gender`, or `link` is omitted, **When** the account is upserted, **Then** the missing columns gracefully store `null` without failing the OAuth connection.
3. **Given** a connected Facebook account, **When** the operator calls `GET /api/tenant/[subdomain]/accounts`, **Then** each item in `accounts` includes `profilePictureUrl`, `gender`, and `accountLink` (`string | null`) with zero token exposure.

### User Story 2: Automatic Facebook Page Profile Picture Discovery & Selective Import (Priority: P1)
**As a** workspace operator discovering and importing Facebook Pages from a connected Facebook account,  
**When** I query `/api/tenant/[subdomain]/accounts/[accountId]/pages/discover` and import selected Pages via `/api/tenant/[subdomain]/pages/import`,  
**Then** each discovered Page includes its `profilePictureUrl`, and each imported Page persists `profile_picture_url` into `facebook_pages` and returns it via `GET /api/tenant/[subdomain]/pages`.

---

## 3. Functional Requirements

- **FR-001**: Database schema MUST add `profile_picture_url TEXT`, `gender VARCHAR(50)`, and `account_link TEXT` (all nullable) to `public.facebook_accounts`, and `profile_picture_url TEXT` (nullable) to `public.facebook_pages` via a forward SQL migration in `supabase/migrations/`.
- **FR-002**: `@fbuploadpro/contracts` MUST extend `FacebookUserProfileResponseSchema` to accept optional `gender: z.string().max(50).nullable().optional()`, `link: z.string().url().nullable().optional()`, and nested `picture: { data: { url: string } }`.
- **FR-003**: `@fbuploadpro/contracts` MUST include `profilePictureUrl: z.string().url().nullable().optional().default(null)`, `gender: z.string().max(50).nullable().optional().default(null)`, and `accountLink: z.string().url().nullable().optional().default(null)` on `FacebookAccountSchema` and `FacebookAccountViewSchema`, and `profilePictureUrl: z.string().url().nullable().optional().default(null)` on `FacebookPageSchema`, `FacebookPageViewSchema`, and `DiscoveredPageSchema`.
- **FR-004**: `/api/auth/facebook/callback` MUST request `fields=id,name,gender,link,picture{url}` from Graph API v26.0 `/me` and upsert `profile_picture_url`, `gender`, and `account_link` in `facebook_accounts`.
- **FR-005**: `/api/tenant/[subdomain]/accounts` MUST select `a.profile_picture_url, a.gender, a.account_link` and map them to `profilePictureUrl`, `gender`, and `accountLink` in the `ListFacebookAccountsResponseSchema` payload.
- **FR-006**: `/api/tenant/[subdomain]/accounts/[accountId]/pages/discover` MUST include `picture{url}` in the Graph API v26.0 `/me/accounts` fields query and map `item.picture?.data?.url ?? null` to `profilePictureUrl` on each discovered page.
- **FR-007**: `/api/tenant/[subdomain]/pages/import` MUST include `picture{url}` in the Graph API v26.0 `/me/accounts` fields query and persist `profile_picture_url` during the `INSERT INTO facebook_pages ... ON CONFLICT (user_id, fb_page_id) DO UPDATE` statement.
- **FR-008**: `/api/tenant/[subdomain]/pages` MUST select `p.profile_picture_url` and map it to `profilePictureUrl` in the `ListFacebookPagesResponseSchema` payload.

---

## 4. Edge Cases & Constraints

- **Missing Optional Fields**: If a Facebook profile omits `picture.data.url`, `gender`, or `link`, the system MUST store and return `null` rather than throwing a validation error.
- **Reconnection / Re-Import Updates**: When an existing Facebook account or Page is reconnected or re-imported (`ON CONFLICT DO UPDATE`), `profile_picture_url`, `gender`, and `account_link` MUST be updated to reflect the latest values from Facebook Graph API.
- **Zero Token Exposure**: Adding `profilePictureUrl`, `gender`, and `accountLink` to view schemas MUST NOT alter the strict exclusion of `encrypted_access_token` and `access_token` from all API responses.

---

## 5. Success Criteria

- **SC-001**: 100% of connected Facebook accounts persist and return `profilePictureUrl`, `gender`, and `accountLink` (`string | null`), and 100% of imported Facebook Pages persist and return `profilePictureUrl` (`string | null`).
- **SC-002**: All unit and integration test suites across `@fbuploadpro/database`, `@fbuploadpro/contracts`, and `apps/web` pass with 0 errors under `pnpm turbo run build lint typecheck test`.
