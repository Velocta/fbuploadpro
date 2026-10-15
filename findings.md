

## Part 1: Cloud Media Downloader Issues (Backend & Frontend)

### 1. Code & Logic Bugs

* **[CRITICAL] Worker Downloader Queries the Abolished `user_storage_quotas` Table (`Spec 028` vs. `Spec 043` Regression)**

* **Location:** `apps/worker/src/services/downloader-engine.ts` (`validateDownloadSafetyAndQuota` and `persistDownloadedMediaItem`).


* **Bug:** **Spec 028** permanently abolished per-user storage quotas and dropped the `user_storage_quotas` table via migration `20261010182000_purge_media_library_bloat.sql`. However, `validateDownloadSafetyAndQuota` in `downloader-engine.ts` still calls `getUserStorageQuota(db, userId)` and fails jobs with `errorCode: 'QUOTA_EXCEEDED'` if `quota.usedBytes >= quota.totalBytes`. Furthermore, `persistDownloadedMediaItem` still calls `db.rpc('increment_user_storage_used', ...)` with a `.catch()` fallback that runs `db.from('user_storage_quotas').update(...)` against the dropped table.


* **Exact Fix:** Remove `getUserStorageQuota`, `QUOTA_EXCEEDED` checks, `increment_user_storage_used`, and `user_storage_quotas` table updates from `apps/worker/src/services/downloader-engine.ts` so the edge worker aligns with Spec 028's unrestricted R2 storage mandate.




* **[CRITICAL] Worker Downloader Lacks Link Resolution & Saves HTML Pages as Corrupted Videos**

* **Location:** `apps/worker/src/services/downloader-engine.ts` (`executeDownloadJob` & `fetchAndValidateRemoteMedia`).


* **Bug:** Unlike `apps/web/src/lib/media-downloader.ts`—which normalizes Google Drive/Dropbox links (`normalizeCloudDriveUrl`), parses OpenGraph/social HTML pages (`resolveCandidatesBuiltIn`), delegates to `DOWNLOADER_EXTRACTOR_API_URL`, and extracts multi-item carousels—the Cloudflare Worker's `executeDownloadJob` performs a raw `fetchImpl(sourceUrl)` directly on the submitted URL. When a user submits a TikTok, Instagram, Facebook Reel, YouTube, or Google Drive sharing URL to `/api/media/download/enqueue`, `fetchAndValidateRemoteMedia` receives an HTML page (`content-type: text/html`), `inferMimeFromUrlOrHeader` falls back to `'video'` (since `!mimeType.startsWith('image/')`), and `writeStreamToDestination` streams the raw HTML document into R2 as a broken `.mp4` asset.


* **Exact Fix:** Port the link resolution pipeline (`normalizeCloudDriveUrl`, OpenGraph/JSON-LD extraction, and external extractor API delegation) into a shared edge-compatible resolver invoked by `executeDownloadJob` before streaming binary media to R2.




* **[CRITICAL] Worker Downloader Drops Video Thumbnails, Post Captions, Duration, Aspect Ratio, and Carousel Items**

* **Location:** `apps/worker/src/services/downloader-engine.ts` (`persistDownloadedMediaItem`) and `supabase/migrations/20261017000000_media_download_jobs.sql`.


* **Bug:**
1. `persistDownloadedMediaItem` hardcodes `thumbnail_key: null`, `thumbnail_url: mediaType === 'image' ? publicUrl : null`, `duration_seconds: null`, `aspect_ratio: 'unknown'`, and `caption_text: deriveDefaultCaptionFromFilename(fileName)`. This discards extracted social captions, video thumbnails, durations, and aspect ratios required by Spec 031.


2. `media_download_jobs` only has a singular `media_id UUID` column, meaning a single download job cannot persist or return multiple `media_items` from an Instagram or TikTok multi-slide carousel.




* **Exact Fix:** Pass resolved candidate metadata (`caption`, `thumbnailUrl`, `durationSeconds`, `aspectRatio`) into `persistDownloadedMediaItem`, upload resolved video thumbnails to R2, and store an array of created `mediaIds` inside `media_download_jobs.metadata` (in addition to setting `media_id` to the primary asset).




* **[HIGH] Split-Brain Architecture: Next.js `POST /api/tenant/[subdomain]/media/downloader` Still Buffers Entire Files in RAM**

* **Location:** `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts` (`handleDownloadMediaFromUrl`) & `apps/web/src/lib/media-downloader.ts` (`readResponseBytesWithLimit`, `concatUint8Chunks`).


