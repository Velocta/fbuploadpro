# API Contracts: Spec 030 — Media Filters & Thumbnail Update

## 1. `GET /api/tenant/[subdomain]/media` (`MediaListQuerySchema`)

### Query Parameters
- `folderId?: string` (UUID or `'unorganized'`; omitted during global search)
- `mediaType?: 'video' | 'image'`
- `aspectRatio?: '9:16' | '16:9' | '1:1'` (NEW)
- `captionStatus?: 'has_caption' | 'empty_caption'` (NEW)
- `search?: string`
- `sortBy?: 'created_at' | 'name' | 'file_size'` (default `'created_at'`)
- `sortOrder?: 'asc' | 'desc'` (default `'desc'`)
- `limit?: number` (`1..100`, default `50`)
- `offset?: number` (`>= 0`, default `0`)

## 2. `PATCH /api/tenant/[subdomain]/media/[mediaId]` (`UpdateMediaItemRequestSchema`)

### Request Body
```json
{
  "name": "Updated Video.mp4",
  "folderId": "550e8400-e29b-41d4-a716-446655440000",
  "captionText": "Updated caption",
  "thumbnailKey": "tenants/u1/thumbnails/m1-frame.webp",
  "thumbnailUrl": "https://cdn.fbuploadpro.com/tenants/u1/thumbnails/m1-frame.webp"
}
```
- When `thumbnailKey` and `thumbnailUrl` are provided on `PATCH`, `media_items.thumbnail_key` and `media_items.thumbnail_url` are updated.
- If the media item previously had a non-null `thumbnail_key` that differs from the new `thumbnailKey`, the previous `thumbnail_key` is deleted from Cloudflare R2 via `storageService.deleteObject(oldThumbnailKey)`.
