# Feature Specification: Spec 031 — Cloud Media Downloader, Hybrid Link Resolution & Direct-to-R2 Ingestion

**Feature ID**: `031-cloud-media-downloader`  
**Status**: Approved  
**Created**: 2026-10-11  
**Constitution Authority**: Principle 23 (Cloud Media Downloader, Hybrid Link Resolution & Direct-to-R2 Ingestion)

---

## 1. Executive Summary & Problem Statement

Operators managing high-volume social media publishing workflows frequently source creative videos and images from web links, cloud drives, and social platforms (such as TikTok, Facebook Reels/Videos, Instagram Reels/Posts, X/Twitter, YouTube, Google Drive, Dropbox, and direct CDN links). Manually downloading files to a local computer and re-uploading them into the Media Library wastes bandwidth, clutters local storage, and loses original post captions.

**Spec 031** introduces a dedicated **Downloader** section directly below **Media Library** in the workspace sidebar (`/downloader`, rewriting to `/tenant/[subdomain]/downloader`). Operators can paste a single link or a multi-line batch of links, select any nested folder in their Media Library (defaulting to an automatically created or existing **`Downloads`** folder, with an inline **`New Folder`** button), and stream the resolved videos and images **directly from the cloud into their Cloudflare R2 Media Library**—never saving files to the user's local PC. Original post captions/titles are automatically mapped to `media_items.caption_text` (falling back to the stripped filename), intra-batch duplicate URLs are deduplicated automatically, multi-item/carousel posts save all supported media assets, and a unified batch progress bar with a **Recent Downloads** list lets operators inspect results, retry failed links, or jump straight to the target folder in 1 click.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1: Primary Sidebar Navigation to Cloud Downloader (Priority: P1)
**As a** workspace operator,  
**When** I view the primary navigation group in the left workspace sidebar,  
**Then** I see **Downloader** positioned as a top-level sibling directly below **Media Library**, and clicking it navigates to `/tenant/[subdomain]/downloader` (`/downloader` on the tenant subdomain).

**Acceptance Criteria**:
1. **US1/AC1**: `WorkspaceSidebar` (`apps/web/src/components/workspace/workspace-sidebar.tsx`) renders a top-level `SidebarMenuItem` labeled **Downloader** directly below **Media Library** in the primary top `SidebarGroup` (`Home` $\rightarrow$ `Media Library` $\rightarrow$ `Downloader`), above `SidebarSeparator`.
2. **US1/AC2**: Clicking **Downloader** routes to `/tenant/${subdomain}/downloader` and highlights the **Downloader** sidebar button (`isActive={isDownloaderActive}`) when `pathname` starts with `/tenant/${subdomain}/downloader`.
3. **US1/AC3**: On mobile viewports (`< 768px`), selecting **Downloader** automatically closes the mobile navigation drawer sheet (`setOpenMobile(false)`).

---

### User Story 2: Auto-Provisioned `Downloads` Default Folder, Nested Folder Selection & Inline `New Folder` Creation (Priority: P1)
**As a** workspace operator opening the Downloader,  
**When** the page loads,  
**Then** the destination folder selector defaults to my root-level **`Downloads`** folder (automatically creating it in my Media Library if it does not yet exist), while allowing me to choose **`All Media` (Root)** or any nested subfolder, or create a new folder inline via a **`New Folder`** button.

**Acceptance Criteria**:
1. **US2/AC1**: When the Downloader view initializes and fetches `/api/tenant/${subdomain}/media/folders`, if a root-level folder (`parentId === null`) named `Downloads` (case-insensitive) exists, it is automatically selected as the default target folder.
2. **US2/AC2**: If no root-level `Downloads` folder exists yet, the Downloader automatically creates it via `POST /api/tenant/${subdomain}/media/folders` (`{ name: 'Downloads', parentId: null }`) and selects it as the active destination folder.
3. **US2/AC3**: The destination folder selector (`data-testid="downloader-folder-select"`) displays `All Media (Root)` and all nested folders formatted with their full ancestry path (`formatFolderAncestryPath`, e.g., `Downloads`, `Campaign A / Reels`), allowing the operator to switch to any folder or root (`folderId = null`).
4. **US2/AC4**: Clicking the inline **`New Folder`** button (`data-testid="downloader-new-folder-button"`) opens a lightweight inline form or dialog to create a new folder (at root or inside the currently selected folder) via `POST /api/tenant/${subdomain}/media/folders` and immediately selects the newly created folder as the active download destination.

