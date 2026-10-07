# Feature Specification: Dedicated User Media Library & Cloudflare R2 Uploads

**Feature Branch**: `feat/004-media-library`

**Created**: 2026-10-07

**Status**: Ready for Planning

**Input**: User description: "dedicated library per user, users upload media from their pc, support tags, custom folders, and reusable captions, Cloudflare R2 direct uploads with baseline storage quota"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Direct PC Media Upload & Storage Quota Enforcement (Priority: P1)

As a content creator, I want to upload short-form videos and images directly from my computer into my personal media library with real-time progress and storage quota tracking, so that my assets are safely stored and prepared for automated publishing without burdening system performance.

**Why this priority**: Core ingestion foundation. Without the ability to upload and store video and image assets, no downstream organization, captioning, or queue publishing is possible (MVP).

**Independent Test**: Can be validated by uploading a video (e.g. 9:16 MP4) and an image (e.g. JPEG) from a user device, asserting that upload progress displays correctly, media items are stored under the user's workspace with thumbnail previews, and attempting an upload that exceeds the storage quota is cleanly blocked.

**Acceptance Scenarios**:

1. **Given** an authenticated user within their personal workspace with available storage quota, **When** they select and upload a valid video file (MP4, MOV) from their computer, **Then** the file is uploaded directly to secure cloud storage, a thumbnail preview is generated, and the asset is added to their library with file size, duration, and aspect ratio recorded.
2. **Given** an authenticated user within their personal workspace, **When** they select and upload a valid image file (JPEG, PNG, WebP) from their computer, **Then** the file is uploaded, thumbnail preview is generated, and the asset appears in their library.
3. **Given** a user whose remaining storage quota is less than the size of the file being uploaded, **When** they attempt to initiate an upload, **Then** the system rejects the upload with a clear message indicating insufficient storage quota.
4. **Given** an unauthenticated user or an invalid session, **When** an upload attempt is made, **Then** the system rejects the request with an authorization error.

---

### User Story 2 - Media Organization via Custom Folders & Multi-Tagging (Priority: P2)

As a content creator managing multiple content series, I want to organize my uploaded videos and images into custom folders and assign descriptive tags, so that I can quickly find, filter, and batch-select assets for scheduling.

**Why this priority**: High-volume publishers rapidly accumulate hundreds of videos and images; structured organization prevents clutter and enables campaign-level publishing workflows.

**Independent Test**: Can be validated by creating custom folders, assigning tags to uploaded media items, moving items between folders, and asserting that filtering the library by folder or tag accurately displays only matching assets.

**Acceptance Scenarios**:

1. **Given** an existing media library with uploaded assets, **When** the user creates a new folder with a custom name and color badge, **Then** the folder appears in their folder navigation tree.
2. **Given** multiple media assets in the library, **When** the user assigns tags (e.g., `#fitness`, `#viral`, `#promo`) to an asset, **Then** the asset is searchable and filterable by those tags.
3. **Given** a folder containing media items, **When** the user deletes the folder, **Then** the folder is removed while its contained media items remain safely preserved in the default "Unorganized" view.
4. **Given** a user in Workspace A, **When** they attempt to view or access folders created by Workspace B, **Then** the system strictly denies access.

---

### User Story 3 - Reusable Caption Templates Management (Priority: P3)

As a social media publisher, I want to create and manage reusable caption templates (including hashtags, call-to-action text, and links) and attach them to media items, so that I can maintain consistent brand voice and avoid repeatedly typing long captions.

**Why this priority**: Streamlines the publishing workflow by decoupling copywriting from scheduling, saving creators significant time when preparing content batches.

**Independent Test**: Can be validated by creating a caption template with text, hashtags, and links, saving it to the user's template vault, attaching it to a media asset, and verifying the template persists and can be previewed or modified.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they draft and save a new caption template with a title, body text, and tags, **Then** the template is stored in their personal caption vault.
2. **Given** a saved caption template and a media asset in the library, **When** the user attaches the template to the media asset, **Then** the asset retains the associated caption text as its default publishing copy.
3. **Given** an existing caption template, **When** the user edits the template, **Then** updated copy is saved without altering previously published posts.
4. **Given** a user, **When** they delete a caption template, **Then** the template is removed from their vault while existing media items using that caption retain their assigned text.

---

### User Story 4 - Media Preview, Detail Inspection & Safe Asset Purging (Priority: P4)

As a content creator, I want to inspect full-screen video playback and high-resolution image previews with technical metadata, and permanently delete unwanted assets from both my library and cloud storage to reclaim storage quota.

**Why this priority**: Essential for media hygiene and quality assurance before content is fed into live publishing queues.

**Independent Test**: Can be validated by opening a media asset in full-screen preview, inspecting video playback and metadata (aspect ratio, duration, size), deleting the asset, and asserting that the asset is removed from the library and its storage footprint is refunded to the user's quota.

**Acceptance Scenarios**:

1. **Given** a video asset in the media library, **When** the user clicks the asset card, **Then** an interactive preview modal opens playing the video with audio controls and displaying technical metadata (resolution, aspect ratio, duration, file size, creation date).
2. **Given** a media asset consuming storage against the user's quota, **When** the user confirms deletion of the asset, **Then** the asset is permanently purged from the library and cloud storage, and the user's storage quota meter immediately updates to reflect the reclaimed space.
3. **Given** User 1 and User 2, **When** User 2 attempts to delete or inspect User 1's media asset by guessing its identifier, **Then** the request is rejected with a not found or forbidden response.

