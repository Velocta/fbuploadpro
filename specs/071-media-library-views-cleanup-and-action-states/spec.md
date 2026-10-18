# Feature Specification: Media Library Sidebar Cleanup & Double-Click Action State Hardening

**Feature Branch**: `feat/071-media-library-views-cleanup-and-action-states`  
**Created**: October 18, 2026  
**Status**: Ready for Implementation  
**Input**: "remove the VIEWS sidebar from media library and add proper states on every action and button so users dont click them twice"

---

## Overview

The Media Library currently renders a 180px left sidebar rail (`MediaViewsRail`) introduced in Spec 070 containing a "VIEWS" section (`Everything`, `Needs caption`) and a redundant "FOLDERS" section that duplicates folder navigation already handled by the breadcrumb trail and subfolder rows in the main body. Furthermore, various user interactions (folder creation, renaming, moving, single/batch deletion, batch captioning, asset saving, and import initiation) lack resilient in-flight loading/disabled states and double-click guards, exposing users to duplicated API requests, duplicate folder creations, accidental double deletions, or conflicting state mutations.

This specification:
1. **Removes the Left Sidebar Rail Completely**: Reverts the Media Library layout to a clean, full-width canvas. All folder navigation remains intuitive through the context breadcrumb row and inline subfolder rows (`FOLDERS (n)`).
2. **Double-Click Action State Hardening**: Equips every button, form submit, modal action, and row-level control across the Media Library with comprehensive pending/loading states (`isSubmitting`, `isDeleting`, `isMoving`, `isSaving`, `isBusy`), explicit `disabled` attributes, visual non-clickable cursor states (`cursor: not-allowed`), and early-exit guards in event handlers.

---

## User Scenarios & Testing

### User Story 1 - Full-Width Media Library Canvas without Sidebar Rail (Priority: P1)

As a content creator or social media manager,  
I want the Media Library to occupy the full width of the main canvas without a cramped, redundant left sidebar rail,  
So that my asset thumbnails, table columns, and subfolder rows have maximum screen real estate and folder navigation is clean and uncluttered.

**Why this priority**: Eliminates visual clutter, resolves layout duplication between the left rail and inline subfolders, and honors the user's explicit design instruction to remove the sidebar rail.

**Independent Test**: Mount `MediaLibraryExplorer`, verify that no `<aside data-testid="media-views-rail">` exists, the breadcrumbs context row handles folder ancestry navigation, and subfolder rows render directly above the media canvas.

**Acceptance Scenarios**:
1. **Given** a user navigates to `/tenant/[subdomain]/media`, **When** the page loads, **Then** no left sidebar rail (`media-views-rail` / "VIEWS") is rendered, and the main media explorer body occupies 100% width.
2. **Given** root folders and subfolders exist in the workspace, **When** the user views the Library, **Then** subfolders are displayed as clean rows under the section label `FOLDERS (n)` with hover actions (Rename, Move, Delete).
3. **Given** the user navigates into a folder, **When** clicking subfolder rows or breadcrumbs, **Then** the context row displays the accurate breadcrumb path (`Library / Subfolder`) and allows clicking any ancestor or dragging items onto crumbs to reparent.

---

### User Story 2 - Resilient Action States & Double-Click Protection on Folder Operations (Priority: P1)

As a workspace user managing media organization,  
I want folder creation, renaming, moving, and deletion to show clear loading states and immediately lock against double clicks,  
So that I cannot accidentally create duplicate folders, fire multiple delete calls, or corrupt hierarchy state through rapid clicking.

**Why this priority**: Prevents race conditions and duplicate backend mutations that trigger server errors or duplicate database records.

**Independent Test**: Trigger folder creation, rename, move, and deletion while simulating rapid double clicks; verify only one network request is dispatched and buttons immediately show disabled/loading states.

**Acceptance Scenarios**:
1. **Given** the "New folder" dialog is open, **When** the user clicks "Create folder", **Then** the button immediately displays "Creating...", becomes disabled (`disabled={isSubmitting}`), inputs and cancel buttons are disabled, and rapid clicks are ignored.
2. **Given** the "Rename folder" dialog is open, **When** the user clicks "Save", **Then** the button immediately displays "Saving...", becomes disabled, and the handler exits early if already renaming.
3. **Given** the "Delete folder" confirmation dialog is open, **When** the user clicks "Delete", **Then** the button immediately displays "Deleting...", becomes disabled, and the delete handler ignores subsequent clicks while the request is in flight.
4. **Given** the "Move" dialog is open for a folder or asset, **When** the user clicks "Move", **Then** the button displays "Moving...", is disabled, and ignores rapid clicks.

