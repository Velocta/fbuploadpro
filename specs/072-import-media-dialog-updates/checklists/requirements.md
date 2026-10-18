# Requirements Checklist: 072-import-media-dialog-updates

## Staging Mode
- [ ] Destination pill button `"To: {folder}"` with folder icon on right side of header
- [ ] Subtext displays `"N files selected · will be added to {folder}"` and reacts to destination changes
- [ ] 46px square thumbnail preview for image files with fallback on error
- [ ] Video type icon rendered for video files
- [ ] Validation copy: `"empty file"`, `"too large — 500 MB max"`, `"can't upload — not a supported format"`
- [ ] Flagged rows excluded from `"Start import (n)"` count
- [ ] Duplicate banner `"N possible duplicate(s) found"` with `"Skip all"`
- [ ] Per-row duplicate flag with inline `"Keep"` and `"Skip"` (X)
- [ ] Zero concurrency copy in staging footer (removed `"Uploads run 3 at a time"`)
- [ ] Dialog backdrop click and Escape dismiss with nothing staged
- [ ] Focus trapped inside dialog while open, returns to `"Upload Files"` on close

## Progress Mode
- [ ] Header title `"Importing media"` (or `"Import complete"`)
- [ ] Header subtext `"Adding to {folder}"` (or `"N of M added to {folder}"`)
- [ ] Prominent overall percentage with full-width aggregate progress bar
- [ ] Queued rows show `"queued"` and cancel X
- [ ] Uploading rows show % label, thin progress bar, Pause and Cancel
- [ ] Paused rows show `"paused"` and Resume button
- [ ] Failed rows show `"failed — retry"` with Retry button
- [ ] Done rows show green check and `"uploaded to {folder}"`
- [ ] Cancelled rows dimmed with `"cancelled"`
- [ ] Red `"Cancel remaining"` link when more files are queued than uploading
- [ ] `"Keep working"` minimizes to floating pill during uploads
- [ ] `"Done"` primary button on completion
- [ ] All files cancelled displays `"Import canceled — nothing was uploaded"` + `"Done"`
