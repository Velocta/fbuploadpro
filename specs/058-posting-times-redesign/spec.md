# Feature Specification: Spec 058 Facebook Page Posting Times Redesign

**Feature Branch**: `feat/058-posting-times-redesign`  
**Created**: 2026-10-16  
**Status**: Ready for Implementation  
**Input**: User directive: "remove that section entirely and create a new named posting times and design it like a professional UI UX not a power tool or management page our users like professional sleek and calm experience not eye sooring tons of buttons and things to configure. Option A: Minimalist Editorial Ledger"

---

## 1. Vision & Executive Summary

The legacy "Calendar & Slots" view suffered from "power tool" bloat: an overwhelming grid of bordered cards, noisy format pills, prominent red delete icons, a redundant 7-day box-in-a-box "Weekly Schedule Preview" showing repetitive "None" labels, and dense database configuration controls.

Spec 058 entirely replaces this legacy section with **Posting Times** following **Option A: Minimalist Editorial Ledger (Linear / Raycast Style)**. The redesign delivers a serene, calm, and typography-forward publishing cadence experience. It lets creators and brands establish their daily posting tempo with clean typography, unboxed luminous status dots, smooth active/pause switches, quiet inline actions, and 1-click time presets.

---

## 2. User Scenarios & Testing

### User Story 1 - Serene Editorial Ledger View (Priority: P1)
As a creator managing a Facebook Page, I want to open the dedicated "Posting Times" tab and immediately see my daily publishing schedule in a clean, calm, typography-first list without visual noise, box-in-a-box borders, or eye-sore management controls.

**Why this priority**: Core primary view for viewing and establishing recurring automated publishing cadence.

**Independent Test**: Navigate to `/tenant/[subdomain]/pages/[pageId]`, click the "Posting Times" tab, and verify that posting times render in a clean, uncluttered editorial ledger with zero bullet dots (`•`) and zero capsule pill badges.

**Acceptance Scenarios**:
1. **Given** a connected Facebook Page with active slots, **When** the user clicks "Posting Times", **Then** the page renders the title "Posting Times", an explanatory human subtitle, a unified timezone indicator, and the direct list of daily posting times.
2. **Given** a posting time row, **When** viewed on screen, **Then** it displays an unboxed luminous 6px status dot (`#2ebd85` active, `#484f58` paused), bold tabular time typography with AM/PM indicator, a subtle cadence label (`Every day`), an active/pause switch, and a quiet hover-only "Remove" action.
3. **Given** the rendered HTML, **When** inspected, **Then** there are strictly ZERO bullet point dots (`•`) and ZERO capsule pill badges.

---

### User Story 2 - Instant Toggle & Quiet Inline Removal (Priority: P2)
As a user, I want to pause or resume individual daily posting times with a single click, or remove obsolete times cleanly without harsh confirmation modals interrupting my workflow.

**Why this priority**: High-frequency operational adjustments must feel effortless, instant, and calm.

**Independent Test**: Toggle a posting time from active to paused and verify that the status dot transitions to inactive and the API persists the change without full-page reloads.

**Acceptance Scenarios**:
1. **Given** an active posting time, **When** the user toggles the switch, **Then** the switch animates to the off state, the status dot transitions to idle/paused, and `onToggleSlot` is called.
2. **Given** a posting time, **When** the user clicks "Remove", **Then** a calm confirmation prompt appears, and confirming invokes `onDeleteSlot`.

---

### User Story 3 - Permitted Content Format Selection & Setup (Priority: P3)
As a creator or brand manager, I want to configure which content formats (Reels, Photos, Videos, Stories, Text Updates) are permitted to post at each specific time of day, so that video content only dispatches during peak video consumption hours and image posts stay in their designated slots.

**Why this priority**: Preserves critical queue orchestration and format filtering so users have granular control over what gets published when, without cluttering the screen.

**Independent Test**: Open Add/Edit Posting Time modal, toggle individual format buttons (e.g. disable Text and Stories, leaving Reels and Photos), save, and verify that the row reflects the permitted formats.

**Acceptance Scenarios**:
1. **Given** an existing or new posting time, **When** the user clicks "Edit Formats" or "+ Add Posting Time", **Then** the modal presents interactive multi-select format buttons (`Reels`, `Photos`, `Videos`, `Stories`, `Text Updates`) with a "Select All" shortcut.
2. **Given** a posting time row in the ledger, **When** rendered, **Then** it clearly displays permitted format tags (e.g. `Reels`, `Photos` or `All Formats Allowed`) and an inline "Edit Formats" button.
3. **Given** all user-visible copy, **When** reviewed, **Then** all copy follows executive SaaS standards with zero developer plumbing, zero internal database jargon, and zero cheesy colloquialisms.

---

## 3. Requirements

### Functional Requirements
- **FR-001**: Tab navigation bar in `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx` MUST display the tab label as **Posting Times** instead of "Calendar & Slots".
- **FR-002**: The component `apps/web/src/components/pages/dedicated/tab-calendar.tsx` MUST be replaced/refactored into `PageTabPostingTimes` (or `tab-posting-times.tsx`), exporting `PageTabPostingTimes` with backwards-compatible alias `PageTabCalendar`.
- **FR-003**: The view MUST display a unified timezone header showing the page's active timezone (e.g., `America/New_York (EST)`).
- **FR-004**: Each posting time row MUST display:
  - Luminous 6px status dot (`#2ebd85` active, `#484f58` paused).
  - Tabular typography for time (e.g., `09:00` with `AM`/`PM` label and 24h tag).
  - Permitted format tags (`Reels`, `Photos`, `Videos`, `Stories`, `Text Updates` or `All Formats Allowed`).
  - Tactile switch toggle for active/pause.
  - "Edit Formats" action button.
  - Quiet hover affordance to remove with a gentle confirmation modal.
- **FR-005**: Permitted Content Format Selection (`allowed_formats`) MUST be fully supported in Add/Edit modal with multi-select buttons and Select All shortcut.
- **FR-006**: When no posting times are configured, the empty state MUST display a serene, encouraging message with 1-click setup actions rather than a harsh error box.
- **FR-007**: All styling MUST strictly reference `@/lib/theme` design tokens.
- **FR-008**: STRICT NEGATIVE CONSTRAINT: Zero bullet point dots (`•`) permitted anywhere in the component.
- **FR-009**: STRICT NEGATIVE CONSTRAINT: Zero capsule pill badges permitted anywhere in the component.

---

## 4. Edge Cases
- **Page with no posting times**: Clean, inviting empty state offering 1-click setup.
- **Duplicate times**: Gracefully prevented by validating existing slot times before submission.
- **Invalid time format**: Clean inline feedback if custom time string is invalid.
- **Timezone conversion**: Accurately formats 24h slot times into 12h/24h displays with proper AM/PM tags.
