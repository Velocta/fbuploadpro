# Feature Specification: Spec 061 Workspace Settings General Tab Redesign

**Feature Branch**: `feat/061-workspace-settings-general-redesign`  
**Created**: 2026-10-16  
**Status**: Ready for Implementation  
**Input**: User directive: "redesign ONLY the General tab content. Do not touch the Facebook BYOC tab, auth logic, routing, or any other page. Page header: Heading: 'Settings', Subtext: 'Manage Settings'. Tab bar: Keep 'General' and 'Facebook BYOC'. General tab content: ONE card only 'About this workspace' with 'Name your workspace.', WORKSPACE NAME row with current value and Edit button, inline editing with Save/Cancel, validation 3-40 chars no leading/trailing spaces, toast 'Workspace name updated.', helper line 'Rename it any time — the new name shows up everywhere.', remove all other items."

---

## 1. Vision & Executive Summary

The legacy General settings tab accumulated extraneous metadata cards, subdomain display boxes, operational status indicators, creation timestamps, and redundant identifiers. Spec 061 streamlines the General tab into a focused, airy, minimalist single-card surface dedicated solely to workspace identity.

The card allows the operator to review their current workspace name and update it via an inline edit experience. Upon saving, the name persists to the database and immediately updates everywhere it appears (including the studio sidebar and workspace switcher dropdown) accompanied by a success toast, with zero layout shift and responsive mobile handling.

---

## 2. User Scenarios & Testing

### User Story 1 - Minimalist Single-Card Workspace Identity View (Priority: P1)
As an operator in Workspace Settings, I want to view a clean, focused, single-card "About this workspace" panel with generous whitespace and exact professional copy, free of redundant subdomain displays, simulated status dots, creation dates, or storage info.

**Why this priority**: Immediate visual clarity and adherence to the single-card workspace settings design standard.

**Independent Test**: Navigate to `/tenant/[subdomain]/settings?tab=general` and verify that the page displays the "Settings" header, "Manage Settings" subtext, and exactly one card titled "About this workspace" with subtext "Name your workspace." and the "WORKSPACE NAME" row.

**Acceptance Scenarios**:
1. **Given** the Workspace Settings page, **When** rendered, **Then** the page header displays heading "Settings" and subtext "Manage Settings".
2. **Given** the tab navigation, **When** rendered, **Then** both "General" (active) and "Facebook BYOC" tabs are present and unchanged in functionality.
3. **Given** the General tab content, **When** inspected, **Then** it contains exactly ONE card with heading "About this workspace", subtext "Name your workspace.", and helper text "Rename it any time — the new name shows up everywhere."
4. **Given** the General tab content, **When** inspected, **Then** it contains NO subdomain display, NO status indicator, NO "Created" date, NO plan/storage info, and NO danger zone.

---

### User Story 2 - Inline Edit, Validation, and Everywhere Synchronization (Priority: P1)
As an operator, I want to click "Edit" on the workspace name row to edit the name inline, enter a valid name (3–40 characters, no leading or trailing whitespace), click "Save" to persist the change, see a success toast "Workspace name updated.", and have the new name instantly reflected in the sidebar and workspace switcher without page reload.

**Why this priority**: Seamless editing workflow with immediate UI responsiveness and robust data persistence.

**Independent Test**: Click "Edit", change the workspace name to a valid string, click "Save", verify the toast "Workspace name updated.", and check that the sidebar footer and workspace switcher display the new name. Click "Cancel" to verify that edits revert cleanly without saving.

**Acceptance Scenarios**:
1. **Given** the "WORKSPACE NAME" row, **When** the user clicks "Edit", **Then** the value transforms into an inline text input pre-filled with the current name, alongside "Save" (primary) and "Cancel" (secondary) buttons.
2. **Given** the inline edit state, **When** the user clicks "Cancel", **Then** the input reverts back to the static display value with no modifications made.
3. **Given** an invalid input (less than 3 characters, greater than 40 characters, or containing leading/trailing spaces), **When** the user attempts to save, **Then** an inline validation error is shown and the request is prevented.
4. **Given** a valid name input (3–40 characters without leading/trailing whitespace), **When** the user clicks "Save", **Then** the name is persisted via the API, the inline input transitions back to the display row, a success toast "Workspace name updated." appears, and the workspace sidebar and switcher update synchronously.

