# Quickstart & Verification Guide: Spec 071

## Overview

This guide outlines verification scenarios for testing the removal of the Media Views sidebar and double-click protection across all actions and buttons in the Media Library.

## Verification Checklist

### 1. Full-Width Layout Verification
- Navigate to `/tenant/[subdomain]/media`.
- Verify that no sidebar rail (`media-views-rail` or `VIEWS` header) is present.
- Verify the toolbar, breadcrumb context row, subfolders list, and asset canvas span the full available width cleanly.
- Verify that clicking breadcrumb ancestors or subfolder rows navigates cleanly between folders.

### 2. Double-Click & Action States Verification
- **New Folder**:
  - Open "New folder" dialog.
  - Enter a valid name and click "Create folder" rapidly multiple times.
  - Verify button displays "Creating...", inputs are disabled, and only one folder creation request is sent.
- **Rename Folder**:
  - Open folder rename dialog.
  - Click "Save" rapidly multiple times.
  - Verify button displays "Saving..." and only one PATCH request is sent.
- **Delete Folder**:
  - Open folder delete confirmation dialog.
  - Click "Delete" rapidly.
  - Verify button displays "Deleting..." and only one DELETE request is sent.
- **Move Folder / Media**:
  - Open move dialog.
  - Click "Move" rapidly.
  - Verify button displays "Moving..." and only one move request is executed.
- **Batch Actions**:
  - Select 2+ media items.
  - Click "Delete" on `BatchActionBar`.
  - Confirm deletion.
  - Verify `isBusy` disables all buttons on the bar until deletion completes.
- **Batch Set Caption**:
  - Select 2+ media items and click "Set caption".
  - Type text and click "Apply to N files" rapidly.
  - Verify button shows "Applying..." and disables form controls.
- **Preview Modal**:
  - Open preview for an asset.
  - Click "Save changes" rapidly; verify button shows "Saving..." and delete/cancel buttons are locked.
  - Click "Delete asset" and confirm; verify button shows "Deleting..." and save/cancel buttons are locked.
- **Media Import**:
  - Select files for import.
  - Click "Start import (N)" rapidly; verify it transitions once without spawning duplicate queues.
