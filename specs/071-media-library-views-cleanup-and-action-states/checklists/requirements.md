# Requirements Quality Checklist: Spec 071

## 1. Scope & Layout
- [ ] Left sidebar rail (`MediaViewsRail`, `data-testid="media-views-rail"`) completely removed.
- [ ] No `VIEWS` heading, `Everything`, or `Needs caption` sidebar rail rendered.
- [ ] Explorer body takes full width with breadcrumbs context row and subfolder rows.
- [ ] No "box-in-box" styling; divider hairlines and spacing used per design standards.
- [ ] `DESIGN.md` remains untouched and immutable.

## 2. Action States & Multi-Click Protection
- [ ] `NewFolderModal`: Submit button shows "Creating...", disabled when submitting; Cancel button disabled; input disabled.
- [ ] `RenameFolderDialog`: Save button shows "Saving...", disabled when renaming; Cancel button disabled; input disabled.
- [ ] `DeleteFolderDialog`: Delete button shows "Deleting...", disabled when deleting; Cancel button disabled.
- [ ] `MoveTargetDialog`: Move button shows "Moving...", disabled when moving; Cancel button disabled.
- [ ] `BatchActionBar`: Receives `isBusy`; all buttons disabled and non-clickable during batch operations.
- [ ] `BatchSetCaptionModal`: Apply button shows "Applying...", disabled when submitting; Cancel and inputs disabled.
- [ ] `MediaPreviewModal`: Save button shows "Saving...", disabled when saving; Delete button shows "Deleting...", disabled when deleting; Cancel button disabled during both.
- [ ] `MediaImportModal`: Start import button guarded against rapid double clicks.

## 3. Architecture & Documentation
- [ ] Unit tests updated in `apps/web/tests/ui/media-library-explorer.test.tsx` for layout and action states.
- [ ] Documentation updated in `docs/foundational-knowledge.md`.
- [ ] Single combined PR created with zero local CI build execution.
