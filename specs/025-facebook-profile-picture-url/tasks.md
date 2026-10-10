# Tasks: Spec 025 — Facebook Account & Page Profile Metadata Ingestion & Persistence (`profile_picture_url`, `gender`, `account_link`)

**Input**: Design documents from `/specs/025-facebook-profile-picture-url/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md)

---

## Phase 1: Database Migration & Domain Contracts (Foundational)

- [x] T001 Create forward SQL migration adding `profile_picture_url TEXT` (nullable) to `facebook_accounts` and `facebook_pages` in `supabase/migrations/20261010073500_facebook_profile_picture_url.sql`
- [x] T002 [P] Update `FacebookUserProfileResponseSchema` in `packages/contracts/src/domain/oauth.ts` to accept optional `picture.data.url`
- [x] T003 [P] Add `profilePictureUrl: z.string().url().nullable().optional()` to `FacebookAccountSchema`, `FacebookAccountViewSchema`, `FacebookPageSchema`, `FacebookPageViewSchema`, and `DiscoveredPageSchema` in `packages/contracts/src/domain/facebook.ts`
- [x] T004 [P] Add migration and contract unit tests for `profile_picture_url` / `profilePictureUrl` in `packages/database/tests/supabase-migrations.test.ts` and `packages/contracts/tests/facebook.test.ts`

---

## Phase 2: User Story 1 — Facebook Account Profile Picture Ingestion & Listing (Priority: P1)

- [x] T005 [US1] Update `/me` fields to `id,name,picture{url}` and upsert `profile_picture_url` in `apps/web/src/app/api/auth/facebook/callback/route.ts`
- [x] T006 [US1] Select `a.profile_picture_url` and map `profilePictureUrl` in `apps/web/src/app/api/tenant/[subdomain]/accounts/route.ts`
- [x] T007 [US1] Update and expand OAuth callback tests for `profile_picture_url` persistence and null fallback in `apps/web/tests/api/multi-account-oauth.test.ts`

---

## Phase 3: User Story 2 — Facebook Page Profile Picture Discovery, Import & Listing (Priority: P1)

- [x] T008 [US2] Add `picture{url}` to `/me/accounts` fields and map `profilePictureUrl` in `apps/web/src/app/api/tenant/[subdomain]/accounts/[accountId]/pages/discover/route.ts`
- [x] T009 [US2] Add `picture{url}` to `/me/accounts` fields and upsert `profile_picture_url` in `apps/web/src/app/api/tenant/[subdomain]/pages/import/route.ts`
- [x] T010 [US2] Select `p.profile_picture_url` and map `profilePictureUrl` in `apps/web/src/app/api/tenant/[subdomain]/pages/route.ts`
- [x] T011 [US2] Update and expand Page discovery, import, and list tests for `profilePictureUrl` in `apps/web/tests/api/facebook-pages.test.ts`

---

## Phase 4: Verification & Convergence

- [x] T012 Run full monorepo quality gate (`pnpm turbo run build lint typecheck test`) and verify 100% pass rate with 0 errors

---

## Phase 5: Facebook Account `gender` & `account_link` Expansion

- [x] T013 [US1] Add `gender VARCHAR(50)` and `account_link TEXT` (nullable) to `facebook_accounts` in `supabase/migrations/20261010073500_facebook_profile_picture_url.sql` and update `packages/database/tests/supabase-migrations.test.ts`
- [x] T014 [P] [US1] Add optional `gender` and `link` to `FacebookUserProfileResponseSchema` in `packages/contracts/src/domain/oauth.ts`, and `gender` and `accountLink` to `FacebookAccountSchema` and `FacebookAccountViewSchema` in `packages/contracts/src/domain/facebook.ts` (plus contract unit tests)
- [x] T015 [US1] Update `/v26.0/me` fields to `id,name,gender,link,picture{url}` and upsert `gender` and `account_link` in `apps/web/src/app/api/auth/facebook/callback/route.ts`
- [x] T016 [US1] Select `a.gender, a.account_link` and map `gender` and `accountLink` in `apps/web/src/app/api/tenant/[subdomain]/accounts/route.ts`
- [x] T017 [US1] Update OAuth callback and list accounts tests in `apps/web/tests/api/multi-account-oauth.test.ts` and `apps/web/tests/domain/facebook-health.test.ts` and run full monorepo quality gate (`pnpm turbo run build lint typecheck test`)
