# Tasks: Spec 028 — Purge Media Library Bloat

## Phase 1: Database Migration & Contract Purge
- [x] T001: Create `supabase/migrations/20261010182000_purge_media_library_bloat.sql` dropping `caption_templates`, `user_storage_quotas`, `media_items.caption_template_id`, `media_items.tags`, `idx_media_items_tags`, and `media_folders.color`.
- [x] T002: Delete `packages/contracts/src/domain/caption.ts` and remove its export from `packages/contracts/src/index.ts`.
- [x] T003: Remove `StorageQuotaResponseSchema` from `packages/contracts/src/domain/storage.ts`.
- [x] T004: Remove `AllowedFolderColors` and `color` from `packages/contracts/src/domain/folder.ts`.
- [x] T005: Remove `tags`, `tag`, `captionTemplateId`, `reclaimedBytes`, and `remainingQuotaBytes` from `packages/contracts/src/domain/media.ts`, and add `deriveDefaultCaptionFromFilename`.

## Phase 2: Backend Routes & Service Cleanup
- [x] T006: Delete `apps/web/src/app/api/tenant/[subdomain]/media/captions/route.ts`, `captions/[captionId]/route.ts`, and `quota/route.ts`.
- [x] T007: Remove `defaultQuotaBytes` from `apps/web/src/lib/storage.ts` and remove quota checks from `upload-url/route.ts`, `confirm/route.ts`, and `[mediaId]/route.ts`.
- [x] T008: Update `confirm/route.ts`, `media/route.ts`, `[mediaId]/route.ts`, `folders/route.ts`, and `folders/[folderId]/route.ts` to remove `tags`, `caption_template_id`, and `color`, and default `caption_text` to stripped filename on confirmation.
- [x] T009: Remove all 6 `user_storage_quotas` upserts and `storage_quotas` inserts from `apps/web/src/lib/supabase-auth.ts`.

## Phase 3: Tests & Documentation Synchronization
- [x] T010: Delete `apps/web/tests/api/caption-templates.test.ts` and `apps/web/tests/api/media-quota.test.ts`; update remaining media contract, database, storage, and API test suites.
- [x] T011: Update `.specify/memory/constitution.md`, `docs/foundational-knowledge.md`, and `docs/secrets-checklist.md`.
- [x] T012: Verify `pnpm turbo run build lint typecheck test` passes 100%.
