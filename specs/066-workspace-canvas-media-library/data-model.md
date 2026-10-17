# Data Model & State Architecture: Workspace Canvas Media Library

**Feature**: `066-workspace-canvas-media-library`  
**Date**: 2026-10-17  
**Scope**: Client-Side Component State & Domain Model Mapping

---

## 1. Domain Entities (Reused from `@fbuploadpro/contracts`)

No database schema migrations are required for this feature. The data layer uses the existing Supabase `media` and `media_folders` tables via `@fbuploadpro/contracts`.

```typescript
// From @fbuploadpro/contracts
export interface MediaFolder {
  id: string;
  userId: string;
  workspaceId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  subfolderCount: number;
}

export interface MediaItemResponse {
  id: string;
  userId: string;
  workspaceId: string;
  folderId: string | null;
  name: string;
  originalFileName: string;
  mediaType: 'video' | 'image';
  mimeType: string;
  fileSize: number;
  storageKey: string;
  url: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  captionText: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## 2. Client-Side Workspace State Model

### `WorkspaceCanvasState`
Manages the interactive 3-pane media studio:

```typescript
export type SmartCollectionKey = 'all' | 'video' | 'image' | 'uncaptioned';

export type MediaViewMode = 'grid' | 'table';

export type AspectRatioFilterKey = 'all' | '9:16' | '16:9' | '1:1' | '4:5';

export type SortOptionKey =
  | 'created_at:desc'
  | 'created_at:asc'
  | 'name:asc'
  | 'file_size:desc';

export interface WorkspaceCanvasState {
  // Navigation & Hierarchy
  currentFolderId: string | null;
  activeSmartCollection: SmartCollectionKey;
  isFolderRailCollapsed: boolean;

  // Selection & Inspector
  selectedMediaIds: string[];
  inspectedMediaId: string | null;

  // Search & Filtering
  searchQuery: string;
  aspectRatioFilter: AspectRatioFilterKey;
  sortOption: SortOptionKey;
  viewMode: MediaViewMode;

  // Modals & Feedback
  moveModalState:
    | { targetType: 'single'; item: MediaItemResponse }
    | { targetType: 'batch' }
    | { targetType: 'folder'; folder: MediaFolder }
    | null;
  folderModalState:
    | { mode: 'create'; parentId?: string | null }
    | { mode: 'rename'; folder: MediaFolder }
    | null;
  deleteFolderTarget: MediaFolder | null;
  deleteMediaTarget: MediaItemResponse | null;
  feedbackBanner: { type: 'success' | 'error'; message: string } | null;
}
```

---

## 3. Smart Collection Derivation Model

```typescript
export interface CollectionSummary {
  key: SmartCollectionKey;
  label: string;
  count: number;
  iconName: 'grid' | 'video' | 'image' | 'alert-circle';
}
```

Derivation functions compute `count` dynamically over the active folder or global media list:
- `all`: Total media in folder or workspace.
- `video`: Count where `mediaType === 'video'`.
- `image`: Count where `mediaType === 'image'`.
- `uncaptioned`: Count where `!captionText || captionText.trim().length === 0`.
