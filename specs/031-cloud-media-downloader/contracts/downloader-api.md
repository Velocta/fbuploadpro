# API Contract: Cloud Media Downloader (`POST /api/tenant/[subdomain]/media/downloader`)

**Feature ID**: `031-cloud-media-downloader`  
**Endpoint**: `POST /api/tenant/[subdomain]/media/downloader`

---

## 1. Request Specification

- **Authentication**: Requires valid `fbup_session` cookie.
- **Authorization**: `session.subdomain === subdomain` or `session.role === 'admin'`.
- **Content-Type**: `application/json`

### Request Body (`DownloaderIngestRequest`)
```json
{
  "url": "https://www.tiktok.com/@creator/video/7123456789",
  "folderId": "d290f1ee-6c54-4b01-90e6-d701748f0851"
}
```
- `url` (required): Valid `http://` or `https://` public URL (max 2048 chars). Must pass `validateSafeRemoteUrl` SSRF check.
- `folderId` (optional): UUID of a `media_folders` record belonging to `session.userId`, or `null` for `All Media` root.

---

## 2. Response Specification

### `201 Created` (`DownloaderIngestResponse`)
Returned when one or more supported media assets (single video/image or multi-item carousel) have been streamed to Cloudflare R2 and inserted into `media_items`:

```json
{
  "sourceUrl": "https://www.tiktok.com/@creator/video/7123456789",
  "platform": "tiktok",
  "items": [
    {
      "id": "8f8c4e50-1234-4b67-89ab-cdef01234567",
      "userId": "a1b2c3d4-5678-4012-9345-678901234567",
      "folderId": "d290f1ee-6c54-4b01-90e6-d701748f0851",
      "name": "Morning_Routine_Reel.mp4",
      "fileSize": 14582912,
      "mimeType": "video/mp4",
      "mediaType": "video",
      "storageKey": "users/a1b2c3d4-5678-4012-9345-678901234567/media/8f8c4e50-1234-4b67-89ab-cdef01234567/Morning_Routine_Reel.mp4",
      "url": "https://media.fbuploadpro.com/users/a1b2c3d4-5678-4012-9345-678901234567/media/8f8c4e50-1234-4b67-89ab-cdef01234567/Morning_Routine_Reel.mp4",
      "thumbnailKey": "users/a1b2c3d4-5678-4012-9345-678901234567/thumbnails/8f8c4e50-1234-4b67-89ab-cdef01234567.jpeg",
      "thumbnailUrl": "https://media.fbuploadpro.com/users/a1b2c3d4-5678-4012-9345-678901234567/thumbnails/8f8c4e50-1234-4b67-89ab-cdef01234567.jpeg",
      "durationSeconds": 28,
      "aspectRatio": "9:16",
      "captionText": "Morning routine for high output days #productivity",
      "createdAt": "2026-10-11T08:40:00.000Z",
      "updatedAt": "2026-10-11T08:40:00.000Z"
    }
  ]
}
```

### Error Responses
- `400 Bad Request` (`INVALID_REQUEST` / `UNSAFE_URL` / `UNSUPPORTED_MEDIA` / `FILE_TOO_LARGE`):
  - Malformed URL, SSRF-blocked private/loopback host, no downloadable video or image found at the link, or file exceeds 500 MB.
- `401 Unauthorized`: Missing or invalid session cookie.
- `403 Forbidden`: Tenant subdomain mismatch.
- `404 Not Found` (`FOLDER_NOT_FOUND`): Specified `folderId` does not exist or belongs to another user.
- `502 Bad Gateway` (`DOWNLOAD_FAILED`): Remote host returned an upstream error or timed out.
