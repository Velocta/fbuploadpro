# Quickstart Guide: Spec 043

## Verification & Manual Testing

### 1. Enqueue a Download Job
```bash
curl -X POST "https://worker.fbuploadpro.com/api/media/download/enqueue" \
  -H "Authorization: Bearer <SUPABASE_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "customFilename": "BigBuckBunny.mp4"
  }'
```
Expected Response:
```json
{
  "success": true,
  "job": {
    "id": "e931481b-8007-44a3-a740-bf71ecdd64d5",
    "status": "queued",
    "progressPercent": 0,
    "downloadedBytes": 0
  }
}
```

### 2. Poll Download Job Progress
```bash
curl "https://worker.fbuploadpro.com/api/media/download/jobs/e931481b-8007-44a3-a740-bf71ecdd64d5" \
  -H "Authorization: Bearer <SUPABASE_JWT>"
```
Expected Response:
```json
{
  "id": "e931481b-8007-44a3-a740-bf71ecdd64d5",
  "status": "downloading",
  "progressPercent": 45,
  "downloadedBytes": 23592960,
  "totalBytes": 52428800
}
```

### 3. Verify Completion
Upon completion:
```json
{
  "id": "e931481b-8007-44a3-a740-bf71ecdd64d5",
  "status": "completed",
  "progressPercent": 100,
  "mediaId": "481a5472-8d77-4b72-88f6-cbb61db07ce0"
}
```
And the media item is visible in the Media Library.