* **Bug:** Although **Spec 043** states the downloader pipeline was migrated from synchronous Vercel serverless execution to the Cloudflare Worker queue, `POST /api/tenant/[subdomain]/media/downloader` in `apps/web` still calls `resolveAndUploadMediaFromUrl` synchronously. Inside `apps/web/src/lib/media-downloader.ts`, `readResponseBytesWithLimit` reads the entire stream into `chunks: Uint8Array[]` using **unbounded recursion** (`await readNextChunk()`) and then allocates a second full buffer in `concatUint8Chunks(chunks, totalBytes)`. Downloading a 400 MB video allocates **800 MB of peak RAM** inside the Next.js serverless function and risks recursive call-stack/memory exhaustion.


* **Exact Fix:** Replace the recursive `readNextChunk()` loop in `readResponseBytesWithLimit` with a standard `while (true)` loop, and have `POST /api/tenant/[subdomain]/media/downloader` delegate background binary streaming to the Cloudflare Worker `/api/media/download/enqueue` endpoint (or stream directly via S3 multipart upload without full-file buffer concatenation).




* **[MEDIUM] `handleRetryFailedEntry` Overwrites the Original Item's `folderId` with Current Dropdown State**

* **Location:** `apps/web/src/components/media/media-downloader.tsx` (`handleRetryFailedEntry` & `retryFailedDownloadEntry`).


* **Bug:** Each `DownloaderFailedEntry` records the `folderId` that was active when that link failed. In `retryFailedDownloadEntry`, the destination is resolved via `const folderId = targetFolderId !== undefined ? targetFolderId : entry.folderId;`. However, `handleRetryFailedEntry` always passes `targetFolderId: selectedFolderId` (which is `string | null`, never `undefined`). If a user downloads a batch into `"Campaign A"`, changes the folder dropdown to `"All Media"` (`null`), and clicks **Retry** on a failed link from `"Campaign A"`, `entry.folderId` is ignored and the file is saved into the wrong folder.


* **Exact Fix:** In `handleRetryFailedEntry`, omit `targetFolderId` (or pass `targetFolderId: entry.folderId ?? selectedFolderId`) so retrying a failed entry respects the folder originally assigned to that entry.





### 2. Unhandled Real-World Edge Cases

* **[CRITICAL] Cloudflare Worker `ctx.waitUntil()` 30-Second Eviction Orphans Large Downloads in `downloading` State**

* **Location:** `apps/worker/src/index.ts` (`handleEnqueueDownload`).


* **Edge Case:** `handleEnqueueDownload` starts `executeDownloadJob` and attaches it to `ctx.waitUntil(backgroundTask)` before immediately returning `202 Accepted`. In Cloudflare Workers, `ctx.waitUntil()` only grants **30 seconds** of execution wall-clock time after the HTTP response is sent. A 350 MB video downloading from a slow origin server (>30 seconds) will be hard-terminated by the Cloudflare runtime mid-stream, leaving the row in `media_download_jobs` permanently stuck in `status = 'downloading'` with no recovery cron.


* **Exact Fix:** Push download jobs into a Cloudflare Queue (`DOWNLOAD_QUEUE`, where Queue consumers are allowed up to 15 minutes of wall-clock execution time) and add a scheduled cleanup RPC (`fail_stuck_download_jobs`) in `handleScheduled` that marks `media_download_jobs` stuck in `'queued' | 'downloading' | 'processing'` for $>15\text{ minutes}$ as `'failed'`.




* **[HIGH] Orphaned R2 Objects When Multi-Item Carousel or Database Insert Fails**

* **Location:** `apps/web/src/lib/media-downloader.ts` (`resolveAndUploadMediaFromUrl`) & `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts`.


* **Edge Case:**
1. `resolveAndUploadMediaFromUrl` runs `Promise.all(candidates.map(... => downloadAndStoreSingleCandidate(...)))`. If a carousel has 5 items and item #4 throws an error, items #1, #2, #3, and #5 have already been written to R2 via `storage.putObject` and are never deleted.


2. In `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts`, if `supabase.from('media_items').insert(insertRecords)` fails (`if (insertErr || !insertedRows)`), the handler returns `500 INTERNAL_ERROR` while leaving all uploaded media and thumbnail objects orphaned in Cloudflare R2.




* **Exact Fix:** Use `Promise.allSettled` in `resolveAndUploadMediaFromUrl` and, if the overall operation or the subsequent `media_items` database insert fails, iterate over all uploaded `storageKey` and `thumbnailKey` values and call `storage.deleteObject(key)` in a cleanup block.




* **[MEDIUM] Google Drive Large-File Virus-Scan Interstitial HTML Page Not Handled**

