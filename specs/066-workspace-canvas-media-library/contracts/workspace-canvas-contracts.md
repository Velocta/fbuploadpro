# Contracts & Component Interfaces: Workspace Canvas Media Library

**Feature**: `066-workspace-canvas-media-library`  
**Date**: 2026-10-17  
**Scope**: Component Props, IPC, and Client API Contracts

---

## 1. Component Interfaces

### `MediaFolderRailProps`
```typescript
export interface MediaFolderRailProps {
  folders: MediaFolder[];
  currentFolderId: string | null;
  activeSmartCollection: SmartCollectionKey;
  counts: {
    all: number;
    video: number;
    image: number;
    uncaptioned: number;
  };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectCollection: (key: SmartCollectionKey) => void;
  onNavigateFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folder: MediaFolder) => void;
  onMoveFolder: (folder: MediaFolder) => void;
  onDeleteFolder: (folder: MediaFolder) => void;
  onDropMediaOnFolder: (mediaId: string, targetFolderId: string | null) => Promise<void> | void;
}
```

### `MediaAssetTileProps`
```typescript
export interface MediaAssetTileProps {
  item: MediaItemResponse;
  isSelected: boolean;
  isInspected: boolean;
  onToggleSelect: (mediaId: string, options?: { shiftKey?: boolean }) => void;
  onInspect: (item: MediaItemResponse) => void;
  onPreview: (item: MediaItemResponse) => void;
  onDragStartMedia?: (e: React.DragEvent<HTMLElement>, item: MediaItemResponse) => void;
}
```

### `MediaInspectorPanelProps`
```typescript
export interface MediaInspectorPanelProps {
  item: MediaItemResponse | null;
  selectedCount: number;
  selectedItems: MediaItemResponse[];
  folders: MediaFolder[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateCaption: (mediaId: string, captionText: string) => Promise<void> | void;
  onSchedule: (item: MediaItemResponse) => void;
  onMove: (item: MediaItemResponse) => void;
  onDelete: (item: MediaItemResponse) => void;
  onBatchMove?: () => void;
  onBatchCaption?: () => void;
  onBatchSchedule?: () => void;
  onBatchDelete?: () => void;
}
```

---

## 2. API Contract Endpoints (Existing - Unchanged)

| Endpoint | Method | Role |
| :--- | :--- | :--- |
| `/api/tenant/[subdomain]/media` | `GET` | List media items with optional `folderId`, `search`, `mediaType` query params. |
| `/api/tenant/[subdomain]/media` | `POST` | Upload URL generation and batch asset registration. |
| `/api/tenant/[subdomain]/media/[mediaId]` | `PATCH` | Update `captionText` or move `folderId`. |
| `/api/tenant/[subdomain]/media/[mediaId]` | `DELETE` | Purge media item and storage object. |
| `/api/tenant/[subdomain]/media/folders` | `GET`, `POST` | List and create folders. |
| `/api/tenant/[subdomain]/media/folders/[folderId]`| `PATCH`, `DELETE` | Rename, move, or delete folder. |
| `/api/tenant/[subdomain]/media/batch` | `POST` | Bulk move, batch caption, or batch delete media items. |
