# Data Model & State Transitions: Spec 071

## 1. Explorer Action States

The following state variables are managed inside `MediaLibraryExplorer`:

| State Variable | Type | Initial | Purpose |
| :--- | :--- | :--- | :--- |
| `isDeletingFolder` | `boolean` | `false` | Tracks in-flight folder deletion request. Disables modal buttons and suppresses double clicks. |
| `isRenamingFolder` | `boolean` | `false` | Tracks in-flight folder rename request. Disables modal buttons and suppresses double clicks. |
| `isMoving` | `boolean` | `false` | Tracks in-flight reparent / move request (for single asset, folder, or batch). Disables move button and suppresses double clicks. |
| `deletingAssetId` | `string \| null` | `null` | Tracks ID of asset currently being deleted to prevent rapid multi-clicks. |
| `isBatchDeleting` | `boolean` | `false` | Tracks in-flight batch deletion request. Sets `isBusy` on `BatchActionBar`. |
| `isBatchCaptioning` | `boolean` | `false` | Tracks in-flight batch caption updates. Sets `isBusy` on `BatchActionBar`. |

## 2. Modal Loading State Lifecycles

### A. NewFolderModal
- **Lifecycle**: `isSubmitting: boolean`
- **Initial**: `false`
- **On Submit**: If `isSubmitting` or `!canSubmit`, abort. Set `isSubmitting = true`.
- **UI Locking**:
  - `nameInput`: `disabled={isSubmitting}`
  - `placeInsideSelect`: `disabled={isSubmitting}`
  - `Cancel` button: `disabled={isSubmitting}`, `cursor: isSubmitting ? 'not-allowed' : 'pointer'`
  - `Submit` button: `disabled={!canSubmit}`, label: `isSubmitting ? 'Creating...' : 'Create folder'`
- **Finally**: `isSubmitting = false`

### B. RenameFolderDialog
- **Lifecycle**: `isRenamingFolder: boolean`
- **Initial**: `false`
- **On Submit**: If `isRenamingFolder || !renameDraft.trim()`, abort. Set `isRenamingFolder = true`.
- **UI Locking**:
  - `input`: `disabled={isRenamingFolder}`
  - `Cancel` button: `disabled={isRenamingFolder}`, `cursor: isRenamingFolder ? 'not-allowed' : 'pointer'`
  - `Save` button: `disabled={isRenamingFolder || !renameDraft.trim()}`, label: `isRenamingFolder ? 'Saving...' : 'Save'`
- **Finally**: `isRenamingFolder = false`

### C. DeleteFolderDialog
- **Lifecycle**: `isDeletingFolder: boolean`
- **Initial**: `false`
- **On Submit**: If `isDeletingFolder`, abort. Set `isDeletingFolder = true`.
- **UI Locking**:
  - `Cancel` button: `disabled={isDeletingFolder}`, `cursor: isDeletingFolder ? 'not-allowed' : 'pointer'`
  - `Delete` button: `disabled={isDeletingFolder}`, label: `isDeletingFolder ? 'Deleting...' : 'Delete'`
- **Finally**: `isDeletingFolder = false`

### D. MoveTargetDialog
- **Lifecycle**: `isMoving: boolean`
- **Initial**: `false`
- **On Submit**: If `isMoving`, abort. Set `isMoving = true`.
- **UI Locking**:
  - `select`: `disabled={isMoving}`
  - `Cancel` button: `disabled={isMoving}`, `cursor: isMoving ? 'not-allowed' : 'pointer'`
  - `Move` button: `disabled={isMoving}`, label: `isMoving ? 'Moving...' : 'Move'`
- **Finally**: `isMoving = false`

### E. MediaPreviewModal
- **Lifecycles**: `isSaving: boolean`, `isDeleting: boolean`
- **Initial**: both `false`
- **On Save**: If `isSaving || isDeleting`, abort. Set `isSaving = true`.
- **On Delete**: If `isSaving || isDeleting`, abort. Set `isDeleting = true`.
- **UI Locking**:
  - `nameInput`: `disabled={isSaving || isDeleting}`
  - `captionTextarea`: `disabled={isSaving || isDeleting}`
  - `Cancel` button: `disabled={isSaving || isDeleting}`, `cursor: (isSaving || isDeleting) ? 'not-allowed' : 'pointer'`
  - `Delete asset` button: `disabled={isSaving || isDeleting}`, label: `isDeleting ? 'Deleting...' : 'Delete asset'`
  - `Save changes` button: `disabled={isSaving || isDeleting}`, label: `isSaving ? 'Saving...' : 'Save changes'`
- **Finally**: reset flags
