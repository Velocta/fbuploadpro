# UX, Theme & Security Checklist: Spec 030 — Media Library View Modes, Upload Controls, Filters & Frame Picker

## Theme & Design System Compliance (`apps/web/src/lib/theme.ts` & `DESIGN.md`)
- [x] Zero modifications to `DESIGN.md` (permanently frozen).
- [x] All colors, borders, radii, and shadows in Grid View, Compact Table View, Upload Banner, and Preview Modal reference `@web/lib/theme` tokens.
- [x] Zero capsule pill badges (`border-radius: 9999px`).
- [x] Zero decorative or simulated status dots.
- [x] Professional, user-centered UX copy free of internal backend/database/R2 jargon.

## Multi-Tenant Security & Data Integrity
- [x] `GET /api/tenant/[subdomain]/media` filters (`aspectRatio`, `captionStatus`) strictly use parameterized SQL conditions scoped to `user_id = session.userId`.
- [x] `PATCH /api/tenant/[subdomain]/media/[mediaId]` verifies `(id = $1 AND user_id = $2)` before updating `thumbnail_key` / `thumbnail_url` or deleting the superseded R2 thumbnail object.

## Functional & UX Verification
- [x] Grid View is the default view mode (`'grid'`) and toggling to Compact Table View (`'table'`) persists in `localStorage` (`fbuploadpro:media-view-mode`).
- [x] Compact Table View rows render click-to-edit inline caption cells (`data-testid="table-inline-caption-<id>"`) that turn into an input on click and save on `Enter` or `blur`.
- [x] Upload queue supports cooperative **Pause** (`data-testid="pause-upload-btn"`), **Resume** (`data-testid="resume-upload-btn"`), **"Retry Failed (`X`)"** (`data-testid="retry-failed-uploads-btn"`), and `beforeunload` tab-close protection.
- [x] Video preview modal renders **"Set Current Frame as Thumbnail"** (`data-testid="set-video-frame-thumbnail-btn"`) and persists the captured frame.
