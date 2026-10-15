# Feature Specification: 046 Downloader and Media Library Audit Remediation

**Feature Directory**: `specs/046-downloader-and-media-library-audit-remediation`  
**Status**: In Implementation  
**Created**: 2026-10-15  
**Source**: [`findings.md`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/sync_latest_main_code/findings.md)

---

## 1. Executive Summary & Vision

This specification defines the complete, zero-omission remediation of all 19 architectural defects, edge cases, and user experience regressions documented in `findings.md` across the **Cloud Media Downloader** (`apps/worker`, `apps/web/src/components/media/media-downloader.tsx`, `apps/web/src/lib/media-downloader.ts`) and **Dedicated User Media Library** (`apps/web/src/components/media/media-library-explorer.tsx`, `apps/web/src/components/media/upload-queue-banner.tsx`, `/media/*` API routes).

Key architectural objectives:
1. **Unrestricted Cloudflare R2 Alignment**: Completely eradicate legacy references to the dropped `user_storage_quotas` table in `downloader-engine.ts`, conforming strictly to Spec 028.
2. **Unified Edge Resolution & Rich Metadata Preservation**: Equip worker download execution with link resolution, social caption extraction, video thumbnail generation, and multi-slide carousel persistence.
3. **Memory Safety & Streaming Resilience**: Eliminate peak 800 MB RAM allocations and unbounded recursion in Next.js download routes; add stuck download job automated cleanup (`fail_stuck_download_jobs`).
4. **Media Library Fidelity & Hardware Resource Protection**: Capture video poster frames and pixel dimensions (`width`, `height`) during PC uploads; fix Cartesian false positives in duplicate checking; unblock search, filtering, and `4:5` aspect ratios; detach offscreen video elements to prevent decoder exhaustion; and preserve non-Latin Unicode filenames.

---

## 2. Prioritized User Stories

### User Story 1 (P1): Unrestricted, High-Fidelity Cloud Media Ingestion
**As an** operator downloading media links from social platforms and cloud storage,  
**I want** downloads to succeed without fake quota errors, save actual video files instead of raw HTML pages, capture social captions and video thumbnails, and preserve the original destination folder when retrying,  
**So that** my downloaded assets are immediately ready for publishing with accurate metadata and organized into the intended folders.

**Acceptance Criteria**:
- `downloader-engine.ts` executes without calling `user_storage_quotas` or failing with `QUOTA_EXCEEDED`.
- HTML links (Google Drive, Instagram, TikTok, YouTube) are resolved to actual direct media streams before saving to Cloudflare R2.
- Video downloads preserve extracted post captions, thumbnails, durations, and aspect ratios.
- Google Drive large-file virus scan interstitial HTML pages (`confirm=t`) are automatically handled and bypassed.
- Retrying a failed download in `MediaDownloader` saves to the entry's originally recorded `folderId`.
- Download jobs stuck in `downloading` for $>15\text{ minutes}$ are automatically transitioned to `failed` by a cleanup routine.

---

### User Story 2 (P1): Accurate Metadata Extraction & Poster Frame Generation on PC Uploads
**As a** content creator uploading multi-gigabyte folders and videos from my PC,  
**I want** video thumbnails and exact pixel dimensions (`width`, `height`) to be captured automatically, progress bars to reflect actual transferred bytes smoothly, and my browser to not crash from hardware decoder exhaustion,  
**So that** my Media Library grid displays rich poster previews and accurate aspect ratios without manual thumbnail editing.

**Acceptance Criteria**:
- Client metadata extractor returns `width` and `height` and passes them to `/media/confirm`.
- Videos uploaded from PC automatically capture a WebP poster frame from `<canvas>` and upload it to R2 presigned thumbnail URLs.
- Offscreen `<video>` elements used during metadata probing are explicitly paused, src-cleared, and unloaded to prevent decoder pool exhaustion.
- `UploadQueueBanner` uses real-time byte streaming and never increments `transferredBytes` for failed files.
- Files with Arabic, Urdu, Hindi, Chinese, or Japanese filenames preserve their Unicode characters in R2 storage keys.

---

### User Story 3 (P2): Precise Duplicate Detection & Unblocked Search/Filtering
**As an** operator organizing thousands of assets in nested folders,  
**I want** duplicate detection to check exact `(name, fileSize, folderId)` tuples across nested batches, server-side search/filters to work immediately without being blocked by initial page state, and portrait `4:5` media to be classified and filterable,  
**So that** I can reliably locate, filter, and deduplicate my media library at high scale.

**Acceptance Criteria**:
- `/media/check-duplicates` performs tuple matching per folder and prevents false-positive cross-products.
- `hasInitialData` does not permanently block subsequent searches, folder changes, aspect ratio filters, or sort queries.
- `4:5` aspect ratio is supported in classification and filtering dropdowns.
- Network errors during folder navigation surface a retryable error banner instead of a silent empty state.

---

### User Story 4 (P3): 1-Click Publishing & Content-Hash Deduplication Readiness
**As an** operator managing multi-page queues,  
**I want** to schedule any media asset directly from the Media Library or Recent Downloads into a Facebook Page queue with 1 click,  
**So that** I don't have to navigate back and forth between media and page workspace tabs.

**Acceptance Criteria**:
- Direct "Schedule / Add to Queue" CTA available on `MediaAssetCard`, `BatchActionBar`, and `RecentDownloads` list.
- SHA-256 content hashing supported in contracts for content-level duplicate detection.

---

## 3. Key Entities & Data Constraints

1. **`media_download_jobs`**:
   - `id`: UUID (PK)
   - `user_id`: UUID
   - `source_url`: TEXT
   - `status`: `'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled'`
   - `metadata`: JSONB (storing `media_ids: string[]`, `caption`, `thumbnail_url`, `error_message`, `byte_size`)
2. **`media_items`**:
   - `width`: INT NULL (pixel width, $> 0$)
   - `height`: INT NULL (pixel height, $> 0$)
   - `aspect_ratio`: `'9:16' | '16:9' | '1:1' | '4:5' | 'unknown'`
   - `thumbnail_url`: TEXT NULL
   - `thumbnail_key`: VARCHAR NULL

---

## 4. Non-Functional Requirements & Safety Guards

- **Strict R2 Storage Purity**: Zero queries against `user_storage_quotas`.
- **Memory Safety**: No recursive array concatenation of multi-hundred-megabyte buffers.
- **Decoder Pool Cleanup**: Explicit `video.removeAttribute('src'); video.load()` in `extractMediaMetadata`.
- **Theme Compliance**: All new UI components must reference `@web/lib/theme` tokens and zero unboxed badges.