---

### User Story 3: Single & Batch Link Submission, Intra-Batch URL Deduplication & Multi-Asset Carousel Ingestion (Priority: P1)
**As a** workspace operator,  
**When** I paste one or multiple links (one per line) into the Downloader and click **Save to Media Library**,  
**Then** duplicate URLs in the pasted batch are automatically deduplicated, each unique link is resolved and streamed directly into Cloudflare R2 and `media_items` without downloading to my PC, and multi-media posts (such as carousels) save all supported videos and images into the selected folder.

**Acceptance Criteria**:
1. **US3/AC1**: The URL input textarea (`data-testid="downloader-url-input"`) accepts single or multiple URLs separated by newlines (or whitespace/commas), validates that at least one valid `http://` or `https://` URL is entered, and surfaces inline field validation (`role="alert"`) if empty or invalid.
2. **US3/AC2**: Identical URLs within the same pasted batch are automatically deduplicated (`deduplicateBatchUrls`) before dispatching cloud ingestion requests, reporting the count of skipped duplicate links when applicable.
3. **US3/AC3**: For each unique link, `POST /api/tenant/[subdomain]/media/downloader` resolves the remote link on the server, streams the binary media payload and optional thumbnail directly to Cloudflare R2 (`storage.putObject`), and inserts the record(s) into `media_items` scoped to `(session.userId, targetFolderId)`—never triggering a browser file download to the user's PC.
4. **US3/AC4**: When a resolved link contains multiple supported media assets (e.g., a multi-image/video carousel post), all supported assets (`video/mp4`, `video/quicktime`, `video/webm`, `image/jpeg`, `image/png`, `image/webp`) from that post are uploaded to R2 and persisted in `media_items` under the selected folder.

---

### User Story 4: Hybrid Link Resolution, Auto-Populated Post Captions & SSRF Security (Priority: P1)
**As a** workspace operator downloading media from social platforms, cloud drives, or direct links,  
**When** a link is processed by the backend,  
**Then** the hybrid resolver extracts the highest-quality supported video/image stream and thumbnail, automatically populates `caption_text` with the original post caption/title (falling back to the stripped filename), and enforces strict SSRF and size protections.

**Acceptance Criteria**:
1. **US4/AC1**: The backend link resolver supports:
   - Pluggable external extractor API (`DOWNLOADER_EXTRACTOR_API_URL`, e.g., Cobalt / `yt-dlp` JSON API) when configured.
   - Built-in serverless resolvers for TikTok, Facebook Reels/Videos, Instagram Reels/Posts, X/Twitter, YouTube, Google Drive share links, Dropbox share links, OpenGraph / Twitter Card / JSON-LD `VideoObject` media pages, and direct `.mp4`/`.mov`/`.webm`/`.jpg`/`.png`/`.webp` URLs.
2. **US4/AC2**: If the source link provides a post caption, description, or title, `media_items.caption_text` is automatically populated with that extracted text (truncated to max `5000` characters). If no post caption/title is available, `caption_text` defaults to `deriveDefaultCaptionFromFilename(name)`.
3. **US4/AC3**: All outbound URLs (initial link, redirect targets, and resolved media stream URLs) are validated against SSRF guards (`validateSafeRemoteUrl`), rejecting non-HTTP(S) protocols, `localhost`, loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`, `fe80::/10`), and RFC1918 private network ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`) with HTTP 400.
4. **US4/AC4**: Files exceeding the 500 MB (`524,288,000` bytes) limit or unsupported MIME types are rejected cleanly with a clear, customer-friendly error message.

---

### User Story 5: Unified Batch Progress Bar, Recent Downloads List, "Open in Folder" & Retry (Priority: P1)
**As a** workspace operator running a single or batch download,  
**When** links are being saved or have completed,  
**Then** I see a single unified Windows Copy-style batch progress bar during active transfers and a **Recent Downloads** list below showing each saved asset with a 1-click **"Open in Folder"** button and a **Retry** button for any failed links.