---

### Edge Cases

- **File Size Upper Bounds**: Uploading single files larger than the maximum allowed threshold (e.g. videos > 500 MB or images > 25 MB) must be rejected on the client before upload begins, and rejected on the server if bypassed.
- **Unsupported MIME Formats**: Attempting to upload unsupported or executable formats (e.g. `.exe`, `.sh`, `.pdf`, `.zip`) must be blocked by strict MIME-type and extension validation.
- **Corrupted or Incomplete Media Uploads**: If a client disconnects or aborts midway through an upload, unconfirmed storage artifacts must expire automatically without counting against the user's quota.
- **Quota Edge Collisions**: If a user has 100 MB of remaining quota and attempts to upload a 105 MB file, the upload must be rejected before transfer starts.
- **Aspect Ratio Diversity**: The system must detect and display standard short-form aspect ratios (9:16 vertical Reels, 16:9 landscape, 1:1 square, 4:5 portrait) to help users verify formatting for Facebook publishing.
- **Folder Deletion with Children**: Deleting a folder must never delete the underlying media assets; all items in that folder must be safely reassigned to the root / unorganized state.
- **Cross-Tenant Isolation**: Every database query, storage key, and API route must be scoped strictly to `user_id`. Users must never see, modify, or delete another user's media or folders.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an isolated Media Library scoped strictly to the authenticated user's workspace (`user_id`).
- **FR-002**: The system MUST support direct browser-to-cloud-storage uploads using presigned URLs to prevent server memory and bandwidth bottlenecks.
- **FR-003**: The system MUST support uploading both short-form video files (MP4, MOV, WebM) and image files (JPEG, PNG, WebP) from local user devices.
- **FR-004**: The system MUST automatically extract and record media metadata including file size, MIME type, media type, aspect ratio, and video duration in seconds.
- **FR-005**: The system MUST generate and store a thumbnail preview image for every uploaded video and image asset.
- **FR-006**: The system MUST enforce a default baseline storage quota per user (5 GB) and calculate real-time storage utilization.
- **FR-007**: The system MUST block upload authorization if the requested file size exceeds the user's remaining storage quota.
- **FR-008**: The system MUST allow users to create, rename, and delete custom folders with color identifiers.
- **FR-009**: The system MUST allow users to organize media items into folders and move items between folders.
- **FR-010**: Deleting a custom folder MUST preserve all contained media assets by moving them to an unorganized state.
- **FR-011**: The system MUST allow users to assign, search, and filter media assets by multi-tag taxonomy.
- **FR-012**: The system MUST allow users to create, edit, and delete reusable caption templates with titles, text content, and tags.
- **FR-013**: The system MUST allow users to attach a caption template to any media item as its default publishing copy.
- **FR-014**: The system MUST allow users to permanently delete media assets, purging the record from the database and deleting the corresponding cloud storage object to reclaim quota.
- **FR-015**: The system MUST provide an interactive media management UI at `/tenant/[subdomain]/media` featuring storage metering, drag-and-drop upload zone, folder sidebar, tag filtering, and asset preview modals.

---

### Key Entities *(include if feature involves data)*

- **Media Item**: Represents an individual video or image file in the user's library. Attributes: unique ID (UUID), user ID (UUID), folder reference (UUID, nullable), file name, file size in bytes, MIME type, media type (`video` | `image`), cloud storage object key, public/signed access URL, thumbnail preview URL, duration in seconds (for videos), aspect ratio string (e.g. `9:16`), tags array (JSONB), default caption template reference (UUID, nullable), created/updated timestamps.
- **Media Folder**: Represents a custom categorization container. Attributes: unique ID (UUID), user ID (UUID), folder name, display color, item count, created/updated timestamps. Compound uniqueness on `(user_id, name)`.
- **Caption Template**: Represents a saved copywriting snippet or template. Attributes: unique ID (UUID), user ID (UUID), title, body content, tags array (JSONB), created/updated timestamps.
- **Storage Quota**: Represents the user's storage limits and current consumption. Attributes: user ID (UUID), total quota bytes (e.g. 5,368,709,120 bytes for 5 GB), consumed bytes, item count.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can upload a 100 MB video file from their PC and have it ready with a thumbnail preview in the library in under 15 seconds on a standard broadband connection.
- **SC-002**: 100% of video and image uploads bypass application web servers by uploading directly to cloud object storage.
- **SC-003**: 0% cross-user media leakage: users can never view, download, or delete media assets belonging to another workspace.
- **SC-004**: Storage quota enforcement has 100% accuracy: no upload can succeed if it would cause total storage to exceed the user's quota.
- **SC-005**: 100% of deleted media items are purged from cloud storage, reclaiming the exact file size back to the user's storage quota.
- **SC-006**: Users can filter through a library of 500+ media items by folder or tag with instant UI response in under 200 milliseconds.

---

## Assumptions

- Users upload media files through modern desktop browsers supporting HTML5 File API and `fetch` with upload progress.
- Cloud storage (Cloudflare R2) credentials and bucket configurations are provided via environment variables (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`).
- The default storage quota is set to 5 GB (5,368,709,120 bytes) per user.
- Video aspect ratio extraction and thumbnail generation utilize standard client-side HTML5 canvas/video element capture during the upload step, or server-side media inspection.
- The media library operates within the existing authenticated tenant session verified via the middleware established in Spec 002.