---

### User Story 3 - Responsive Mobile Layout Adaptation (Priority: P2)
As a mobile user viewing Workspace Settings, I want the card to adapt seamlessly to small screens so that the name row stacks vertically with the Edit button spanning full-width below the name.

**Why this priority**: Eliminates awkward text truncation or button clipping on narrow viewports.

**Independent Test**: Resize viewport to mobile width (<640px) and inspect the workspace name row. Verify the name is positioned above and the Edit button is rendered below at full-width without layout overflow.

**Acceptance Scenarios**:
1. **Given** a mobile viewport (<640px), **When** viewing the General tab, **Then** the card spans full width.
2. **Given** the name row on mobile, **When** rendered, **Then** the layout stacks with the name value above and the Edit button below spanning full width.
3. **Given** the editing state on mobile, **When** active, **Then** the Save and Cancel buttons stack or flex responsively within the card boundaries.

---

## 3. Requirements

### Functional Requirements
- **FR-001**: Page header in `apps/web/src/app/tenant/[subdomain]/settings/page.tsx` MUST display heading "Settings" and subtext "Manage Settings" verbatim.
- **FR-002**: Tab bar in `page.tsx` MUST preserve "General" (active) and "Facebook BYOC" tabs unchanged.
- **FR-003**: General tab content MUST consist of strictly ONE card with:
  - Card heading: "About this workspace"
  - Card subtext: "Name your workspace."
  - Name row label: "WORKSPACE NAME" (small-caps label style).
  - Current workspace name display value.
  - "Edit" button on the right (secondary/outline button style).
  - Helper line under the row: "Rename it any time — the new name shows up everywhere."
- **FR-004**: Clicking "Edit" MUST convert the name value into an inline text input with "Save" (primary button style) and "Cancel" (secondary button style).
- **FR-005**: Validation MUST enforce:
  - Minimum 3 characters.
  - Maximum 40 characters.
  - No leading or trailing spaces (`name === name.trim()`).
- **FR-006**: Saving MUST persist the updated workspace name via `PATCH /api/workspaces` (or workspace update endpoint).
- **FR-007**: Saving MUST dispatch a workspace update event (`workspace-updated`) so that `WorkspaceStudioFooter` and `WorkspaceSwitcher` immediately reflect the updated name across the shell.
- **FR-008**: Saving MUST show a success toast: "Workspace name updated."
- **FR-009**: Clicking "Cancel" MUST revert the edit state back to the previous name without persisting.
- **FR-010**: All other legacy items in the General tab (subdomain display, status indicator, created date, plan/storage info, danger zone) MUST be removed completely.
- **FR-011**: Zero emojis anywhere in the UI or copy.
- **FR-012**: Responsive design MUST stack the name row on mobile viewports (<640px).
- **FR-013**: All styling MUST strictly use existing theme tokens from `@/lib/theme` and CSS variables without hardcoded hex colors or arbitrary styling.

---

## 4. Success Criteria

1. **Exact Copy Fidelity**: Every user-facing string ("Settings", "Manage Settings", "About this workspace", "Name your workspace.", "WORKSPACE NAME", "Edit", "Save", "Cancel", "Rename it any time — the new name shows up everywhere.", "Workspace name updated.") matches verbatim.
2. **Single-Card Architecture**: The General tab contains strictly one card; all legacy metadata, status dots, and subdomain displays are purged.
3. **Synchronization**: Saving updates the workspace name across the active view, sidebar footer, and workspace switcher without requiring a full page refresh.
4. **Validation Integrity**: Names with <3 chars, >40 chars, or leading/trailing spaces are rejected with clear inline feedback.
5. **Clean Layout**: Zero layout shift, responsive stacking on mobile viewports, and zero console errors.

---

## 5. Assumptions

- The backend will support updating the workspace name via `PATCH /api/workspaces` for authenticated workspace owners.
- The browser dispatches and receives custom events (`workspace-updated`) to synchronize state between the settings card and navigation components in the same window.
