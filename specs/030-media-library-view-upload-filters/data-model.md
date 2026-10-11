# Data Model & State Transitions: Spec 030 — Media Library View Modes, Resumable Upload Controls, Filters & Frame Thumbnail Picker

## 1. Database Columns Used (`media_items`)
No new SQL migration is required because `media_items` already contains:
- `aspect_ratio VARCHAR(20) NOT NULL DEFAULT 'unknown'` (indexed and populated on upload confirmation as `'9:16'`, `'16:9'`, `'1:1'`, or `'unknown'`).
- `caption_text TEXT NULL` (populated with stripped filename on upload confirmation or updated via inline/modal/batch editing).
- `thumbnail_key VARCHAR(500) NULL` & `thumbnail_url TEXT NULL` (updated when the user selects a custom video frame as the thumbnail via `PATCH /api/tenant/[subdomain]/media/[mediaId]`).

## 2. Frontend Upload Queue State Machine (`UploadBatchState`)
- `idle` $\rightarrow$ `uploading` (when batch starts)
- `uploading` $\rightarrow$ `paused` (when user clicks **Pause**; currently active transfers complete before workers wait on the pause gate)
- `paused` $\rightarrow$ `uploading` (when user clicks **Resume**; pause gate resolves and workers pick up the next queued entry)
- `uploading` / `paused` $\rightarrow$ `cancelled` (when user clicks **Cancel Batch**)
- `uploading` $\rightarrow$ `completed` (when all entries finish; if `failedFiles > 0`, `failedEntries` holds the failed `QueuedUploadEntry[]` items so **Retry Failed (`X`)** can re-run only those entries).

## 3. Explorer View Mode Preference
- Stored in `localStorage` under key `fbuploadpro:media-view-mode` (`'grid' | 'table'`).
- Defaults to `'grid'` when absent or invalid.
