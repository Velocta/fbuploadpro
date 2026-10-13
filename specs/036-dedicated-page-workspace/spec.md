# Spec 036: Dedicated Facebook Page Workspace

## 1. Executive Summary & Vision
This specification defines the dedicated management workspace for an individual Facebook Page (`/tenant/[subdomain]/pages/[pageId]`). Replacing the initial placeholder card, this workspace provides operators with a full control plane: a top identity header with essential page-level actions, followed by a multi-tabbed command interface featuring **Dashboard** (default overview), **Queue** (comprehensive queue management & Publish Now), **Calendar** (recurring slot schedules), **Insights** (follower growth, video performance, reactions, demographics), and **Settings** (automation toggles, token health, and disconnect).

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Dedicated Page Header & Identity Bar
As a Facebook publisher operator,  
I want to view the page avatar, name, category, linked account, unboxed status signal, and quick header action buttons,  
So that I can identify the page immediately and perform essential controls without digging into sub-menus.

- **Scenario 1.1: Visual Page Identity**
  - **Given** the operator navigates to `/tenant/[subdomain]/pages/[pageId]`,
  - **When** the page loads,
  - **Then** the header must display the Page profile avatar (with monogram fallback), Page Name in bold display font, connected Facebook account display name, category, live Facebook Page link, and an unboxed 6px luminous status indicator dot (`active` / `paused` / `needs_attention`).

- **Scenario 1.2: Automation Toggle Button**
  - **Given** the page is currently active,
  - **When** the user clicks "Pause Automation",
  - **Then** the page automation status updates to `paused` and the button changes to "Resume Automation".

- **Scenario 1.3: Add to Queue Trigger**
  - **Given** the operator is on any tab of the dedicated page workspace,
  - **When** clicking "Add to Queue",
  - **Then** an enqueue modal opens allowing media selection from the Media Library with optional caption and automated first comment.

- **Scenario 1.4: Header Settings & Disconnect**
  - **Given** the header settings dropdown is clicked,
  - **When** selecting "Disconnect Page",
  - **Then** the confirmation dialog warns the user of page detachment, soft-deletes the page, cancels queued items, and returns the user to `/pages`.

---

### User Story 2 (P1): Default Dashboard Overview Tab
As an operator managing publishing workflows,  
I want the default tab to be a high-level operational Dashboard,  
So that I can quickly see follower growth, queue status, next scheduled post, and active publishing slots at a glance.

- **Scenario 2.1: Key Metric Cards**
  - **Given** the Dashboard tab is active,
  - **When** rendering metrics,
  - **Then** display: Total Followers & delta (`followersGained`), Next Scheduled Post time, Queued Items count, and Automation State.

- **Scenario 2.2: Upcoming Queue Snapshot**
  - **Given** posts are queued for this page,
  - **When** viewing the Dashboard,
  - **Then** display the next 2-3 upcoming posts with thumbnail, scheduled slot time, and immediate "Publish Now" button.

- **Scenario 2.3: Active Slots Snapshot**
  - **Given** recurring slots are defined for this page,
  - **When** viewing the Dashboard,
  - **Then** display today's active publishing slots and quick link to the Calendar schedule.

---

### User Story 3 (P1): Comprehensive Publishing Queue Tab
As a content operator,  
I want a dedicated Queue tab with full control over scheduled posts,  
So that I can monitor queue sequence, trigger immediate publishing, edit captions/first comments, or remove items.

- **Scenario 3.1: Queue List & Card Details**
  - **Given** the Queue tab is selected,
  - **When** items exist in the queue,
  - **Then** render each item with media thumbnail, video/image indicator, scheduled slot time, caption snippet, and first comment preview.

- **Scenario 3.2: Immediate 'Publish Now' Action**
  - **Given** a queued post,
  - **When** the operator clicks "Publish Now",
  - **Then** trigger immediate edge publishing via `POST /api/tenant/[subdomain]/publishing/queue/[itemId]/publish-now` and display feedback banner.

- **Scenario 3.3: Inline Caption & First Comment Editing**
  - **Given** a queued post,
  - **When** clicking "Edit",
  - **Then** a modal opens allowing modifications to `caption` and `firstComment`, saved via `PATCH /api/tenant/[subdomain]/publishing/queue/[itemId]`.

- **Scenario 3.4: Cancel / Remove from Queue**
  - **Given** a queued post,
  - **When** clicking "Remove",
  - **Then** confirm and delete via `DELETE /api/tenant/[subdomain]/publishing/queue/[itemId]`.

---

### User Story 4 (P2): Calendar & Slot Schedule Tab
As a scheduling manager,  
I want a Calendar tab displaying recurring publishing time slots,  
So that I can define when content goes live throughout the week.

- **Scenario 4.1: Slot List & Activation Toggles**
  - **Given** the Calendar tab is selected,
  - **When** viewing slots,
  - **Then** list all recurring slots (e.g. `09:00`, `13:00`, `18:00 UTC`) fetched from `/api/tenant/[subdomain]/pages/[pageId]/slots`.

- **Scenario 4.2: Add New Publishing Slot**
  - **Given** the operator clicks "Add Time Slot",
  - **When** specifying slot time and timezone,
  - **Then** create the slot via `POST /api/tenant/[subdomain]/pages/[pageId]/slots` and refresh the list.

- **Scenario 4.3: Delete Slot**
  - **Given** an existing slot,
  - **When** clicking delete,
  - **Then** remove the slot via `DELETE /api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]`.

---

### User Story 5 (P2): Insights & Analytics Tab
As a social media marketer,  
I want an Insights tab with follower growth, video metrics, reactions, and demographics,  
So that I can evaluate content performance for this specific page.

- **Scenario 5.1: Performance Charts**
  - **Given** the Insights tab is selected,
  - **When** data is loaded from `/api/tenant/[subdomain]/pages/[pageId]/insights`,
  - **Then** render time-series follower growth (Recharts), video views (total, unique, 30s, watch minutes), and reaction breakdowns.

- **Scenario 5.2: Range Selection**
  - **Given** the range selector (`7d`, `14d`, `28d`),
  - **When** changing the range,
  - **Then** refresh the insights data with caching.

---

### User Story 6 (P3): Page Settings Tab
As a workspace admin,  
I want a Settings tab for page-specific configurations,  
So that I can manage automation states, inspect token validity, and disconnect the page safely.

- **Scenario 6.1: Automation Master Switch**
  - **Given** the Settings tab,
  - **When** toggling the master automation switch,
  - **Then** persist the state via `PATCH /api/tenant/[subdomain]/pages/[pageId]`.

- **Scenario 6.2: Token Health Details**
  - **Given** the token status,
  - **When** expired or rate-limited,
  - **Then** present clear, professional guidance on reconnecting through Facebook Accounts.

---

## 3. Design & Architecture Standards
- **Strict Theme Authority**: Use only `@web/lib/theme` (`PALETTE`, `THEME`, `TYPOGRAPHY`, `RADII`, `SPACING`, `COMPONENT_STYLES`) and CSS variables; never declare ad-hoc styles; never edit `DESIGN.md`.
- **Unboxed Status Signals**: Status dots must use 6px luminous circles with micro-halos (`STATUS_SIGNALS`). Zero capsule/pill badges.
- **Universal Professional UX Writing**: Clean, user-centered microcopy with zero developer plumbing leaks.
