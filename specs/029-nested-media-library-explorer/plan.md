# Implementation Plan: Spec 029 — Nested Media Library, Recursive Folder Explorer, High-Volume Ingestion & Direct Caption Editing

**Branch**: `feat/029-nested-media-library-explorer` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

## Summary

Implement the complete Nested Media Library & File Explorer for FBUploadPro:
1. **Database Migration (`supabase/migrations/20261010190000_nested_media_folders.sql`)**:
   - Add `parent_id UUID NULL` to `media_folders` with composite foreign key `fk_media_folders_user_parent FOREIGN KEY (user_id, parent_id) REFERENCES media_folders(user_id, id) ON DELETE CASCADE` and `CHECK (id <> parent_id)`.
   - Replace flat `uq_media_folders_user_name` with sibling-scoped unique indexes:
     - `idx_media_folders_root_name ON media_folders (user_id, LOWER(name)) WHERE parent_id IS NULL`
     - `idx_media_folders_child_name ON media_folders (user_id, parent_id, LOWER(name)) WHERE parent_id IS NOT NULL`
   - Change `fk_media_items_user_folder` on `media_items` from `ON DELETE SET NULL` to `ON DELETE CASCADE` so deleting a folder cascades to its media items in PostgreSQL after R2 cleanup.
2. **Domain Contracts (`@fbuploadpro/contracts`)**:
   - Update `MediaFolderSchema`, `CreateFolderRequestSchema`, `UpdateFolderRequestSchema`, and `DeleteFolderResponseSchema` in `packages/contracts/src/domain/folder.ts` to support `parentId: z.string().uuid().nullable()`, `subfolderCount: z.number().int().min(0)`, `deletedSubfoldersCount`, and `deletedItemsCount`.
   - Update `MediaListQuerySchema` in `packages/contracts/src/domain/media.ts` to support `sortBy: z.enum(['created_at', 'name', 'file_size']).default('created_at')` and `sortOrder: z.enum(['asc', 'desc']).default('desc')`.
   - Add `BatchMediaRequestSchema` and `BatchMediaResponseSchema` in `packages/contracts/src/domain/media.ts` for bulk move, bulk delete, and bulk caption updates.
3. **Backend API Routes (`apps/web/src/app/api/tenant/[subdomain]/media/**`)**:
   - `folders/route.ts`: Support `parentId` on `POST` (validating parent ownership) and return `parentId` + `subfolderCount` + `itemCount` on `GET`.
   - `folders/[folderId]/route.ts`:
     - `PATCH`: Support renaming (`name`) and moving (`parentId`), validating that `parentId` is owned by the user and is not `folderId` or a descendant of `folderId` (using `WITH RECURSIVE` cycle detection).
     - `DELETE`: Use `WITH RECURSIVE folder_tree` to gather `folderId` and all descendant subfolders, fetch all `media_items` in those folders, purge their `storage_key` and `thumbnail_key` from Cloudflare R2 via `getStorageService()`, delete the media items and folder subtree, and return `{ success: true, deletedFolderId, deletedSubfoldersCount, deletedItemsCount }`.
   - `media/route.ts`: Support `sortBy` (`created_at`, `name`, `file_size`) and `sortOrder` (`asc`, `desc`).
   - `media/batch/route.ts`: New `POST /api/tenant/[subdomain]/media/batch` endpoint executing bulk `move`, `delete` (with R2 purge), and `caption` updates across selected `mediaIds`.
4. **Frontend Navigation & Media Library Explorer UI (`apps/web`)**:
   - Add **Media Library** (`/media`) in `apps/web/src/components/workspace/workspace-sidebar.tsx` in the primary top `SidebarGroup` right below **Home**.
   - Build `apps/web/src/app/tenant/[subdomain]/media/page.tsx` and modular client components in `apps/web/src/components/media/`:
     - `media-library-explorer.tsx`: Main Google Drive-style explorer controller with Breadcrumb Path Bar, Search/Filter/Sort toolbar, Subfolders section, Media Assets grid, drag-and-drop reparenting, and New/Rename/Move/Delete Folder modals.
     - `upload-queue-banner.tsx`: Bounded concurrency (max 3 concurrent uploads) multi-file & PC folder uploader (`webkitRelativePath` / `webkitGetAsEntry`) that automatically creates nested subfolders first and renders **one single unified Windows Copy-style progress bar** (overall `%`, `completed / total files`, `transferred / total bytes`).
     - `media-asset-card.tsx`: Video/image card with thumbnail preview, aspect ratio & duration metadata, multi-select checkbox, draggable handle, and inline click-to-edit `captionText`.
     - `media-preview-modal.tsx`: Full preview dialog with `<video controls>` / high-res `<img>`, technical metadata, and multi-line caption editor.
     - `batch-action-bar.tsx`: Floating selection bar for Bulk Move, Bulk Set Caption, and Bulk Delete.
