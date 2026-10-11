# Data Model: Spec 031 — Cloud Media Downloader

**Feature ID**: `031-cloud-media-downloader`  
**Created**: 2026-10-11

---

## 1. Existing Database Tables Utilized (Zero Destructive Schema Changes)

Spec 031 ingests cloud-downloaded media directly into the existing multi-tenant PostgreSQL tables (`media_folders` and `media_items`), requiring zero destructive DDL changes:

### 1.1 `media_folders`
| Column | Type | Constraints | Usage in Downloader |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Selected target folder ID (`folderId`) |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Tenant isolation boundary |
| `parent_id` | `UUID` | `NULL REFERENCES media_folders(user_id, id) ON DELETE CASCADE` | `NULL` for root-level auto-provisioned `Downloads` folder; supports nested subfolder selection |
| `name` | `VARCHAR(100)` | `NOT NULL`, sibling-scoped case-insensitive unique | Default root folder named `'Downloads'` |

### 1.2 `media_items`
| Column | Type | Constraints | Usage in Downloader |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | Generated `mediaId` (`randomUUID()`) |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Authenticated tenant `session.userId` |
| `folder_id` | `UUID` | `NULL`, composite FK `(user_id, folder_id)` | Target `folderId` (defaults to `Downloads` folder ID, or `null` for `All Media` root) |
| `name` | `VARCHAR(255)` | `NOT NULL` | Sanitized filename derived from extracted title/URL + extension |
| `file_size` | `BIGINT` | `NOT NULL > 0` | Exact byte length of the downloaded media buffer uploaded to R2 |
| `mime_type` | `VARCHAR(100)` | `AllowedMediaMimeTypes` | Verified MIME type (`video/mp4`, `video/quicktime`, `video/webm`, `image/jpeg`, `image/png`, `image/webp`) |
| `media_type` | `VARCHAR(20)` | `'video' \| 'image'` | Derived from `mime_type` |
| `storage_key` | `VARCHAR(500)` | `NOT NULL` | `users/{userId}/media/{mediaId}/{sanitizedFileName}` |
| `url` | `TEXT` | `NOT NULL` | Public R2 URL (`storage.getPublicUrl(storageKey)`) |
| `thumbnail_key` | `VARCHAR(500)` | `NULL` | `users/{userId}/thumbnails/{mediaId}.{ext}` (if thumbnail extracted) |
| `thumbnail_url` | `TEXT` | `NULL` | Public R2 URL for thumbnail (or `url` for image assets) |
| `duration_seconds` | `NUMERIC` | `NULL` | Extracted video duration if available from metadata |
| `aspect_ratio` | `VARCHAR(20)` | `DEFAULT 'unknown'` | Extracted aspect ratio if available, else `'unknown'` |
| `caption_text` | `TEXT` | `NULL` (max 5000 chars) | Auto-populated from original post caption/title, falling back to `deriveDefaultCaptionFromFilename(name)` |

---

## 2. Domain Contract Schemas (`@fbuploadpro/contracts`)

### 2.1 `PutObjectParams` & `PutObjectResult` (`domain/storage.ts`)
```ts
export interface PutObjectParams {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface PutObjectResult {
  key: string;
  publicUrl: string;
  byteLength: number;
}
```

### 2.2 `DownloaderIngestRequest` & `DownloaderIngestResponse` (`domain/downloader.ts`)
```ts
export const DownloaderSourcePlatformValues = [
  'tiktok',
  'facebook',
  'instagram',
  'x',
  'youtube',
  'google_drive',
  'dropbox',
  'direct',
  'web',
] as const;

export const DownloaderIngestRequestSchema = z.object({
  url: z.string().trim().url('Please enter a valid link starting with http:// or https://').max(2048),
  folderId: z.string().uuid().nullable().optional(),
});

export const DownloaderIngestResponseSchema = z.object({
  sourceUrl: z.string().url(),
  platform: z.enum(DownloaderSourcePlatformValues),
  items: z.array(MediaItemResponseSchema).min(1),
});
```