* **Location:** `apps/web/src/lib/media-downloader.ts` (`normalizeCloudDriveUrl`).


* **Edge Case:** `normalizeCloudDriveUrl` rewrites `[drive.google.com/file/d/](https://drive.google.com/file/d/){id}` to `[https://drive.google.com/uc?export=download&id=](https://drive.google.com/uc?export=download&id=){id}`. For videos larger than ~100 MB, Google Drive does not return the binary video stream on that URL; instead, it returns a `200 OK` HTML virus-scan warning page (`confirm=t` / `[drive.usercontent.google.com/download?id=...&export=download&confirm=t](https://drive.usercontent.google.com/download?id=...&export=download&confirm=t)`), which causes `resolveAndUploadMediaFromUrl` to fail with `UNSUPPORTED_MEDIA` (`No downloadable video or image was found at this link`).


* **Exact Fix:** When `platform === 'google_drive'` and the initial response is `text/html` without OpenGraph video tags, rewrite or retry against `[https://drive.usercontent.google.com/download?id=$](https://drive.usercontent.google.com/download?id=$){fileId}&export=download&confirm=t`.





---

## Part 2: Media Library Issues (Backend & Frontend)

### 1. Code & Logic Bugs

* **[CRITICAL] Client Metadata Extractor Discards `width` & `height` and Hardcodes `thumbnailBlob: null` for All PC Uploads**

* **Location:** `apps/web/src/components/media/upload-queue-banner.tsx` (`extractMediaMetadata` and `uploadSingleFile`).


* **Bug:**
1. **Dropped Pixel Dimensions:** Although Spec 042 added `width` and `height` to `media_items` and `ConfirmMediaUploadRequestSchema`, `extractMediaMetadata` reads `video.videoWidth` / `video.videoHeight` and `img.naturalWidth` / `img.naturalHeight` only to compute `aspectRatio` and **never returns or sends `width` and `height**` in the `POST /api/tenant/${subdomain}/media/confirm` payload. Every file uploaded from a user's PC is saved with `width: null, height: null` in PostgreSQL.


2. **Dead Thumbnail Presigning & Missing Video Thumbnails:** In `uploadSingleFile`, Step B always requests a `thumbnailUploadUrl` (`thumbnailMimeType: 'image/webp'`) from `POST /api/tenant/${subdomain}/media/upload-url`. Yet `extractMediaMetadata` hardcodes `thumbnailBlob: null` in both the video and image branches, Step C never uploads a thumbnail to `presigned.thumbnailUploadUrl`, and Step D always sends `thumbnailKey: null, thumbnailUrl: null`! Every uploaded video has no poster thumbnail in the Media Library grid unless manually edited later, and `/media/upload-url` wastes half its S3 crypto signing operations generating unused thumbnail URLs.




* **Exact Fix:**
1. Return `width: video.videoWidth || null, height: video.videoHeight || null` (and `img.naturalWidth` / `img.naturalHeight` for images) from `extractMediaMetadata` and include `width` and `height` in the `/media/confirm` request body.


2. Automatically capture a WebP poster frame onto an offscreen `<canvas>` during `extractMediaMetadata` for videos (at `currentTime = min(0.5, duration / 2)`), upload `metadata.thumbnailBlob` to `presigned.thumbnailUploadUrl` in Step C, and pass `presigned.publicMediaUrl` as `thumbnailUrl` for images.






* **[HIGH] Cartesian Cross-Product False Positives & Single-Folder Limitation in `/media/check-duplicates**`

* **Location:** `apps/web/src/app/api/tenant/[subdomain]/media/check-duplicates/route.ts` (`queryLegacyDuplicates`) & `apps/web/src/components/media/media-library-explorer.tsx`.


* **Bug:**
1. `queryLegacyDuplicates` queries `WHERE ... LOWER(name) = ANY($3::text[]) AND file_size = ANY($4::bigint[])` using two independent arrays (`names` and `fileSizes`). This matches any existing row whose name matches File A and whose byte size matches File B.


2. When a user uploads a **nested PC folder** (`webkitdirectory` / drag-and-drop), files in the batch belong to different resolved subfolder IDs (`folderPathMap.get(chainKey)`), but `CheckDuplicatesRequestSchema` only accepts a single top-level `folderId` for the entire request.




* **Exact Fix:** Accept an optional per-entry `folderId` in `CheckDuplicatesRequestSchema` (or group duplicate checks by resolved `targetFolderId`), and ensure strict tuple matching `(LOWER(row.name) === entry.name.toLowerCase() && Number(row.file_size) === entry.fileSize && row.folder_id === entry.folderId)`.




