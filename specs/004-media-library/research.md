# Research: Dedicated User Media Library & Cloudflare R2 Uploads

This document details the architectural decisions, trade-offs, and technical rationale for Spec 004: Dedicated User Media Library & Cloudflare R2 Uploads.

---

## 1. Cloudflare R2 Direct Uploads via S3 Presigned PUT URLs

### Decision
Implement direct browser-to-cloud-storage uploads using Cloudflare R2's S3-compatible API with presigned `PUT` URLs:
1. **Presigned Upload Workflow**:
   - The user selects a media file (video or image) in the browser.
   - The browser calculates client metadata (file size, MIME type, dimensions, aspect ratio, duration) and generates a thumbnail frame via HTML5 Canvas.
   - The browser requests presigned upload URLs from the application control plane:
     `POST /api/tenant/[subdomain]/media/upload-url` with `{ fileName, fileSize, mimeType, thumbnailMimeType }`.
   - The server validates the user's remaining storage quota, MIME type whitelist, and file size upper bounds.
   - If valid, the server generates two presigned `PUT` URLs using `@aws-sdk/s3-request-presigner` and `@aws-sdk/client-s3`:
     - One for the primary media file: `users/${userId}/media/${mediaId}/${sanitizedFileName}`
     - One for the thumbnail image: `users/${userId}/thumbnails/${mediaId}.webp`
   - Presigned URL validity is bounded to 15 minutes (900 seconds).
   - The browser directly uploads the binaries to Cloudflare R2 using `fetch` or `XMLHttpRequest` with upload progress event listeners.
   - Upon upload completion, the browser calls:
     `POST /api/tenant/[subdomain]/media/confirm` to persist the asset metadata in PostgreSQL and commit the storage quota reservation.

### Rationale
- **Zero Server Memory / Bandwidth Bottlenecks**: High-definition video files (up to 500 MB) bypass the Next.js Node.js server and edge routers entirely. The application servers only handle small JSON metadata envelopes.
- **Cost & Performance Efficiency**: Cloudflare R2 features zero egress fees and high-speed global ingestion via Cloudflare Anycast edge locations.
- **Security & Multi-Tenant Isolation**: S3 object keys are strictly scoped with `users/${userId}/...` prefix, preventing path collisions and ensuring cryptographically isolated storage paths.

### Alternatives Considered
- **Proxying Uploads Through Next.js API Routes**: Streaming 100-500 MB files through Next.js serverless/Node.js functions causes memory exhaustion, 413 Payload Too Large errors on edge ingress, and massive bandwidth consumption.
- **Presigned POST Form Uploads**: Requires multipart form parsing and extra policy conditions; S3 presigned `PUT` URLs are simpler, support streaming directly with native browser `fetch(url, { method: 'PUT', body: file })`, and report accurate byte progress via `XMLHttpRequest.upload`.

---

## 2. Storage Quota Enforcement & Real-Time Accounting

### Decision
Implement strict two-phase quota enforcement and atomic accounting:
1. **Quota Baseline**:
   - Default baseline quota of 5 GB (5,368,709,120 bytes) per user.
   - Tracked in a dedicated table `user_storage_quotas` with columns `(user_id, total_bytes, used_bytes, updated_at)` and non-negative check constraints (`total_bytes >= 0`, `used_bytes >= 0`).
2. **Phase 1: Pre-Flight Quota Check**:
   - When generating presigned upload URLs (`POST /media/upload-url`), the server queries `user_storage_quotas`.
   - Upload is rejected with `403 Forbidden` (`INSUFFICIENT_STORAGE_QUOTA`) if `used_bytes + incoming_file_size > total_bytes`.
3. **Phase 2: Atomic Confirmation & Commit**:
   - In `POST /media/confirm`, the server executes an atomic database transaction:
     - Re-verifies quota condition: `used_bytes + file_size <= total_bytes`.
     - Atomically increments `used_bytes = used_bytes + file_size`.
     - Inserts the `media_items` record.
   - If quota was exhausted concurrently between presigning and confirmation, the transaction rolls back cleanly.