**Acceptance Criteria**:
1. **US5/AC1**: While one or more links are actively being processed, a single unified progress banner (`data-testid="downloader-batch-progress"`) renders displaying overall completion percentage, `"Saving X of Y links to Media Library..."`, and active link status—never rendering multiple simultaneous progress bars.
2. **US5/AC2**: Below the input card, the **Recent Downloads** section (`data-testid="downloader-recent-list"`) displays each processed item:
   - For **Saved** items: thumbnail/video preview, asset name, auto-populated `captionText`, formatted file size, target folder path badge/label, and a 1-click **"Open in Folder"** button (`data-testid="downloader-open-folder-btn"`) that routes to `/tenant/${subdomain}/media?folder=${folderId}` (or `/tenant/${subdomain}/media` when saved to root `All Media`).
   - For **Failed** links: the source URL, a clear human-friendly explanation of why the link could not be saved, and a 1-click **"Retry"** button (`data-testid="downloader-retry-btn"`) that re-attempts saving that link into the selected target folder.

---

## 3. Functional Requirements

- **FR-001**: Extend `IStorageService` in `@fbuploadpro/contracts` and `R2StorageProvider` / `MockStorageProvider` in `apps/web/src/lib/storage.ts` with `putObject(params: PutObjectParams): Promise<PutObjectResult>` to upload server-side binary buffers/streams directly to Cloudflare R2 and return `{ key, publicUrl, byteLength }`.
- **FR-002**: Define Zod contracts in `@fbuploadpro/contracts` (`packages/contracts/src/domain/downloader.ts`):
  - `DownloaderIngestRequestSchema`: `{ url: string, folderId?: string | null }`
  - `DownloaderIngestResponseSchema`: `{ sourceUrl: string, platform: string, items: MediaItemResponse[] }`
  - `deduplicateBatchUrls(rawInput: string): { urls: string[], duplicateCount: number, invalidLines: string[] }`
  - `validateSafeRemoteUrl(rawUrl: string): { valid: boolean, url?: URL, reason?: string }`
- **FR-003**: Implement `POST /api/tenant/[subdomain]/media/downloader` in `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts` with session authentication, tenant isolation (`session.subdomain === subdomain`), target folder ownership verification (`media_folders` belongs to `session.userId`), SSRF validation, hybrid link resolution, direct R2 `putObject` upload for media and thumbnails, and `media_items` database insertion.
- **FR-004**: Update `WorkspaceSidebar` (`apps/web/src/components/workspace/workspace-sidebar.tsx`) to include the top-level **Downloader** menu item directly below **Media Library**.
- **FR-005**: Build the `MediaDownloader` component (`apps/web/src/components/media/media-downloader.tsx`) and tenant page route (`apps/web/src/app/tenant/[subdomain]/downloader/page.tsx`) implementing auto-provisioned `Downloads` default folder selection, nested folder selector, inline `New Folder` creation, single/batch URL input with deduplication, unified batch progress bar, and Recent Downloads list with `Open in Folder` and `Retry` actions.

---

## 4. Clarifications Resolved (Phase 0 `/grill-me` & Phase 3)

- **Q1 (Sidebar Structure)**: Place **Downloader** as a top-level sibling item right below **Media Library** in the primary sidebar group (`Home` $\rightarrow$ `Media Library` $\rightarrow$ `Downloader`).
- **Q2 (Backend Extraction Architecture)**: Hybrid Serverless + Pluggable Extractor—works out-of-the-box on Vercel for major social links (TikTok, FB, IG, X, YouTube), cloud drives (Google Drive, Dropbox), OpenGraph pages, and direct media URLs, with optional support for an external Cobalt/`yt-dlp` API endpoint (`DOWNLOADER_EXTRACTOR_API_URL`).
- **Q3 (Link Submission Mode)**: Support both single links and multi-line batch pasting (paste 1 or many URLs, one per line, and immediately save them all to the chosen Media Library folder).
- **Q4 (Destination Folder Behavior)**: Let the user select any nested folder from their Media Library, defaulting to an automatically created or existing root-level **`Downloads`** folder in the Media Library, plus an inline **`New Folder`** button right in the Downloader.
- **Q5 (Caption Population)**: Automatically populate `caption_text` with the original post caption/title from the link (falling back to the stripped filename).
- **Q6 (Progress & Results UX)**: Unified batch progress bar during active downloads, plus a clean **Recent Downloads** list below showing each saved asset (thumbnail, caption, folder, and **"Open in Folder"** link) and any failed links with a **Retry** button.
- **Q7 (Duplicates & Multi-Media Carousels)**: Automatically deduplicate identical URLs within the pasted batch, and if a post contains multiple supported media items (such as a carousel of images/videos), save all supported media items from that post into the target folder.