* **[HIGH] `hasInitialData` Early Return Breaks Server-Side Search, Filtering, and Sorting in `MediaLibraryExplorer**`

* **Location:** `apps/web/src/components/media/media-library-explorer.tsx` (`refreshLibraryData`).


* **Bug:** `MediaLibraryExplorer` defines `const hasInitialData = initialFolders !== undefined || initialMediaItems !== undefined;` and starts `refreshLibraryData` with `if (!subdomain || hasInitialData) return;`. Whenever `initialMediaItems` is passed, changing `currentFolderId`, `searchQuery`, `mediaTypeFilter`, `aspectRatioFilter`, `captionStatusFilter`, or `sortOption` triggers the `useEffect` calling `refreshLibraryData()`, which immediately exits without calling `GET /api/tenant/${subdomain}/media`! Furthermore, `refreshLibraryData` still hardcodes `query.set('offset', '0')` instead of resetting a keyset cursor state.


* **Exact Fix:** Replace the permanent `if (!subdomain || hasInitialData) return;` guard with a `useRef(true)` (`isFirstMountWithInitialData`) that only skips the very first mount fetch when `hasInitialData` is true, allowing all subsequent folder navigations, searches, filters, and sorts to query the backend.




* **[MEDIUM] Progress Bar Inflates `transferredBytes` on Failed Files & Jumps in Step-Functions**

* **Location:** `apps/web/src/components/media/upload-queue-banner.tsx` (`uploadSingleFile`).


* **Bug:**
1. In the `catch (_err)` block of `uploadSingleFile`, when an upload fails (even before a single byte is sent to R2), the code executes `transferredBytes = Math.min(totalBytes, transferredBytes + entry.file.size); emitProgress('uploading');`. If three 100 MB files fail immediately due to a network drop, the progress bar falsely jumps to `300 MB / 300 MB (100%)`.


2. Because Step C uses `fetchImpl(presigned.mediaUploadUrl, { method: 'PUT', body: entry.file })` instead of `XMLHttpRequest` (`xhr.upload.onprogress`), `transferredBytes` stays frozen at `0` for the entire duration of a 400 MB video upload and only updates after Step D (`confirm`) completes.




* **Exact Fix:** Do not add `entry.file.size` to `transferredBytes` in the `catch` block (or track `failedBytes` separately from `transferredBytes`), and use `XMLHttpRequest` (with `fetchImpl` fallback for tests) for R2 `PUT` uploads so `xhr.upload.onprogress` streams smooth real-time byte progress to `UploadQueueBanner`.




* **[MEDIUM] `4:5` Portrait Assets Are Excluded from Aspect Ratio Classification & Filtering**

* **Location:** `apps/web/src/components/media/upload-queue-banner.tsx` (`classifyAspectRatio`) & `apps/web/src/components/media/media-library-explorer.tsx` (`AspectRatioFilterKey`).


* **Bug:** Standard Facebook and Instagram portrait feed posts use a `4:5` aspect ratio (even appearing in your own test fixtures at `apps/web/tests/ui/media-downloader.test.tsx` as `aspectRatio: '4:5'`). However, `AspectRatioFilterKey` only supports `'all' | '9:16' | '16:9' | '1:1'`, classifying `4:5` (`0.8` ratio) assets as `'unknown'` and preventing operators from filtering for `4:5` portrait media.


* **Exact Fix:** Add `'4:5'` to `AspectRatioFilterKey`, `classifyAspectRatio`, and the Media Library aspect ratio filter dropdown.





### 2. Unhandled Real-World Edge Cases

* **[HIGH] Detached `<video>` Elements & Unrevoked Object URLs on Metadata Timeout During 1,000-File Uploads**

* **Location:** `apps/web/src/components/media/upload-queue-banner.tsx` (`extractMediaMetadata`).


* **Edge Case:** When probing 1,000 video files during a PC folder upload, `extractMediaMetadata` creates an offscreen `<video>` element and sets `video.src = objectUrl`. Neither `finish()` nor the 1.5s timeout clears `video.src = ''` or calls `video.load()` before releasing the reference. In Chromium/WebKit, detached `<video>` elements with active media pipelines remain in memory until garbage collection, which can exhaust the browser's hardware media decoder pool (~32–64 concurrent decoders) and cause all subsequent videos in the batch to time out with `durationSeconds: null, aspectRatio: 'unknown'`.


* **Exact Fix:** Inside `finish()` in `extractMediaMetadata`, explicitly detach `video.onloadedmetadata = null; video.onerror = null; video.pause(); video.removeAttribute('src'); video.load();` before revoking `objectUrl`.




