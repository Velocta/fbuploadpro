# Research: Media Library Sidebar Cleanup & Double-Click Action State Hardening

**Feature**: Spec 071  
**Target Area**: `apps/web/src/components/media/`  

---

## 1. Sidebar Rail Removal Analysis

- **Current Implementation**: In Spec 070 (commit `300f03d`), `<aside data-testid="media-views-rail">` was added inside `media-library-explorer.tsx`. It contains:
  - `VIEWS` section with `Everything` and `Needs caption` smart view filters.
  - `FOLDERS` section with root `Library` and top-level folder buttons.
- **Problem**:
  1. It cramps the horizontal grid and table view by taking up 180px plus gap.
  2. It duplicates the existing context breadcrumb row (`Library / Folder A / Folder B`) and the inline subfolder rows section (`FOLDERS (n)`).
  3. The user explicitly chose: "Remove the entire left sidebar rail completely, returning to a full-width media canvas with breadcrumb navigation and subfolder rows."
- **Resolution**:
  - Remove `<aside data-testid="media-views-rail">` and the `MediaViewsRail` component completely.
  - Remove the flex wrapper (`data-testid="media-explorer-body"`) splitting the layout into rail + canvas, allowing the body to take full width directly.
  - Any smart views can be represented by existing filter controls (e.g. `Captions: Missing caption` filter already exists in the local toolbar zone).
  - Update unit tests in `media-library-explorer.test.tsx` that assert the presence of `media-views-rail`.

---

## 2. Double-Click Action State Hardening Analysis

### Target Areas & Handlers
1. **New Folder Modal (`new-folder-modal.tsx`)**:
   - `isSubmitting` is tracked, but `Cancel` button is not disabled during submission.
   - Text field and parent folder selector should be disabled during submit.
   - Guard handler against double submit.

2. **Folder Rename (`media-library-explorer.tsx`)**:
   - Currently, `handleRenameFolder` has no `isRenamingFolder` state.
   - In the Rename dialog, the "Save" button has no loading state, and neither "Save" nor "Cancel" is disabled during the API call.
   - Add `isRenamingFolder: boolean`.
   - Add early return: `if (isRenamingFolder) return;`.
   - Update button label to "Saving...", set `disabled={isRenamingFolder || !renameDraft.trim()}`.

3. **Folder Deletion (`media-library-explorer.tsx`)**:
   - Currently, `handleDeleteFolder` has no `isDeletingFolder` state.
   - In the Delete dialog, "Delete" has no loading state, and neither "Delete" nor "Cancel" is disabled during the API call.
   - Add `isDeletingFolder: boolean`.
   - Add early return: `if (isDeletingFolder) return;`.
   - Update button label to "Deleting...", set `disabled={isDeletingFolder}`.

4. **Folder & Asset Move (`media-library-explorer.tsx`)**:
   - Currently, moving via the Move dialog calls `handleReparent` or `handleBatchMoveSubmit` without an `isMoving` state.
   - Add `isMoving: boolean`.
   - Add early return: `if (isMoving) return;`.
   - Update button label to "Moving...", set `disabled={isMoving}`.

5. **Batch Actions (`batch-action-bar.tsx` & `media-library-explorer.tsx`)**:
   - `BatchActionBar` has an `isBusy` prop, but it is currently never provided by `MediaLibraryExplorer`.
   - Add `isBatchBusy: boolean` (composed of `isBatchDeleting || isBatchMoving || isBatchCaptioning`).
   - Pass `isBusy={isBatchBusy}` so all buttons on the bar are disabled and show `cursor: 'not-allowed'`.
   - Add guard checks in `handleBatchDelete`, `handleBatchMoveSubmit`, and `handleBatchCaptionApply`.

6. **Batch Set Caption Modal (`batch-set-caption-modal.tsx`)**:
   - Modal tracks `isSubmitting`, but `Cancel` button is not disabled during submission.
   - Disable textarea and mode radio inputs during submission.
   - Add guard `if (isSubmitting) return;`.

7. **Single Asset Deletion (`media-library-explorer.tsx`, `media-asset-card.tsx`, `media-table-row.tsx`)**:
   - Add `deletingAssetId: string | null` or `isDeletingItem: boolean`.
   - Guard `handleDeleteItem`: `if (deletingAssetId === mediaId) return;`.

8. **Media Preview Modal (`media-preview-modal.tsx`)**:
   - Modal has `isSaving`, but no `isDeleting`.
   - Add `isDeleting: boolean`.
   - Disable "Cancel", "Delete asset", and "Save changes" while either `isSaving` or `isDeleting` is true.
   - Disable input and textarea while saving or deleting.

9. **Import Modal (`media-import-modal.tsx`)**:
   - Add `isStartingImport: boolean` guard on `handleStartImport` to prevent double-clicking the primary CTA before state switches to `'progress'`.

---

## 3. Immutability & Token Governance

- Single source of truth: `apps/web/src/lib/theme.ts`.
- `DESIGN.md` is strictly immutable.
- No new external packages.
- Zero local builds; all verification via remote GitHub Actions CI.