4. **Deletion & Quota Reclamation**:
   - When a media item is deleted (`DELETE /media/[mediaId]`), the server deletes the storage objects in R2 and atomically decrements `used_bytes`:
     `UPDATE user_storage_quotas SET used_bytes = GREATEST(0, used_bytes - $1), updated_at = now() WHERE user_id = $2`.
5. **Self-Healing Reconciliation**:
   - A reconciliation utility `reconcileUserQuota(userId)` computes `SELECT COALESCE(SUM(file_size), 0) FROM media_items WHERE user_id = $1` and repairs any drift caused by aborts or unexpected errors.

### Rationale
- Guaranteed quota consistency without race conditions under concurrent uploads.
- Immediate space reclamation when assets are deleted, ensuring creators never hit false quota limits.
- Non-negative constraints protect database integrity at the engine level.

### Alternatives Considered
- **Dynamic Aggregation (`SUM(file_size)`) on Every Request**: Running `SUM()` on every upload and page load introduces severe table scan latency as media libraries scale to thousands of items.
- **Asynchronous Event-Driven Quota Counting**: Delayed quota accounting allows malicious or accidental over-allocation where a user uploads dozens of large files simultaneously before the quota reacts.

---

## 3. Client-Side Media Inspection & Thumbnail Generation

### Decision
Utilize modern HTML5 File, Video, Image, and Canvas browser APIs to extract technical metadata and generate thumbnails entirely on the client before upload:
1. **Video Inspection & Thumbnail Extraction**:
   - Load video file into an in-memory object URL: `const url = URL.createObjectURL(file)`.
   - Attach to an offscreen `<video>` element with `muted = true` and `preload = "metadata"`.
   - On `loadedmetadata`: read `videoWidth`, `videoHeight`, and `duration`.
   - Seek to 0.5s (or 10% of duration) to bypass black initial frames: `video.currentTime = Math.min(0.5, video.duration / 2)`.
   - On `seeked`: render frame to an offscreen `<canvas width="480" height="854">` preserving aspect ratio.
   - Export canvas as WebP blob (`canvas.toBlob(..., 'image/webp', 0.85)`).
2. **Image Inspection & Thumbnail Generation**:
   - Load image file into an offscreen `Image` object.
   - Read `naturalWidth` and `naturalHeight`.
   - Draw downscaled preview frame to `<canvas>` for uniform thumbnail resolution.
3. **Aspect Ratio Categorization**:
   - Calculate dimension ratio `r = width / height`.
   - Map to standardized social media aspect ratio labels:
     - `9:16` if $0.50 \le r \le 0.62$ (Vertical Reel / Story)
     - `16:9` if $1.70 \le r \le 1.85$ (Landscape Video)
     - `1:1` if $0.95 \le r \le 1.05$ (Square Post)
     - `4:5` if $0.75 \le r \le 0.85$ (Portrait Post)
     - `custom` for non-standard aspect ratios.
4. **Server Boundary Validation**:
   - Client sends extracted metadata in `POST /media/confirm`.
   - The server validates MIME type against whitelist (`video/mp4`, `video/quicktime`, `video/webm`, `image/jpeg`, `image/png`, `image/webp`), asserts file size limits (videos $\le$ 500 MB, images $\le$ 25 MB), and validates aspect ratio format.

### Rationale
- Zero server-side video transcoding or FFmpeg infrastructure required for ingestion.
- Instant, fluid user experience with immediate client-side thumbnail previews during upload progress.
- Clean separation of concern: client generates lightweight thumbnails, R2 stores them, web application merely coordinates URLs.

### Alternatives Considered
- **Server-Side FFmpeg Ingestion Pipeline**: Requires heavy container infrastructure, VPS transcoders, or Cloudflare Workers with WASM FFmpeg, dramatically increasing hosting complexity and operational cost.
- **Cloudflare Stream / Image Resizing**: Incurs additional paid external dependencies per seat and vendor lock-in.

---

