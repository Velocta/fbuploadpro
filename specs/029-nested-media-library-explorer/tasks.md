# Tasks: Spec 029 — Nested Media Library, Recursive Folder Explorer, High-Volume Ingestion & Direct Caption Editing

**Input**: Design documents from `/specs/029-nested-media-library-explorer/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/media-explorer-api.md](./contracts/media-explorer-api.md)

## Phase 1: Setup & Database Substrate (`backend-engineer`)

- [x] T001 Create forward migration `supabase/migrations/20261010190000_nested_media_folders.sql` adding `parent_id UUID NULL` to `media_folders`, composite FK `fk_media_folders_user_parent FOREIGN KEY (user_id, parent_id) REFERENCES media_folders(user_id, id) ON DELETE CASCADE`, `chk_media_folders_no_self_parent CHECK (id <> parent_id)`, sibling-scoped unique indexes (`idx_media_folders_root_name` and `idx_media_folders_child_name`), and updating `fk_media_items_user_folder` to `ON DELETE CASCADE`.
- [x] T002 [P] Update `packages/database/tests/media-library.test.ts` and `packages/database/tests/supabase-migrations.test.ts` to assert `20261010190000_nested_media_folders.sql` constraints and chronological ordering.

## Phase 2: Foundational Domain Contracts (`backend-engineer`)

- [x] T003 Update `packages/contracts/src/domain/folder.ts` so `MediaFolderSchema` includes `parentId: z.string().uuid().nullable()` and `subfolderCount: z.number().int().min(0).default(0)`, `CreateFolderRequestSchema` and `UpdateFolderRequestSchema` accept `parentId: z.string().uuid().nullable().optional()`, and `DeleteFolderResponseSchema` returns `deletedFolderId`, `deletedSubfoldersCount`, and `deletedItemsCount`.
- [x] T004 Update `packages/contracts/src/domain/media.ts` so `MediaListQuerySchema` includes `sortBy: z.enum(['created_at', 'name', 'file_size']).default('created_at')` and `sortOrder: z.enum(['asc', 'desc']).default('desc')`, and add `BatchMediaRequestSchema` (`action: 'move' | 'delete' | 'caption'`) and `BatchMediaResponseSchema`.
- [x] T005 Update `packages/contracts/tests/media-contracts.test.ts` to test nested `parentId` folder contracts, destructive `DeleteFolderResponseSchema`, sort query parameters, and `BatchMediaRequestSchema`.

## Phase 3: User Story 1 & 4 Backend — Recursive Folders, Sortable Listing & Batch Operations (`backend-engineer`)

- [x] T006 [US1] Update `apps/web/src/app/api/tenant/[subdomain]/media/folders/route.ts` so `GET` returns `parentId`, `itemCount`, and `subfolderCount` for every folder, and `POST` accepts optional `parentId` (verifying parent folder ownership by `session.userId` and returning 404 `PARENT_FOLDER_NOT_FOUND` if missing).
- [x] T007 [US1] Update `apps/web/src/app/api/tenant/[subdomain]/media/folders/[folderId]/route.ts` so `PATCH` supports updating `name` and/or `parentId` (preventing self-parenting and circular descendant moves via `WITH RECURSIVE`), and `DELETE` recursively collects the folder and all descendant subfolders (`WITH RECURSIVE`), purges all contained media items and thumbnails from Cloudflare R2 via `getStorageService()`, deletes the media items and folders in PostgreSQL, and returns `{ success: true, deletedFolderId, deletedSubfoldersCount, deletedItemsCount }`.
- [x] T008 [US4] Update `apps/web/src/app/api/tenant/[subdomain]/media/route.ts` to support `sortBy` (`created_at`, `name`, `file_size`) and `sortOrder` (`asc`, `desc`) in `ORDER BY`.
- [x] T009 [US4] Create `apps/web/src/app/api/tenant/[subdomain]/media/batch/route.ts` implementing `POST /api/tenant/[subdomain]/media/batch` for atomic bulk `move` (verifying target folder ownership), bulk `caption` updates, and bulk `delete` (purging R2 objects and deleting DB rows scoped to `session.userId`).
- [x] T010 [US1] [US4] Update `apps/web/tests/api/media-folders.test.ts`, `apps/web/tests/api/media-list-filter.test.ts`, and create `apps/web/tests/api/media-batch.test.ts` to verify nested folder creation, circular move rejection, cascading folder deletion with R2 object purge, sorting, and batch operations.

## Phase 4: User Story 1, 2, 3 & 4 Frontend — Sidebar & Google Drive-Style Media Library Explorer (`frontend-engineer`)

- [x] T011 [US1] Update `apps/web/src/components/workspace/workspace-sidebar.tsx` and `apps/web/tests/ui/workspace-sidebar.test.tsx` to add top-level **Media Library** (`/media`) in the primary top `SidebarGroup` directly below **Home**.
- [x] T012 [P] [US3] Create `apps/web/src/components/media/upload-queue-banner.tsx` implementing the bounded-concurrency (max 3 concurrent) multi-file & PC folder uploader (`webkitRelativePath` / `webkitGetAsEntry` directory traversal, automatic nested subfolder creation/reuse inside the currently open folder, client-side `<video>`/`<canvas>` WebP thumbnail extraction with graceful fallback, and a **single unified Windows Copy-style progress bar** displaying overall `%`, `completed / total files`, and `transferred / total bytes`).
- [x] T013 [P] [US2] Create `apps/web/src/components/media/media-asset-card.tsx` and `apps/web/src/components/media/media-preview-modal.tsx` implementing the media card (thumbnail preview, aspect ratio/duration metadata, selection checkbox, drag support, and inline click-to-edit `captionText`) and the full Media Preview Modal (video player / high-res image viewer, metadata, and multi-line caption editor).
- [x] T014 [P] [US4] Create `apps/web/src/components/media/batch-action-bar.tsx` implementing the floating batch selection bar for Bulk Move to Folder, Bulk Set Caption, and Bulk Delete.
- [x] T015 [US1] [US2] [US3] [US4] Create `apps/web/src/components/media/media-library-explorer.tsx` and `apps/web/src/app/tenant/[subdomain]/media/page.tsx` assembling the Google Drive-style explorer: Breadcrumb Path Bar (with click navigation and drag-and-drop reparenting), Search/Filter/Sort toolbar (`All`/`Videos`/`Images`, sort by `Newest`/`Oldest`/`Name`/`Size`), Subfolders section (clickable folder cards with Rename, Move, and Delete confirmation dialog showing exact subfolder and file counts to be deleted), Media Assets grid, and drag-and-drop file/folder upload dropzone.

## Phase 5: Integration Testing, Documentation Synchronization & Convergence (`qa-engineer`)

- [x] T016 Create `apps/web/tests/ui/media-library-explorer.test.tsx` testing the Media Library Explorer UI: breadcrumb navigation, nested subfolder creation & destructive deletion confirmation modal, inline & modal caption editing, batch selection bar (move, caption, delete), search/filter/sort, and the single unified Windows Copy-style upload progress bar.
- [x] T017 Update `docs/foundational-knowledge.md` to document Spec 029 (Nested Media Library, Recursive Folder Explorer, High-Volume Bounded Ingestion & Direct Caption Editing) in the same Pull Request.
- [x] T018 Run full Turborepo quality gate `pnpm turbo run build lint typecheck test` and verify 100% pass rate with 0 errors.

## Phase 6: User Story 5, 6 & 7 Frontend — Global Search, Infinite Scroll Pagination, URL Sync, Keyboard/Range Selection, Hover Video Preview & Duplicate Guard (`frontend-engineer`)

- [x] T019 [US7] Update `apps/web/src/components/media/upload-queue-banner.tsx` to export `detectDuplicateUploadEntries` (resolving target folders and matching case-insensitive `name` + exact `fileSize` against existing items) and support `initialSkippedCount` in `executeBoundedUploadBatch`.
- [x] T020 [US5] [US6] Update `apps/web/src/components/media/media-asset-card.tsx` to support clickable folder path badges (`folderPathLabel`, `onNavigateFolder`, `data-testid="media-folder-path-${item.id}"`), `Shift + Click` checkbox range selection (`onToggleSelect(item.id, { shiftKey: e.shiftKey })`), and `300ms` debounced muted inline `<video>` hover preview (`data-testid="hover-video-preview-${item.id}"`).
- [x] T021 [US6] Update `apps/web/src/components/media/media-preview-modal.tsx` to support `hasPrevious`, `hasNext`, `onPrevious`, and `onNext` props, rendering Previous (`data-testid="preview-prev-btn"`) and Next (`data-testid="preview-next-btn"`) buttons and `ArrowLeft` / `ArrowRight` keyboard navigation.
- [x] T022 [US5] [US6] [US7] Update `apps/web/src/components/media/media-library-explorer.tsx` to implement Global Search across all nested folders (`formatFolderAncestryPath`), Infinite Scroll (`data-testid="infinite-scroll-sentinel"`) + **"Load more (`Showing X of Y`)"** button (`data-testid="load-more-media-btn"`), URL `?folder=<id>` synchronization (`history.pushState` & `popstate`), `Shift + Click` range selection (`computeRangeSelection`) & `Escape` selection clear, Preview Modal Previous/Next item cycling, and the Pre-Upload Duplicate Detection Modal (`data-testid="duplicate-upload-modal"` with `data-testid="skip-duplicates-btn"` and `data-testid="upload-all-anyway-btn"`).

## Phase 7: Extended QA Verification, Documentation Sync & Final Convergence (`qa-engineer`)

- [x] T023 [US5] [US6] [US7] Expand `apps/web/tests/ui/media-library-explorer.test.tsx` to test Global Search across nested folders with clickable folder paths, Infinite Scroll & Load More pagination, URL `?folder=<id>` sync & `popstate`, `Shift + Click` range selection & keyboard shortcuts (`Escape`, `ArrowLeft`, `ArrowRight`), `300ms` hover video preview on cards, and the Pre-Upload Duplicate Detection Modal (`Skip duplicates` vs. `Upload all anyway`).
- [x] T024 Synchronize `docs/foundational-knowledge.md` with the 6 new Spec 029 Media Library capabilities in the same Pull Request.
- [x] T025 Execute full Turborepo quality gate `pnpm turbo run build lint typecheck test` and verify 100% pass rate with 0 errors.

