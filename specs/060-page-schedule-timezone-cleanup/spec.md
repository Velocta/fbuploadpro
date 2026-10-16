# Feature Specification: Spec 060 - Page Schedule Timezone & Posting Times Cleanup

## 1. Executive Summary
During user evaluation of the redesigned Posting Times tab (Spec 058), two critical UX issues were identified:
1. **Redundant Bottom Action**: An unnecessary `+ Add another posting time` button was placed at the bottom of the slots ledger, duplicating the primary `+ Add Posting Time` action in the top header.
2. **Coupled Per-Slot Timezone Selection**: Timezone was incorrectly configured on an individual slot basis inside the Add/Edit modal. In a Facebook page publishing schedule, timezone is an invariant page-level schedule setting. If an operator sets their schedule timezone to New York (`America/New_York`) and adds posting times (e.g., `10:00 AM`, `12:00 PM`), and subsequently switches the schedule timezone to Pakistan (`Asia/Karachi`), the daily posting times must remain `10:00 AM` and `12:00 PM`, while their execution timezone is updated.

This specification decouples timezone selection from individual slots into an interactive page-level schedule timezone selector in the header, purges the timezone dropdown from the slot creation/editing modal, removes the redundant bottom button, and introduces atomic batch timezone synchronization across all existing page slots without modifying their clock times.

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Single Authoritative Add Action
**As a** page operator,  
**I want** a single clear, prominent `+ Add Posting Time` button in the header,  
**So that** the interface remains calm, uncluttered, and free of redundant duplicate buttons.

- **Acceptance Criteria 1.1**: The bottom `+ Add another posting time` button is completely removed from the ledger container.
- **Acceptance Criteria 1.2**: The primary header button `+ Add Posting Time` remains the sole entry point for opening the creation modal when slots exist.
- **Acceptance Criteria 1.3**: When zero slots exist, the calm empty state `+ Add Posting Time` button serves as the initial creation entry point.

---

### User Story 2 (P1): Page-Level Schedule Timezone Decoupling
**As a** social media manager managing international audiences,  
**I want** to select my page's posting timezone globally at the schedule level,  
**So that** changing timezones adjusts the dispatch timezone for all times without changing the time-of-day clock values.

- **Acceptance Criteria 2.1**: The static timezone badge in `PostingTimesHeader` is replaced with an interactive schedule timezone selector.
- **Acceptance Criteria 2.2**: Changing the schedule timezone (e.g., from `America/New_York` to `Asia/Karachi`) preserves all slot times (e.g. `10:00 AM` stays `10:00 AM`, `12:00 PM` stays `12:00 PM`), but updates their active timezone to `Asia/Karachi`.
- **Acceptance Criteria 2.3**: Supported common timezones explicitly include `Asia/Karachi`, `America/New_York`, `UTC`, `Asia/Dubai`, `Asia/Singapore`, `Asia/Tokyo`, `Europe/London`, `Europe/Paris`, `Europe/Berlin`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`, and `Australia/Sydney`.
- **Acceptance Criteria 2.4**: Changing the timezone calls `PATCH /api/tenant/[subdomain]/pages/[pageId]/slots` with `{ timezone }`, updating all slots for the page and user atomically.

---

### User Story 3 (P1): Streamlined Add/Edit Slot Modal
**As a** content creator,  
**I want** the Add/Edit Posting Time modal to only ask for the time of day and permitted formats,  
**So that** I can add publishing times in seconds without repetitive timezone configuration.

- **Acceptance Criteria 3.1**: The Timezone `<select>` dropdown and label are removed from `AddEditPostingTimeModal`.
- **Acceptance Criteria 3.2**: The modal displays a subtle helper note indicating the active schedule timezone (e.g., "Active schedule timezone: Asia/Karachi").
- **Acceptance Criteria 3.3**: The modal collects only `Time of Day (24-Hour)` (`posting-time-input`) and `Permitted Content Formats` (`modal-format-selection-group`).
- **Acceptance Criteria 3.4**: When saved, the new or updated slot automatically inherits the page's active schedule timezone.

---

## 3. Strict Quality & Anti-Slop Constraints
- **Zero Bullet Dots**: Strictly 0 instances of bullet point characters (`•`) anywhere in copy or markup.
- **Zero Capsule Pill Badges**: Strictly 0 capsule pill badges.
- **Design System Tokens**: Strictly use theme tokens from `@/lib/theme` (`THEME`, `PALETTE`, `SPACING`, `RADII`, `TYPOGRAPHY`).
- **Accessibility & SonarQube**: Semantic `<fieldset>` and `<legend>` for format options, explicit `htmlFor` on all form labels, zero nested ternaries.
