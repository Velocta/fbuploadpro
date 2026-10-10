# Feature Specification: Purge Over-Built Media Library Bloat & Enforce Default Filename Captions

**Feature Branch**: `feat/028-purge-media-library-bloat`  
**Created**: 2026-10-10  
**Status**: Approved  
**Input**: User directive to strip over-built Media Library features (`caption_templates`, `tags`, `media_folders.color`, `user_storage_quotas`) and replace caption templates with 1 direct editable `caption_text` per video/image defaulting on upload to the filename with the extension stripped.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Direct Per-Media Caption Defaulting to Stripped Filename (Priority: P1)

As a content creator uploading videos and images, I want each media item to have a single direct caption that automatically defaults to the uploaded filename (without its file extension) and can be freely edited on the item, without managing a separate Caption Templates Vault.

**Why this priority**: Core simplification of the copywriting workflow. Creators name their files meaningfully or edit captions directly per video/image.

**Independent Test**: Upload and confirm a video named `My Viral Reel.mp4` without specifying `captionText`; verify the persisted item has `captionText: "My Viral Reel"` and can be updated via `PATCH /api/tenant/[subdomain]/media/[mediaId]`.

**Acceptance Scenarios**:

1. **Given** an authenticated user confirming an uploaded media item named `My Viral Reel.mp4` without a custom caption, **When** `POST /api/tenant/[subdomain]/media/confirm` is called, **Then** `caption_text` defaults to `"My Viral Reel"`.
2. **Given** an existing media item, **When** the user updates `captionText` via `PATCH /api/tenant/[subdomain]/media/[mediaId]`, **Then** the new caption is persisted directly on `media_items.caption_text`.
3. **Given** the platform database and API routes, **When** inspected, **Then** `caption_templates`, `media_items.caption_template_id`, and `/api/tenant/[subdomain]/media/captions` are completely removed.

---

### User Story 2 - Clean Folder & Media Model Without Tags or Folder Color Badges (Priority: P2)

As a content creator, I want a clean folder and media structure without multi-tag arrays or decorative folder color strings.

**Why this priority**: Eliminates redundant metadata clutter prior to introducing nested subfolders.

**Independent Test**: Create, list, and rename folders via `/api/tenant/[subdomain]/media/folders` and list media items via `/api/tenant/[subdomain]/media`; verify no `color` or `tags` fields exist in contracts, responses, or database columns.

**Acceptance Scenarios**:

1. **Given** an authenticated user creating or updating a folder, **When** calling `/api/tenant/[subdomain]/media/folders`, **Then** only `name` is required/accepted without any `color` attribute.
2. **Given** media items in the library, **When** listing or updating items, **Then** `tags` and `tag` query parameters are completely absent.

---

### User Story 3 - Unrestricted Media Storage Without Quota Gates (Priority: P3)

As an active creator on FBUploadPro, I want to upload videos and images without storage quota blocks or byte-accounting tables, matching the platform's unrestricted publishing policy.

**Why this priority**: Aligns storage with FBUploadPro's unrestricted entitlement architecture and removes broken `user_storage_quotas` upserts from the authentication flow.

**Independent Test**: Request upload URLs, confirm uploads, and delete media items without any `user_storage_quotas` table or `/media/quota` route.

**Acceptance Scenarios**:

1. **Given** an authenticated user requesting an upload URL or confirming an upload, **When** `POST /media/upload-url` or `POST /media/confirm` executes, **Then** no storage quota check or byte-accounting query is performed.
2. **Given** a user signing up, verifying OTP, signing in, or resetting their password, **When** `supabase-auth.ts` executes, **Then** no `user_storage_quotas` upsert is attempted.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST drop the `caption_templates` table and `media_items.caption_template_id` foreign key/column via forward SQL migration, and remove `/api/tenant/[subdomain]/media/captions` routes and contracts.
- **FR-002**: The system MUST retain `media_items.caption_text` as the single editable caption per media item and default it upon upload confirmation to the file name with its extension stripped (e.g., `My Viral Reel.mp4` $\rightarrow$ `My Viral Reel`).
- **FR-003**: The system MUST drop `media_items.tags` and `idx_media_items_tags` via forward SQL migration and remove all `tags`/`tag` fields from media contracts and API routes.
- **FR-004**: The system MUST drop `media_folders.color` via forward SQL migration and remove `AllowedFolderColors` and `color` from folder contracts and API routes.
- **FR-005**: The system MUST drop the `user_storage_quotas` table via forward SQL migration, delete `/api/tenant/[subdomain]/media/quota`, and remove all quota checks/updates from `upload-url`, `confirm`, `[mediaId]`, `storage.ts`, and `supabase-auth.ts`.

---

## Success Criteria *(mandatory)*

- **SC-001**: Forward migration `20261010182000_purge_media_library_bloat.sql` cleanly drops `caption_templates`, `user_storage_quotas`, `media_items.caption_template_id`, `media_items.tags`, `idx_media_items_tags`, and `media_folders.color`.
- **SC-002**: Uploading `My Viral Reel.mp4` without an explicit `captionText` automatically persists `captionText: "My Viral Reel"`.
- **SC-003**: Zero references to `caption_templates`, `user_storage_quotas`, `AllowedFolderColors`, or media `tags` remain in active runtime code or contracts.
- **SC-004**: `pnpm turbo run build lint typecheck test` passes with 100% success and 0 errors.
