# UX, Theme & Security Checklist: Spec 029 — Nested Media Library Explorer

## Theme & Design System Compliance (`apps/web/src/lib/theme.ts` & `DESIGN.md`)
- [x] Zero modifications to `DESIGN.md` (permanently frozen).
- [x] All colors, borders, radii, and shadows reference `@web/lib/theme` or reactive CSS custom properties (`var(--bg-panel)`, `var(--bg-canvas)`, `var(--bg-subtle)`, `var(--border-subtle)`, `var(--text-main)`, `var(--text-sub)`, `var(--accent-1)`, `var(--accent-3)`).
- [x] Zero capsule pill badges (`border-radius: 9999px`) anywhere in the Media Library UI.
- [x] Zero decorative or simulated status dots ("Online", "Ready", "Storage Active").
- [x] Professional, user-centered UX copy free of backend/database/R2/schema jargon.

## Multi-Tenant Security & Data Integrity
- [x] Every folder and media query enforces `user_id = session.userId`.
- [x] Creating or moving a folder with `parentId` verifies the parent folder belongs to `session.userId`.
- [x] Moving a folder checks via recursive CTE that `parentId` is not `folderId` or a descendant of `folderId`.
- [x] Deleting a folder purges all descendant media objects and thumbnails from Cloudflare R2 before deleting DB records.
- [x] Batch operations (`move`, `delete`, `caption`) strictly filter by `user_id = session.userId`.

## Explorer Ergonomics, Scale & Safeguards (US5–US7)
- [x] Global search omits `folderId` when `searchQuery` is non-empty, displaying both matching folders and matching media across all folders with clickable folder path links (`data-testid="media-folder-path-<id>"`) on media cards.
- [x] Pagination supports both `IntersectionObserver` infinite scroll (`data-testid="infinite-scroll-sentinel"`) and a manual **"Load more (`Showing X of Y`)"** fallback button (`data-testid="load-more-media-btn"`).
- [x] Active folder synchronizes with `?folder=<id>` in the URL on mount, folder navigation (`history.pushState`), and browser Back/Forward (`popstate`).
- [x] `Shift + Click` selects contiguous range of media cards; `Escape` clears selection when no modal is open; `ArrowLeft` / `ArrowRight` cycles items inside `MediaPreviewModal`.
- [x] Hovering a video card for `300ms` plays a muted inline `<video>` preview (`data-testid="hover-video-preview-<id>"`) and cleans up on pointer leave.
- [x] Duplicate upload detection checks case-insensitive `name` and exact `fileSize` in the target folder and prompts with `data-testid="duplicate-upload-modal"` offering **Skip duplicates** (`data-testid="skip-duplicates-btn"`) and **Upload all anyway** (`data-testid="upload-all-anyway-btn"`).