---

### User Story 3 - Resilient Action States & Double-Click Protection on Asset & Batch Operations (Priority: P1)

As a workspace user performing batch or single asset modifications,  
I want batch actions (delete, caption, move) and single asset operations (delete, save changes, import start) to disable immediately upon click,  
So that multiple batch mutations or duplicate uploads cannot be submitted in parallel.

**Why this priority**: Guarantees data integrity for media assets and prevents duplicate deletion dialogs or parallel batch API calls.

**Independent Test**: Test single asset deletion, batch deletion, batch caption submission, and import start with rapid multi-clicks; verify immediate disabling and single network call execution.

**Acceptance Scenarios**:
1. **Given** assets are selected and the floating `BatchActionBar` is visible, **When** the user confirms batch deletion, **Then** `isBusy` is set to `true`, all batch buttons ("Move", "Set caption", "Delete", "Clear") are disabled, and double clicks are blocked.
2. **Given** `BatchSetCaptionModal` is open, **When** the user clicks "Apply to N files", **Then** the button displays "Applying...", becomes disabled, form controls and Cancel button are disabled, and rapid clicks are blocked.
3. **Given** `MediaPreviewModal` is open, **When** the user clicks "Save changes", **Then** the button displays "Saving...", is disabled, and "Delete asset" and "Cancel" are disabled during the save.
4. **Given** `MediaPreviewModal` is open, **When** the user clicks "Delete asset" and confirms, **Then** the button displays "Deleting...", is disabled, and "Save changes" and "Cancel" are disabled during deletion.
5. **Given** `MediaImportModal` has staged files, **When** the user clicks "Start import (n)", **Then** the button immediately disables to prevent initiating duplicate concurrent queues.

---

## Edge Cases

- **Network Delay / Slow Connection**: When an API operation takes 2–3 seconds, all action buttons must remain in their disabled/busy state until completion without flicker or re-enabling prematurely.
- **API Failure / Error**: If an API call fails with a non-2xx response, the loading state must reset cleanly (via `finally` blocks) and surface an error toast, allowing the user to retry safely.
- **Modal Dismissal During Submit**: Backdrop clicks and Escape key presses must be disabled or ignored while a form submission or deletion is in flight (`isSubmitting` / `isDeleting`).
- **Rapid Navigation Clicks**: Clicking between breadcrumb items or subfolder rows rapidly must be handled cleanly without crashing or leaving outdated state.

---

## Requirements

### Functional Requirements
- **FR-001**: System MUST remove the `<aside data-testid="media-views-rail">` component and restore a full-width explorer canvas across `/tenant/[subdomain]/media`.
- **FR-002**: System MUST preserve all existing toolbar search and filter capabilities (Type, Aspect Ratio, Captions, Sort, View mode) and breadcrumb folder navigation.
- **FR-003**: System MUST provide an `isSubmitting` / loading state on `NewFolderModal` that disables both the submit and cancel buttons and prevents double submission.
- **FR-004**: System MUST provide an `isRenaming` state on the Rename Folder dialog that disables "Save" and "Cancel" buttons and shows "Saving...".
- **FR-005**: System MUST provide an `isDeleting` state on the Delete Folder dialog that disables "Delete" and "Cancel" buttons and shows "Deleting...".
- **FR-006**: System MUST provide an `isMoving` state on the Move dialog that disables "Move" and "Cancel" buttons and shows "Moving...".
- **FR-007**: System MUST provide an `isBusy` / `isDeleting` state for batch delete operations, disabling all controls on `BatchActionBar`.
- **FR-008**: System MUST provide an `isSubmitting` state on `BatchSetCaptionModal` that disables the apply button ("Applying..."), cancel button, and inputs.
- **FR-009**: System MUST provide distinct `isSaving` and `isDeleting` states in `MediaPreviewModal` that lock out all conflicting footer buttons and inputs.
- **FR-010**: System MUST protect `MediaImportModal` "Start import" against rapid double-clicks.