5. **Advanced Explorer Scale, Ergonomics & Safeguards (`apps/web/src/components/media/**`)**:
   - **Global Search Across All Nested Folders**:
     - When `searchQuery` is non-empty, `refreshLibraryData` omits `folderId` so `GET /api/tenant/[subdomain]/media` queries across all folders for the tenant.
     - Matching subfolders at any depth are shown with their parent ancestry path, and each `MediaAssetCard` displays a clickable folder path (`data-testid="media-folder-path-<id>"`) formatted via `formatFolderAncestryPath` so clicking it navigates into that folder and clears the search query.
   - **Infinite Scroll & Load More Pagination**:
     - Track `totalMediaCount` from `GET /api/tenant/[subdomain]/media` and fetch subsequent pages (`offset = mediaItems.length, limit = 100`) via an `IntersectionObserver` sentinel (`data-testid="infinite-scroll-sentinel"`) and an explicit **"Load more (`Showing X of Y`)"** button (`data-testid="load-more-media-btn"`).
   - **URL Folder Sync (`?folder=<id>`)**:
     - Read initial `?folder=<id>` from `window.location.search`, push `?folder=<id>` via `window.history.pushState` on folder navigation, and synchronize `currentFolderId` on `window` `popstate` events for native browser Back/Forward support.
   - **`Shift + Click` Range Selection & Keyboard Shortcuts**:
     - Pure helper `computeRangeSelection` selects all displayed media items between the last-toggled item and the `Shift + Click` target item.
     - Global `Escape` listener clears active selection when no modal is open; `ArrowLeft` / `ArrowRight` (and Previous/Next buttons) in `MediaPreviewModal` cycle through `displayedMediaItems`.
   - **Hover Video Preview on Cards**:
     - `300ms` debounced hover timer on video cards mounts a muted inline `<video>` loop (`data-testid="hover-video-preview-<id>"`) inside the card thumbnail surface and unmounts on pointer leave.
   - **Pre-Upload Duplicate File Detection Modal**:
     - Pure helper `detectDuplicateUploadEntries` checks queued files against existing media items in the resolved target folder (case-insensitive `name` + exact `fileSize`). When duplicates exist, `MediaLibraryExplorer` opens `data-testid="duplicate-upload-modal"` offering **Skip duplicates** (`data-testid="skip-duplicates-btn"`) or **Upload all anyway** (`data-testid="upload-all-anyway-btn"`).

## Constitution Check

- **Principle I (SDD & TDD)**: Spec, Plan, Data Model, Contracts, Checklists, and Tasks created before implementation.
- **Principle III (Multi-Tenant Isolation)**: Composite foreign keys `(user_id, parent_id)` and `(user_id, folder_id)` enforced in PostgreSQL and verified in all route queries.
- **Principle VIII & IX (Theme Token Authority & Professional UX Copy)**: Strictly consumes `@web/lib/theme` and CSS custom properties (`var(--bg-panel)`, `var(--border-subtle)`, `var(--accent-1)`, etc.); zero hardcoded hex literals, zero capsule pill badges, zero decorative status dots, zero technical plumbing leaks in UI copy.
- **Principle XXII (Spec 029 Architecture)**: Top-level sidebar placement below Home, unlimited subfolder hierarchy with destructive R2-purging folder deletion, single-canvas Google Drive-style explorer, dual inline + modal caption editing, bounded upload queue with a single unified Windows Copy-style progress bar, global search across all folders, infinite scroll + Load More pagination, URL `?folder=<id>` sync, `Shift + Click` range selection & keyboard shortcuts, 300ms hover video preview, and pre-upload duplicate detection modal.