## 4. Custom Folders & Multi-Tagging Organization

### Decision
Implement hierarchical grouping and multi-tag filtering with non-destructive folder lifecycle:
1. **Folder Container Model**:
   - `media_folders` table keyed on `(id, user_id)`.
   - Fields: `name`, `color` (e.g. `blue`, `green`, `purple`, `amber`, `rose`, `slate`), `created_at`, `updated_at`.
   - Unique constraint: `UNIQUE (user_id, name)` prevents duplicate folder names per workspace.
2. **Non-Destructive Folder Deletion**:
   - Media items reference folders via:
     `CONSTRAINT fk_media_items_user_folder FOREIGN KEY (user_id, folder_id) REFERENCES media_folders(user_id, id) ON DELETE SET NULL`
   - When a folder is deleted, PostgreSQL automatically cascades `folder_id = NULL` to all contained items.
   - Preserves 100% of media assets in the default "Unorganized" view, preventing accidental data loss.
3. **Multi-Tag Taxonomy**:
   - Stored in `media_items.tags` as a `JSONB` array of strings (e.g., `["#viral", "#ad", "#q4"]`).
   - Queryable with PostgreSQL JSONB containment (`tags @> '["#viral"]'::jsonb`) and indexed via GIN for instant filtering (<20ms over 500+ items).

### Rationale
- Creator peace of mind: Deleting an organizational folder must never delete raw creative assets.
- Fast, flexible tagging: JSONB tags allow freeform tagging without cumbersome junction tables for simple tag lists.

### Alternatives Considered
- **Cascading Folder Deletion (`ON DELETE CASCADE`)**: Dangerously purges all user media assets if a folder is deleted, causing catastrophic quota and content loss.
- **Relational `tags` and `media_tags` Junction Tables**: Adds significant join overhead and migration complexity for simple array-of-tags tagging.

---

## 5. Reusable Caption Templates Architecture

### Decision
Implement a decoupled copywriting vault:
1. **Caption Template Model**:
   - `caption_templates` table keyed on `(id, user_id)`.
   - Fields: `title` (e.g. "Viral Reel CTA - Q4"), `content` (full text with emojis, line breaks, hashtags, and links), `tags` (`JSONB`).
2. **Attachment to Media Assets**:
   - `media_items` includes:
     - `caption_template_id UUID NULL REFERENCES caption_templates(id) ON DELETE SET NULL`
     - `caption_text TEXT NULL`
   - When a user attaches a caption template to a media item:
     - The template reference `caption_template_id` is linked.
     - The text content is snapshotted into `caption_text`.
   - If the template is later edited or deleted, existing media items retain their snapshotted `caption_text` copy, preserving publishing integrity.

### Rationale
- Copywriters can refine global templates without accidentally breaking or altering existing scheduled posts.
- Deleting a template never leaves media assets with missing captions.

---

## 6. Storage Service Interface & Decoupling for Testing

### Decision
Decouple object storage operations behind an abstract storage provider interface (`IStorageService`):
1. **Interface Contract**:
   ```typescript
   export interface IStorageService {
     getPresignedUploadUrl(params: {
       key: string;
       contentType: string;
       expiresInSeconds?: number;
     }): Promise<string>;

     deleteObject(params: {
       key: string;
     }): Promise<void>;

     getPublicUrl(key: string): string;
   }
   ```
2. **Implementations**:
   - `R2StorageProvider`: Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` against Cloudflare R2 endpoint `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.
   - `MockStorageProvider`: In-memory implementation for automated tests (Vitest) and CI environments without live cloud credentials, simulating presigned URLs and tracking deleted objects.
3. **Provider Factory**:
   - Instantiates `R2StorageProvider` when `R2_ACCOUNT_ID` and credentials are present, falling back cleanly to `MockStorageProvider` during development and test runs.

### Rationale
- Adheres to Constitution Principle II (Service Boundary Isolation) and Principle I (TDD with deterministic automated testing).
- Enables CI pipelines to run quality gates and unit/integration tests without external network or Cloudflare R2 secrets.
