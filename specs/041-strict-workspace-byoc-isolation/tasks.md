# Implementation Tasks: 041-strict-workspace-byoc-isolation

**Feature**: Strict Per-Workspace Facebook BYOC, Multi-Workspace Account/Page Isolation, and Global User Media Library
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Foundational Setup & Shared BYOC Helper

- [x] T001 [P] [Foundational] Remove `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` from `.env.production.example` and `apps/web/.env.example`
- [x] T002 [Foundational] Implement shared server helper `resolveWorkspaceFacebookCredentials` in `apps/web/src/lib/server/byoc-resolver.ts`

---

## Phase 2: User Story 1 - 100% Strict Per-Workspace Facebook BYOC (Priority: P1)

- [x] T003 [US1] Refactor `apps/web/src/app/api/auth/facebook/route.ts` to resolve workspace credentials via `resolveWorkspaceFacebookCredentials` and eliminate all `process.env` fallbacks
- [x] T004 [US1] Refactor `apps/web/src/app/connect/facebook/route.ts` to resolve workspace credentials via `resolveWorkspaceFacebookCredentials` and eliminate all `process.env` fallbacks
- [x] T005 [US1] Refactor `apps/web/src/app/api/tenant/[subdomain]/accounts/magic-link/route.ts` to validate workspace BYOC configuration before issuing magic links
- [x] T006 [US1] Refactor `apps/web/src/app/api/auth/facebook/callback/route.ts` to resolve workspace BYOC credentials and eliminate all `process.env` fallbacks

---

## Phase 3: User Story 2 - Fix Security & Logic Bugs in BYOC Settings & Test Endpoints (Priority: P1)

- [x] T007 [US2] Update `GET /api/tenant/[subdomain]/settings/byoc/route.ts` to strictly query `workspaces` with `.eq('subdomain', subdomain).eq('owner_id', session.userId)` and return 404 if missing
- [x] T008 [US2] Update `PUT /api/tenant/[subdomain]/settings/byoc/route.ts` to strictly query `workspaces` with `.eq('owner_id', session.userId)` and reject first-time saves omitting `fbAppSecret` with HTTP 400
- [x] T009 [US2] Update `POST /api/tenant/[subdomain]/settings/byoc/test/route.ts` to strictly query `workspaces` with `.eq('subdomain', subdomain).eq('owner_id', session.userId)` and return 404 if missing

---

## Phase 4: User Story 3 - Rename Settings Section to "Facebook BYOC" & Add Pre-Connect UX Guard (Priority: P1)

- [x] T010 [US3] Rename tab label and section header from "BYOC Facebook App" to "Facebook BYOC" in `apps/web/src/app/tenant/[subdomain]/settings/page.tsx` and `apps/web/src/components/settings/byoc-settings-view.tsx`
- [x] T011 [US3] Enhance pre-connection guard banner and advisory modal in `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx` and `apps/web/src/components/accounts/connect-account-modal.tsx` with direct navigation to Settings

---

## Phase 5: User Story 4 - Strict Per-Workspace Isolation for Accounts, Pages, Slots, Queues & Insights (Priority: P1)

- [x] T012 [US4] Update `apps/web/src/app/api/auth/facebook/callback/route.ts` to persist `workspace_id: workspace.id` during account upsert (`onConflict: 'workspace_id,fb_account_id'`) and scope `refreshConnectedPageTokens` to `workspace_id`
- [x] T013 [US4] Update `GET /api/tenant/[subdomain]/accounts` and `DELETE /api/tenant/[subdomain]/accounts/[accountId]` to strictly filter and verify `workspace_id = workspace.id`
- [x] T014 [US4] Update `GET .../accounts/[accountId]/pages/discover` and `POST .../pages/import` to verify account belongs to `workspace_id` and persist `workspace_id: workspace.id` on pages (`onConflict: 'workspace_id,fb_page_id'`)
- [x] T015 [US4] Update `GET /api/tenant/[subdomain]/pages` and `GET/PATCH/DELETE /api/tenant/[subdomain]/pages/[pageId]` to strictly filter and verify `workspace_id = workspace.id`
- [x] T016 [US4] Update `/pages/[pageId]/slots/**`, `/publishing/queue/**`, `/publishing/logs`, and `/pages/[pageId]/insights` to ensure target pages and items belong to the active `workspace_id`

---

## Phase 6: User Story 5 - Global User Media Library & Downloader Across All Workspaces (Priority: P1)

- [x] T017 [US5] Author forward migration `supabase/migrations/20261014180000_global_user_media_library.sql` making `workspace_id` nullable on `media_folders` and `media_items`, dropping `uq_media_folders_workspace_name`, adding user-level sibling unique indexes, and updating RLS to `auth.uid() = user_id`
- [x] T018 [US5] Update `@fbuploadpro/contracts` (`DatabaseMediaFolderRow`, `DatabaseMediaItemRow`) in `packages/contracts/src/domain/database.ts` to make `workspace_id` nullable (`string | null`)
- [x] T019 [US5] Verify `/api/tenant/[subdomain]/media/**` and downloader routes query and mutate globally by `session.userId`

---

## Phase 7: User Story 6 - Comprehensive Regression & Isolation QA (Priority: P1)

- [x] T020 [US6] Update `apps/web/tests/security/multi-workspace-resource-isolation.test.ts` to assert accounts/pages are workspace-isolated and media is globally accessible across workspaces of the same user
- [x] T021 [US6] Update `apps/web/tests/api/auth-facebook.test.ts` and `apps/web/tests/api/multi-account-oauth.test.ts` to verify strict BYOC lookup and reject unconfigured workspaces without falling back to `process.env`
- [x] T022 [US6] Update `apps/web/tests/ui/byoc-settings.test.tsx` to verify "Facebook BYOC" tab/heading and first-time secret omission rejection
