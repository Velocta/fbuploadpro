# Feature Specification: Cloudflare Asynchronous Media Downloader

**Feature Branch**: `feat/043-cloudflare-async-media-downloader`  
**Created**: 2026-10-15  
**Status**: Specified  
**Input**: Migrate Cloud Media Downloader from synchronous Vercel serverless execution to an asynchronous edge job queue running on Cloudflare Workers (`apps/worker`) with native Cloudflare R2 streaming, Supabase PostgreSQL job tracking, and real-time frontend status updates.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant Enqueue & Cloudflare Edge Ingestion (Priority: P1)

As a creator or social media manager, I want to submit an external media URL (TikTok, Instagram, YouTube, Google Drive, Dropbox, or direct video/image) and receive an instant response so that my browser is never blocked and the download process is handled reliably by Cloudflare Workers.

**Why this priority**:
Eliminates the critical 10-second Vercel serverless timeout and bypasses Vercel's 100 GB monthly bandwidth cap by offloading all heavy media streaming to Cloudflare Workers with native R2 streaming.

**Independent Test**:
Can be tested independently by issuing a `POST /api/media/download/enqueue` request to Cloudflare Worker with valid authentication and URL. Verifies that a `media_download_jobs` record is inserted with `status = 'queued'` and returned in under 100ms, and the background task begins streaming chunks to R2.

**Acceptance Scenarios**:
1. **Given** an authenticated user with sufficient storage quota, **When** they submit a valid public video URL, **Then** a job is created in `media_download_jobs` with `status = 'queued'`, and the API returns HTTP 202/200 with the `jobId` in < 100ms.
2. **Given** an invalid or private/loopback URL (e.g. `http://127.0.0.1` or `http://192.168.1.1`), **When** submitted, **Then** edge SSRF protection blocks the request immediately with `UNSAFE_URL` and HTTP 400.
3. **Given** a user whose remaining storage quota is less than the minimum required or content length, **When** submitted, **Then** the request is rejected with `QUOTA_EXCEEDED`.

---

### User Story 2 - Real-Time Download Progress & Status Tracking (Priority: P2)

As a creator, I want to see real-time progress (percentage, downloaded megabytes, status stage) for my active download so that I know exactly how much has downloaded.

**Why this priority**:
Gives users transparency and reassurance while downloading large files (up to 500 MB) without keeping connections frozen.

**Independent Test**:
Can be tested by polling `GET /api/media/download/jobs/:jobId` while an active download is in-flight and verifying that `progress_percent` and `downloaded_bytes` increment monotonically until completion.

**Acceptance Scenarios**:
1. **Given** an active download job in progress on Cloudflare, **When** client queries `/api/media/download/jobs/:id`, **Then** the current status (`downloading`), `downloaded_bytes`, and `progress_percent` (0-100%) are returned.
2. **Given** Cloudflare streaming chunks, **When** writing progress updates to Supabase, **Then** writes are throttled (at most once every 10% progress or 3 seconds) to prevent database connection saturation.

---

### User Story 3 - Non-Blocking Background Completion & Auto-Refresh (Priority: P3)

As a creator, I want to be able to close the download modal or navigate between pages while my video is downloading in the background, and have it automatically appear in my Media Library when ready.

**Why this priority**:
Drastically improves user experience, allowing uninterrupted multi-tasking across the application.

**Independent Test**:
Submit a download, close the modal, wait for the background job to finish, and observe the media item appear in the Media Explorer list with full metadata.

**Acceptance Scenarios**:
1. **Given** an active background download, **When** the user closes the modal, **Then** the job continues running uninterrupted on Cloudflare Workers.
2. **Given** a background job that finishes streaming to R2, **When** completed, **Then** Cloudflare worker inserts a record into `media_items`, increments `used_bytes` in `user_storage_quotas`, marks the job `completed`, and notifies the frontend.
3. **Given** the user is viewing the Media Explorer, **When** the job completes, **Then** the media grid automatically updates with the new item without requiring a manual page refresh.

---

### User Story 4 - Resilient Error Handling & Limit Enforcement (Priority: P4)

As a system administrator and user, I want downloads exceeding 500 MB or failing midway (e.g. source server disconnects) to fail gracefully, cleanly release incomplete R2 storage objects, and display an intuitive error message.

**Why this priority**:
Prevents orphaned objects in Cloudflare R2 and ensures users understand why a specific download could not be completed.

**Independent Test**:
Simulate an upstream server abort or file exceeding 500 MB; verify the job status updates to `failed` with the proper `error_code` and R2 aborts the upload.

**Acceptance Scenarios**:
1. **Given** a remote stream exceeding `MAX_MEDIA_DOWNLOAD_BYTES` (500 MB), **When** the byte counter crosses 500 MB, **Then** the stream is aborted, the job is marked `failed` with `FILE_TOO_LARGE`, and no corrupt entry is saved to `media_items`.
2. **Given** an external server returning HTTP 404/500 or terminating the socket early, **When** the worker catches the error, **Then** the job is marked `failed` with `DOWNLOAD_FAILED` and user-friendly explanation.

---

## Edge Cases & Non-Functional Requirements

- **SSRF in V8 Isolate**: Workers cannot use Node's `dns.lookup`. All hostnames and IPs must be evaluated using edge-safe CIDR ranges and URL protocol checks.
- **R2 Storage Binding**: Worker uses native Cloudflare R2 bindings (`env.MEDIA_BUCKET.put()`), accepting `ReadableStream` directly.
- **Token / Session Authentication**: Worker validates the incoming JWT against Supabase or shares the session secret verification.
- **Design System Immutability**: All UI progress bars, modals, and download indicators strictly reference `@web/lib/theme` and `globals.css` (no ad-hoc colors or capsule pill badges; never modify `DESIGN.md`).
- **Zero Local Builds Rule**: Do not run local `pnpm turbo run build` or `cargo check`. Verification is executed through remote GitHub Actions CI.
