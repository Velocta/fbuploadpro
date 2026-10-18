# Data Model & State Transitions: Media Library Functional Fixes

## 1. Import Queue Item & Batch State Machine

### Item State Transitions
```
[staged] ──(handleStartImport)──> [queued] ──(availableSlots > 0)──> [uploading]
                                     │                                  │
                                     │                                  ├──(xhr.upload 100% -> confirm)──> [completed]
                                     │                                  │
                                     │                                  ├──(error & retries < 3)──> [queued] (backoff)
                                     │                                  │
                                     │                                  └──(error & retries >= 3)─> [failed: "failed — retry"]
                                     │
                                     └──(user clicks cancel)──> [failed: "canceled"]
```

### Batch Completion State
```
inFlight.length === 0 && queue.length > 0:
  ├── completedCount === totalCount => "Import complete — N of N uploaded"
  ├── completedCount > 0 && failedCount > 0 => "Import complete — M of N uploaded (K failed)"
  ├── completedCount === 0 && userInitiatedCancel === true => "Import canceled — nothing was uploaded"
  └── completedCount === 0 && userInitiatedCancel === false => "Import failed — 0 of N uploaded"
```

### State Fields (`apps/web/src/components/media/media-types.ts` & `media-import-modal.tsx`)
```ts
export interface ImportQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  mediaType: 'video' | 'image';
  destinationFolderId: string | null;
  status: 'staged' | 'queued' | 'uploading' | 'completed' | 'failed' | 'paused';
  progressPercent: number;
  isDuplicate: boolean;
  duplicateResolution?: 'skip' | 'upload_anyway';
  validationError?: string | null;
  retryCount: number;
  abortController?: AbortController;
  uploadedItem?: MediaItemResponse;
}
```

### Presigned Upload URL Contract Response
```ts
export interface UploadUrlResponse {
  mediaId: string;
  mediaKey: string;
  mediaUploadUrl: string;
  thumbnailKey: string;
  thumbnailUploadUrl: string;
  publicMediaUrl: string;
  publicThumbnailUrl: string;
  expiresInSeconds: number;
}
```

---

## 2. Media List Query Contract Schema

### `MediaListQuerySchema` (`packages/contracts/src/domain/media.ts`)
```ts
export const MediaListQuerySchema = z.object({
  folderId: z.string().uuid().or(z.literal('unorganized')).optional(),
  mediaType: z.enum(['video', 'image']).optional(),
  aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5']).optional(),
  captionStatus: z.enum(['has_caption', 'empty_caption']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'name', 'file_size']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(1000).default(50), // Raised from 100 to 1000
  offset: z.coerce.number().int().min(0).default(0),
  cursor: z.string().optional(),
  postFormat: PostFormatSchema.optional(),
});
```

---

## 3. Dropdown Selection State & Events

```ts
type DropdownKey = 'ratio' | 'caption' | 'sort' | null;

// Refs to avoid closing prematurely on click inside
const ratioDropdownRef = useRef<HTMLDivElement | null>(null);
const captionDropdownRef = useRef<HTMLDivElement | null>(null);
const sortDropdownRef = useRef<HTMLDivElement | null>(null);
```
