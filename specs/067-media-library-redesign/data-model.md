# Data Model & State Architecture: Spec 067 Media Library Redesign

## 1. Domain Entities & Client State

### MediaItem (Read/Update Model)
```typescript
interface MediaItem {
  id: string;
  userId: string;
  workspaceId: string | null;
  folderId: string | null;
  name: string;
  fileSize: number;
  mimeType: string;
  mediaType: 'video' | 'image';
  storageKey: string;
  url: string;
  thumbnailKey: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  captionText: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
}
```

### MediaFolder (Tree Navigation Model)
```typescript
interface MediaFolder {
  id: string;
  userId: string;
  workspaceId: string | null;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  subfolderCount?: number;
}
```

### ImportQueueItem (Staging & Upload State)
```typescript
type UploadStatus = 'staged' | 'queued' | 'uploading' | 'paused' | 'completed' | 'failed';

interface ImportQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  mediaType: 'video' | 'image';
  destinationFolderId: string | null;
  status: UploadStatus;
  progressPercent: number;
  isDuplicate: boolean;
  duplicateResolution?: 'skip' | 'upload_anyway';
  validationError?: string | null; // e.g. "can't upload — not a supported format", "too large — 500 MB max"
  abortController?: AbortController;
  retryCount: number;
}
```

### Batch Caption Mode
```typescript
type BatchCaptionMode = 'replace' | 'append';
```

## 2. Component Hierarchy

```
MediaLibraryExplorer
├── Header (Title, Subtext, quiet "+ New Folder", primary "Upload Files")
├── Toolbar (Divider-separated single row)
│   ├── Flat Search (Magnifier, ~250ms debounce, no border outline)
│   ├── Media Type Tabs (All / Videos / Images with active underline)
│   ├── Filter Carets (Aspect Ratio, Caption Status, Sort)
│   └── Bare View Switcher (Grid / Table icons)
├── Context Row
│   ├── Clickable Breadcrumbs Trail (Drop targets)
│   └── "Select all" / Selected count toggle
├── Folder Rail (Collapsible left sidebar, nested tree, live counts)
├── Main Content Canvas
│   ├── Subfolder Rows ("FOLDERS (n)", folder icon, "n subfolders · n files", hover actions)
│   ├── Asset Grid (Borderless thumbnail tiles, metadata underneath, hover preview & menu)
│   └── Table View (Hairline rows, sticky header, Details [ratio · duration], upload date)
├── Modals & Overlays
│   ├── MediaImportModal (Step 1 Staging + Step 2 Concurrency-capped progress + Minimize)
│   ├── MediaPreviewModal (2-column: player/scrubber + frame capture, metadata + name/caption editor)
│   ├── NewFolderModal (Autofocused name, parent dropdown, inline duplicate warning)
│   ├── BatchActionBar (Floating bottom pill: 'n selected · Move · Set caption · Delete · Clear')
│   ├── BatchSetCaptionModal (Replace vs. Append modes, character counter)
│   └── LeavePageGuardDialog (In-app navigation protection)
```
