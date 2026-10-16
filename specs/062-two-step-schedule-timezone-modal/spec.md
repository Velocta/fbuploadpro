# Feature Specification: Spec 062 - Two-Step Professional Schedule Timezone Modal

## 1. Overview & Objective
Replace the raw single HTML `<select>` dropdown in the Facebook Page Posting Times header with a professional, accessible, two-step **Schedule Timezone Modal**. 

Users frequently need to change their posting timezone (e.g. from Pakistan `Asia/Karachi` to US Eastern `America/New_York`) to target specific geographic audiences. Changing a timezone shifts scheduled posts and alters publishing times. To prevent unexpected publication times and enhance user confidence, this feature provides a 2-step workflow:
1. **Step 1 (Select Timezone)**: Interactive search and comprehensive list of global timezones grouped by geographic region with friendly city names, country references, and current UTC offsets.
2. **Step 2 (Review & Confirm Impact)**: Explicit visual summary comparing current vs. proposed timezone, explaining clock time preservation, and highlighting the count of recurring slots and pending queue items that will automatically shift.

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Timezone Trigger & Step 1 Searchable Selection
- **Description**: As a page manager, I want to click the timezone display in the Posting Times header to open a clean modal where I can search and select my desired timezone.
- **Acceptance Criteria**:
  - The posting times header displays the active timezone badge with an unboxed luminous indicator and a "Change" button/action.
  - Clicking opens the `ScheduleTimezoneModal` initialized at Step 1 with the currently active timezone pre-selected.
  - Step 1 displays:
    - Current timezone with live UTC offset and current local time.
    - A search input that filters timezones by city, country, region, or IANA name in real time.
    - Grouped list of global timezones (Americas, Europe, Asia, Australia & Pacific, Africa, Global / UTC).
    - Clear selection indication on the chosen timezone row.
    - "Continue to Review" primary button (disabled when the selected timezone is identical to the current active timezone).

### User Story 2 (P1): Step 2 Impact Review & Confirmation
- **Description**: As a page manager, I want to see an impact review before saving the timezone change so I understand exactly what will happen to my recurring slots and queued posts.
- **Acceptance Criteria**:
  - Clicking "Continue to Review" advances to Step 2 within the modal.
  - Step 2 displays:
    - Side-by-side or stacked transition card: `Current: Asia/Karachi (UTC+05:00)` → `Proposed: America/New_York (UTC-04:00)`.
    - Plain-language explanation that recurring clock times remain intact (e.g., "10:00 AM will now publish at 10:00 AM New York time").
    - Impact breakdown indicating the count of configured recurring slots and pending queued items that will be automatically realigned.
    - "Back" button to return to Step 1 without losing state.
    - "Update Timezone" primary button with loading spinner state while saving.

### User Story 3 (P2): Execution, Notification & Immediate Refresh
- **Description**: As a page manager, when I confirm the update, the system should apply the change via the API, show feedback, and refresh the UI.
- **Acceptance Criteria**:
  - Invokes `PATCH /api/tenant/[subdomain]/pages/[pageId]/slots` with `{ timezone: selectedTimezone }`.
  - On success, closes the modal and displays a professional toast: `Schedule timezone updated to <Timezone> (<N> pending posts realigned).`
  - Refreshes both slots and queue tables without requiring a full page reload.
  - On error, displays a clear inline error banner inside Step 2 without closing the modal or losing the user's selection.

---

## 3. Design & Architecture Constraints
- Must strictly use design tokens from `apps/web/src/lib/theme.ts` (`THEME`, `PALETTE`, `SPACING`, `RADII`, `TYPOGRAPHY`, `EFFECTS`).
- Zero capsule pill badges; zero ad-hoc hardcoded hex values.
- Must not modify `DESIGN.md`.
- No developer jargon (zero mentions of internal database columns, UUIDs, or PostgREST).
- Keyboard accessible (Escape to close, Tab navigation, Enter to proceed).