* **[MEDIUM] Non-Latin / Unicode Filenames Stripped to Blank Underscores in R2 Storage Keys**

* **Location:** `apps/web/src/app/api/tenant/[subdomain]/media/upload-url/route.ts` (`handleCreateUploadUrl`).


* **Edge Case:** `handleCreateUploadUrl` sanitizes filenames using `/[^a-zA-Z0-9._-]/g`. If a user uploads a file named in Arabic, Urdu, Hindi, Chinese, or Japanese (e.g., `فيديو_تسويقي.mp4`), the regex strips every character in the stem, producing `____________.mp4` in the R2 key.


* **Exact Fix:** Normalize with `.normalize('NFKC')` and allow Unicode letters/numbers via `/[^\p{L}\p{N}._-]/gu` (with a fallback stem if empty).




* **[MEDIUM] Silent Error Swallowing in `refreshLibraryData` Leaves Stale or Empty Folder UI Without Retry**

* **Location:** `apps/web/src/components/media/media-library-explorer.tsx` (`refreshLibraryData`).


* **Edge Case:** In `refreshLibraryData`, if `fetch('/api/tenant/${subdomain}/media?...')` throws or returns a `500` status, the `catch (_err)` block does nothing (`// Retain existing state if network request fails`) and sets `setIsLoading(false)`. If the user just clicked into a subfolder when a network blip occurred, the breadcrumb updates to the new subfolder while the grid either continues displaying the *previous* folder's files or renders "Empty folder" with no error banner or retry button.


* **Exact Fix:** Add a `loadError` state in `MediaLibraryExplorer`, clear `mediaItems` when switching folders, and render a retryable error banner if `!mediaRes.ok` or `fetch` throws.





---

## Part 3: How to Make the Downloader & Media Library Significantly Better

1. **Unify Downloader Ingestion on Cloudflare Queues + WebSockets/Realtime Instead of HTTP Polling**

* Currently, `MediaDownloader` polls `GET /api/tenant/${subdomain}/media/downloader?jobId=${jobId}` every 1.5 seconds, and the Worker runs `executeDownloadJob` inside `ctx.waitUntil`.


* **Upgrade:** Route `/api/media/download/enqueue` into a dedicated **Cloudflare Queue (`DOWNLOAD_QUEUE`)** for 15-minute execution durability, and subscribe to `public.media_download_jobs` changes via **Supabase Realtime** (or Server-Sent Events) on the frontend so progress bars (`progress_percent`, `downloaded_bytes / total_bytes`) update smoothly in real time without polling overhead.




2. **Content-Hash (SHA-256) Deduplication & Instant "Zero-Upload" Cloning**

* Currently, pre-upload duplicate detection only checks `LOWER(name)` and `fileSize` within a single folder. If a creator downloads the same TikTok video twice or uploads `hook_v1.mp4` and `hook_final.mp4` (identical file, different filename), it is uploaded and stored twice in R2.


* **Upgrade:** Compute a fast WebCrypto `SHA-256` hash (or first/last 1 MB + size fingerprint) in the browser before uploading, and during Worker downloads stream through a hashing transform. Store `content_hash` on `media_items` so identical files across any folder can either be flagged as exact content duplicates or linked without re-uploading bytes to R2.


3. **Direct "Send to Page Queue" Action from Media Library & Recent Downloads**

* Currently, after uploading files in `MediaLibraryExplorer` or downloading links in `MediaDownloader`, operators must navigate away to `/tenant/[subdomain]/pages/[pageId]` and open `EnqueueModal` to schedule those assets.


* **Upgrade:** Add a **"Schedule / Add to Page Queue"** button directly on `MediaAssetCard`, `BatchActionBar` (for bulk scheduling 20 selected reels across a Page's slots at once), and each item in `MediaDownloader`'s **Recent Downloads** list.




4. **R2 Multipart Upload for Large Videos (>50 MB) with True Byte-Level Resumability**

* Currently, "Pause & Resume" in `UploadQueueBanner` is *file-level* cooperative pausing (it waits for the current `PUT` to finish before pausing the next file in the queue). If a single 450 MB video fails at 95%, retrying re-uploads all 450 MB from zero.


* **Upgrade:** For files $> 50\text{ MB}$, use S3/R2 Multipart Uploads (`CreateMultipartUploadCommand`, `UploadPartCommand` in 10 MB chunks, `CompleteMultipartUploadCommand`) in `apps/web/src/lib/storage.ts` so pausing or network drops resume from the exact 10 MB chunk that failed.
