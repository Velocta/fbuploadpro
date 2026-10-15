# Implementation Plan: 046 Downloader and Media Library Audit Remediation

**Feature Directory**: `specs/046-downloader-and-media-library-audit-remediation`  
**Spec**: [spec.md](./spec.md)  
**Created**: 2026-10-15  
**Status**: Ready for Implementation

---

## 1. Technical Architecture & Component Mapping

### 1.1 Cloud Media Downloader Architecture
- **Worker Downloader Purity (`apps/worker/src/services/downloader-engine.ts`)**:
  - Remove `getUserStorageQuota`, `QUOTA_EXCEEDED` checks, `increment_user_storage_used`, and `user_storage_quotas` table updates.
  - Implement edge link resolver: inspect `Content-Type`. If HTML and not binary video/image, resolve OpenGraph/JSON-LD or cloud drive direct stream (`drive.usercontent.google.com ... confirm=t`).
  - Persist video thumbnails to R2, set extracted captions and pixel dimensions, and store carousel `mediaIds` array inside `media_download_jobs.metadata`.
  - Add `failStuckDownloadJobs` to edge cron scheduler in `apps/worker/src/index.ts` transitioning jobs $> 15\text{ mins}$ in `'downloading' | 'queued' | 'processing'` to `'failed'`.
- **Next.js Downloader Resilience (`apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts` & `apps/web/src/lib/media-downloader.ts`)**:
  - Replace recursive `readNextChunk()` with iterative `while(true)` reading in `readResponseBytesWithLimit`.
  - On failure during multi-item download or database insert, clean up all written R2 objects with `Promise.allSettled(keys.map(k => storage.deleteObject(k)))`.
  - In `MediaDownloader` (`apps/web/src/components/media/media-downloader.tsx`), fix `handleRetryFailedEntry` to preserve `entry.folderId`.

### 1.2 User Media Library Architecture
- **Client Metadata & Canvas Frame Capture (`apps/web/src/components/media/upload-queue-banner.tsx`)**:
  - Return `width` and `height` from `extractMediaMetadata` and pass to `POST /media/confirm`.
  - For videos, generate a WebP thumbnail blob via an offscreen `<canvas>` (`canvas.toBlob('image/webp', 0.82)`), upload to `presigned.thumbnailUploadUrl`, and send `thumbnailKey` in confirm payload.
  - In `finish()` of `extractMediaMetadata`, detach video event listeners, pause, call `video.removeAttribute('src')`, and `video.load()` before revoking `objectUrl`.
  - Track `failedBytes` separately from `transferredBytes` in upload progress.
- **Accurate Duplicate Matching (`apps/web/src/app/api/tenant/[subdomain]/media/check-duplicates/route.ts`)**:
  - Accept `entries: Array<{ name: string; fileSize: number; folderId?: string | null }>` in request.
  - Match strictly on `(LOWER(name), file_size, folder_id)` tuples, eliminating cross-product false positives across nested folders.
- **Search, Filtering & Error Handling (`apps/web/src/components/media/media-library-explorer.tsx`)**:
  - Replace permanent `hasInitialData` guard with `isFirstMountWithInitialData` ref.
  - Add `'4:5'` to `AspectRatioFilterKey` and `classifyAspectRatio`.
  - Add `loadError` state with a retryable banner for network failures during folder navigation.
- **Unicode Filename Preservation (`apps/web/src/app/api/tenant/[subdomain]/media/upload-url/route.ts`)**:
  - Use `.normalize('NFKC')` and Unicode regex `/[^\p{L}\p{N}._-]/gu` for R2 storage keys.

---

## 2. Shared Contracts (`packages/contracts`)
- `packages/contracts/src/domain/media.ts`:
  - Update `CheckDuplicatesRequestSchema` to accept optional `folderId` per entry:
    ```ts
    export const CheckDuplicatesRequestSchema = z.object({
      folderId: z.string().uuid().nullable().optional(),
      entries: z.array(z.object({
        name: z.string().min(1),
        fileSize: z.number().int().positive(),
        folderId: z.string().uuid().nullable().optional(),
      })),
    });
    ```
  - Update `MediaItemSchema` and `ConfirmMediaUploadRequestSchema` with `aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5', 'unknown'])`.

---

## 3. Database Forward Migration
- File: `supabase/migrations/20261019000000_downloader_and_library_remediation.sql`
- Content:
  - Add RPC `public.fail_stuck_download_jobs(p_timeout_minutes INT DEFAULT 15) RETURNS INT`.
  - Update enum or check constraints if necessary.
