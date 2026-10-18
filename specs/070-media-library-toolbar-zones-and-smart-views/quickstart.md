# Quickstart Verification Guide: Toolbar Zones & Smart Views

**Spec ID**: 070

---

## Verification Test Journeys

### Journey 1: Verify Three-Zone Toolbar & Labeled Dropdowns
1. Navigate to `/tenant/[subdomain]/media`.
2. Inspect Zone 1:
   - Search input displays placeholder `"Search files and captions…"`.
3. Inspect Divider 1:
   - 1px hairline vertical separator separates Zone 1 and Zone 2.
4. Inspect Zone 2:
   - Scope tag displays `"In: Library"`.
   - Dropdown 1: `"Type: All"`.
   - Dropdown 2: `"Ratio: All"`.
   - Dropdown 3: `"Captions: All"`.
5. Click `"Ratio: All"`, select `"9:16 Vertical"`.
   - Trigger updates to `"Ratio: 9:16"`.
   - `"9:16"` has the active accent underline (`2px solid ${PALETTE.primary}`).
   - `"1 filter · Clear"` appears next to dropdowns.
6. Click `"Clear"`:
   - All dropdowns reset to `"All"`.
   - Active underline disappears.
   - Clear button disappears.

---

### Journey 2: Verify Root Rename to "Library"
1. Verify breadcrumbs display `"Library"` at root.
2. Click `"+ New Folder"`:
   - Modal header says `"New Folder"`.
   - "PLACE INSIDE" dropdown defaults to `"Library"`.
3. Move modal / batch move modal destination dropdown shows `"Library"` at root.

---

### Journey 3: Verify Rail Smart Views ("VIEWS")
1. In the left rail, verify section `"VIEWS"` contains:
   - `"Everything"`
   - `"Needs caption"`
2. Verify NO `"Videos"` or `"Images"` collections exist in the rail.
3. Click `"Needs caption"`:
   - Scope tag in Zone 2 updates to `"In: Needs caption"`.
   - Grid renders only assets with missing/empty captions across all folders.
4. Click `"Everything"`:
   - Scope tag in Zone 2 updates to `"In: Everything"`.
   - Grid renders all assets across all folders.

---

### Journey 4: Library-Wide Search with Folder Path Attribution
1. Navigate into a subfolder `"asdf"`.
2. Scope tag reads `"In: asdf"`.
3. Enter `"velocta"` in search input.
4. Scope tag shifts to library-wide (`"In: Library"`).
5. Search results display files from root and other folders.
6. Each result card displays `"in Library"` or `"in asdf / sdafd"`.
