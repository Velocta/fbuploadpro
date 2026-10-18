# Research & Root Cause Analysis: Media Library Functional Fixes

## 1. Issue 1: Spontaneous Import Cancellation & Upload Failures

### Root Cause
1. **Contract Field Mismatch in `media-import-modal.tsx`**:
   - The `/api/tenant/[subdomain]/media/upload-url` endpoint responds with `@fbuploadpro/contracts` `UploadUrlResponse`:
     - `mediaUploadUrl` (presigned PUT URL for the file)
     - `mediaKey` (R2 storage key for the file)
     - `publicMediaUrl` (public asset URL)
     - `thumbnailUploadUrl` (presigned PUT URL for thumbnail)
     - `thumbnailKey` (R2 storage key for thumbnail)
     - `publicThumbnailUrl` (public thumbnail URL)
   - In `media-import-modal.tsx` (lines 356 & 414), the code destructured:
     - `const { uploadUrl, mediaId, storageKey, thumbnailUploadUrl, thumbnailKey } = presignData;`
     - `uploadUrl` and `storageKey` were `undefined`.
   - Result:
     - `xhr.open('PUT', uploadUrl, true)` called `xhr.open('PUT', 'undefined', true)`.
     - The browser attempted to PUT the file to `/tenant/[subdomain]/undefined` relative URL, resulting in a 404 or 405 response.
     - When confirmation ran, `storageKey: undefined` and `url: ''` failed Zod schema validation in `/api/tenant/[subdomain]/media/confirm` (which enforces `storageKey: z.string().min(1)` and `url: z.string().url()`).
     - Confirmation failed with HTTP 400.
2. **Defective State Machine Completion / Cancellation Labeling**:
   - In `media-import-modal.tsx`:
     ```tsx
     {step === 'complete' &&
       (completedItems.length > 0
         ? `Import complete — ${completedItems.length} of ${totalInBatch} uploaded`
         : 'Import canceled — nothing was uploaded')}
     ```
   - When all items failed due to the field mismatch and exhausted retries, `inFlight.length === 0` and `step === 'complete'` fired.
   - Because `completedItems.length === 0`, it rendered: `"Import canceled — nothing was uploaded"`, falsely blaming user cancellation for an internal upload failure.
3. **Explicit User Cancellation Guard**:
   - State machine must only mark an import batch as "canceled" if triggered by explicit user action:
     - `cancelReason: 'user_cancel_remaining' | 'user_cancel_item' | null`
   - If an upload fails, it displays `failed — retry` per-file.
   - If all items fail without user cancellation, the header must read: `"Import failed — 0 of N uploaded"`.
   - Logging added: `console.warn('[upload-engine] Transition to complete', { reason, completed, failed, total })`.

---

## 2. Issue 2: Existing Storage Media (`velocta-avatar.png`) Not Listed

### Root Cause
1. In `MediaLibraryExplorer` (`apps/web/src/components/media/media-library-explorer.tsx`, line 510):
   - The component requests `fetch('/api/tenant/${subdomain}/media?limit=500')`.
2. In `packages/contracts/src/domain/media.ts` (line 111):
   - `MediaListQuerySchema` defined:
     ```ts
     limit: z.coerce.number().int().min(1).max(100).default(50)
     ```
   - It strictly capped `limit` at `100`.
3. In `apps/web/src/app/api/tenant/[subdomain]/media/route.ts` (line 65):
   - `MediaListQuerySchema.safeParse({ limit: '500', ... })` returned `{ success: false, error: 'Number must be less than or equal to 100' }`.
   - The route returned HTTP 400 `INVALID_QUERY`.
4. In `MediaLibraryExplorer`:
   - `if (mediaRes.ok) { setMediaItems(...) }` was bypassed because `res.ok` was false (400).
   - `mediaItems` remained `[]`.
   - `velocta-avatar.png` (which exists in `media_items` table with `folder_id: null` and in Cloudflare R2) was never populated in state.
   - Any search or folder view rendered: `"No media in this folder"` or `"No matching files found"`.
5. **Remediation**:
   - Update `MediaListQuerySchema` in `packages/contracts/src/domain/media.ts` to allow `max(1000)`.
   - Rebuild `@fbuploadpro/contracts`.
   - `GET /api/tenant/[subdomain]/media?limit=500` will return HTTP 200 with all media items including `velocta-avatar.png`.

---

## 3. Issue 3: Dropdown Option Clicks Swallowed by Document Pointerdown

### Root Cause
1. In `MediaLibraryExplorer`:
   ```tsx
   useEffect(() => {
     if (!activeDropdown) return;
     const handleOutsideClick = () => setActiveDropdown(null);
     document.addEventListener('pointerdown', handleOutsideClick);
     return () => document.removeEventListener('pointerdown', handleOutsideClick);
   }, [activeDropdown]);
   ```
2. When the user clicked on an option in the dropdown menu:
   - `pointerdown` fired on the option element and bubbled to `document`.
   - The `document` listener executed `setActiveDropdown(null)` immediately.
   - React unmounted the dropdown menu DOM node.
   - The subsequent `click` event on the option button never fired!
   - Selection was never applied, and the trigger label never changed.
3. **Remediation**:
   - Wrap each dropdown in a container ref (`ratioDropdownRef`, `captionDropdownRef`, `sortDropdownRef`).
   - The outside-click handler checks `if (containerRef.current?.contains(event.target as Node)) return;`.
   - Option buttons can also handle `onClick` or `onPointerDown` cleanly.
   - Add keyboard selection support (Enter, Space, Escape, ArrowDown, ArrowUp).

---

## 4. Issue 4: Toolbar Group Hairline Dividers

### Requirements & Design Alignment
- Approved design specifies single hairline dividers between toolbar groups:
  1. Group 1: Search input
  2. Group 2: Media-type tabs (`All / Videos / Images`)
  3. Group 3: Dropdown filters (`Aspect Ratio`, `Caption Status`, `Sort`)
  4. Group 4: View mode toggle (`Grid / Table`)
- Hairline divider element:
  ```tsx
  <div
    role="separator"
    aria-orientation="vertical"
    style={{
      width: '1px',
      height: '16px',
      backgroundColor: 'var(--border-subtle, rgba(255, 255, 255, 0.12))',
      flexShrink: 0,
    }}
  />
  ```
- Complies strictly with `.agents/rules/theme-standards.md` using existing CSS variable `--border-subtle` and zero ad-hoc styling.
