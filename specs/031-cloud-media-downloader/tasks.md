# Implementation Tasks: Spec 031 — Cloud Media Downloader, Hybrid Link Resolution & Direct-to-R2 Ingestion

**Feature ID**: `031-cloud-media-downloader`  
**Plan**: [`plan.md`](./plan.md)  
**Specification**: [`spec.md`](./spec.md)

---

## Phase 1: Foundational Storage & Domain Contracts (`backend-engineer`)

- [x] **T311** [P] Extend `IStorageService` in `packages/contracts/src/domain/storage.ts` and implement `putObject(params: PutObjectParams): Promise<PutObjectResult>` in `R2StorageProvider` and `MockStorageProvider` in `apps/web/src/lib/storage.ts`.
- [x] **T312** [P] [US3] [US4] Create `packages/contracts/src/domain/downloader.ts` (and export from `packages/contracts/src/index.ts`) defining `DownloaderSourcePlatformValues`, `DownloaderIngestRequestSchema`, `DownloaderIngestResponseSchema`, `detectSourcePlatform`, `validateSafeRemoteUrl` (blocking non-HTTP/S, `localhost`, loopback `127.0.0.0/8`, link-local `169.254.0.0/16`, RFC1918 private IPs, and IPv6 private/loopback ranges), and `deduplicateBatchUrls`.

---

## Phase 2: Hybrid Cloud-to-R2 Link Resolver & API Endpoint (`backend-engineer`)

- [x] **T313** [US3] [US4] Implement `apps/web/src/lib/media-downloader.ts` providing the hybrid link resolver (`resolveAndUploadMediaFromUrl`) supporting pluggable `DOWNLOADER_EXTRACTOR_API_URL` (Cobalt / `yt-dlp` JSON APIs), built-in serverless resolvers (TikTok, X/Twitter via FxTwitter API, Facebook/Instagram/YouTube/Web OpenGraph & JSON-LD `VideoObject` / carousel media extraction, Google Drive & Dropbox direct stream conversion, and direct `.mp4`/`.mov`/`.webm`/`.jpg`/`.png`/`.webp` URLs), SSRF validation on every redirect/stream hop, 500 MB size cap enforcement, direct R2 `putObject` upload for media and thumbnails, and automatic `captionText` population from post caption/title (falling back to `deriveDefaultCaptionFromFilename`).
- [x] **T314** [US3] [US4] Implement `POST /api/tenant/[subdomain]/media/downloader` in `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts` enforcing session auth, tenant subdomain isolation, target `folderId` ownership verification in `media_folders`, cloud R2 ingestion via `resolveAndUploadMediaFromUrl`, and atomic insertion into `media_items`.

---

## Phase 3: Workspace Sidebar & Cloud Media Downloader UI (`frontend-engineer`)

- [x] **T315** [P] [US1] Update `WorkspaceSidebar` in `apps/web/src/components/workspace/workspace-sidebar.tsx` to render a top-level **Downloader** `SidebarMenuItem` directly below **Media Library** in the primary top `SidebarGroup`, routing to `/tenant/${subdomain}/downloader` with active state highlighting and mobile drawer auto-close.
- [x] **T316** [US2] [US3] [US5] Create `MediaDownloader` in `apps/web/src/components/media/media-downloader.tsx` and `/tenant/[subdomain]/downloader/page.tsx` in `apps/web/src/app/tenant/[subdomain]/downloader/page.tsx` featuring:
  1. Automatic lookup or creation of the root-level **`Downloads`** folder on mount as the default selected target folder.
  2. Nested folder selector (`data-testid="downloader-folder-select"`) showing `All Media (Root)` and all nested folders with ancestry paths (`formatFolderAncestryPath`), plus an inline **`New Folder`** button (`data-testid="downloader-new-folder-button"`) and dialog.
  3. Multi-line URL input (`data-testid="downloader-url-input"`) supporting single or batch URLs (one per line) with automatic intra-batch deduplication (`deduplicateBatchUrls`) and inline validation (`role="alert"`).
  4. Unified Windows Copy-style batch progress bar (`data-testid="downloader-batch-progress"`) displaying overall completion percentage and `"Saving X of Y links to Media Library..."`.
  5. **Recent Downloads** list (`data-testid="downloader-recent-list"`) showing saved items (thumbnail preview, filename, auto-populated `captionText`, file size, target folder path, and 1-click **"Open in Folder"** button routing to `/tenant/${subdomain}/media?folder=${folderId}`) and failed links with a 1-click **"Retry"** button.

---

## Phase 4: Contract, API & UI Test Verification (`qa-engineer`)

- [x] **T317** [P] [US3] [US4] Create `packages/contracts/tests/downloader-contracts.test.ts` testing `validateSafeRemoteUrl` (valid URLs vs SSRF private/loopback IPs and non-HTTP schemes), `deduplicateBatchUrls`, `detectSourcePlatform`, and `DownloaderIngestRequestSchema` / `DownloaderIngestResponseSchema` validation.
- [x] **T318** [P] [US3] [US4] Create `apps/web/tests/api/media-downloader.test.ts` testing `POST /api/tenant/[subdomain]/media/downloader` across direct video/image links, OpenGraph / social post extraction with caption and thumbnail ingestion, multi-item carousel posts, pluggable extractor API delegation, SSRF blocking, >500 MB rejection, cross-tenant `folderId` rejection, and `MockStorageProvider.putObject` verification.
- [x] **T319** [P] [US1] [US2] [US5] Update `apps/web/tests/ui/workspace-sidebar.test.tsx` and create `apps/web/tests/ui/media-downloader.test.tsx` verifying the top-level **Downloader** sidebar item, auto-creation/selection of the default **`Downloads`** folder, nested folder selection & inline **New Folder** creation, batch URL deduplication & unified progress bar, Recent Downloads list with auto-populated captions, **"Open in Folder"** navigation, and failed link **"Retry"**.
