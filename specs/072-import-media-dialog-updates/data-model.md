# Data Model: 072-import-media-dialog-updates

## Queue Item Model Extensions

```typescript
export interface ImportQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  mediaType: 'video' | 'image';
  destinationFolderId: string | null;
  status: 'staged' | 'queued' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progressPercent: number;
  isDuplicate: boolean;
  duplicateResolution?: 'keep' | 'skip';
  validationError: string | null;
  retryCount: number;
  previewUrl?: string | null; // Object URL for image thumbnail previews
  abortController?: AbortController;
  uploadedItem?: MediaItemResponse;
}
```

## State Machine Transitions

```mermaid
stateDiagram-v2
    [*] --> Staged: User selects files
    Staged --> Staged: Remove file / Flag invalid / Keep duplicate / Change destination
    Staged --> Queued: User clicks "Start import (n)"
    Queued --> Uploading: Slot frees up (concurrency cap = 3)
    Uploading --> Paused: User clicks Pause
    Paused --> Uploading: User clicks Resume
    Uploading --> Completed: XHR upload + confirm API succeed
    Uploading --> Failed: Network failure after 3 retries
    Failed --> Uploading: User clicks Retry
    Uploading --> Cancelled: User clicks Cancel (X)
    Queued --> Cancelled: User clicks Cancel (X) or "Cancel remaining"
    Completed --> [*]: User clicks Done
```
