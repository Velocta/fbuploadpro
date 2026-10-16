# Feature Specification: Facebook Page Detail Top Section & Action Buttons Redesign

**Feature Branch**: `feat/056-page-detail-top-section`  
**Created**: 2026-10-16  
**Status**: Specified  
**Input**: User description: "Redesign Facebook Page Detail Top Section and Action Buttons using Option A (Mirror Studio) without bullet point dots, sleek professional pure UX matching pages section"

---

## 1. Executive Summary & Context

The Facebook Page Detail section (`/tenant/[subdomain]/pages/[pageId]`) is the operational command center for managing individual Facebook Pages. Currently, its header and action buttons suffer from visual clunkiness, redundant back links, inconsistent button heights, and legacy styling that contrasts with the minimalist, pitch-black dark mode established in the main Facebook Pages directory (`/tenant/[subdomain]/pages`).

This specification defines the redesign of the **Page Detail Top Section, Action Buttons, and Tab Navigation Bar** following **Option A (The Mirror Studio Header)** with strict adherence to:
1. **Zero Bullet Point Dots**: Metadata elements in the subtitle are separated exclusively by clean typographic spacing and subtle 12px vertical hairline dividers—never bullet dots (`•`).
2. **Visual Consistency with `/pages`**: Matching typography, 44x44px avatar with status-colored ring borders, 34px uniform button heights, and flat typographic underline tabs with 2px brand yellow indicator.
3. **Pure UX & Zero Jargon**: No backend plumbing leaks, schema identifiers, or technical jargon. User-facing status and metadata are clear, calm, and actionable.

---

## 2. User Scenarios & Testing

### User Story 1 - Page Identity & Situational Header (Priority: P1)

As a creator or social media manager viewing a specific Facebook Page, I want a clean, calm, and informative header that displays the page name, avatar, operational status, and connected parent account so that I instantly know the current state of my publishing channel without visual noise.

**Why this priority**: The header is the visual anchor for the entire page detail view. It establishes context and confidence immediately upon page load.

**Independent Test**: Load `/tenant/[subdomain]/pages/[pageId]` and verify that the page avatar has a 1.5px status ring, title is crisp with Facebook external link, and the subtitle displays status, connected account, and followers separated by hairline dividers without any bullet dots (`•`).

**Acceptance Scenarios**:
1. **Given** a connected Facebook Page with active automation, **When** the page detail view loads, **Then** an unboxed 6px luminous green dot with micro-halo is displayed with label "Active", followed by a subtle 12px vertical hairline divider, the parent account name ("Connected via [Name]"), a hairline divider, and the follower count. Zero bullet dots (`•`) are present.
2. **Given** a page with paused automation, **When** viewed, **Then** the avatar ring is amber (`#fad734`), the luminous status dot is amber, and the status label reads "Paused".
3. **Given** the user clicks "Facebook Pages" back link above the header, **Then** the user is navigated back to `/tenant/[subdomain]/pages`.

---

### User Story 2 - Uniform Action Button Cluster (Priority: P1)

As a workspace user, I want quick, accessible controls to pause/resume automation, queue a post, and perform secondary page operations with uniform button heights and consistent interaction feedback.

**Why this priority**: Users frequently toggle automation states and add posts to the queue. These actions must be prominent, reliable, and ergonomically styled at the standard 34px height.

**Independent Test**: Interact with the "Pause/Resume Automation" button, "+ Queue Post" button, and "···" menu dropdown; verify state changes, modal triggers, and correct styling.

**Acceptance Scenarios**:
1. **Given** an active page, **When** the user clicks "Pause Automation" (34px height, secondary style), **Then** automation is paused via API, the button label updates to "Resume Automation", and the status indicators transition to amber.
2. **Given** any page state, **When** the user clicks "+ Queue Post" (34px height, primary `#fad734` background), **Then** the Enqueue Modal opens.
3. **Given** the user clicks the "···" (More options) button, **Then** a dropdown appears displaying "Sync Page Data", "Copy Page ID", "Open on Facebook", and "Disconnect Page" (styled in red).

---

### User Story 3 - Flat Typographic Tab Navigation (Priority: P2)

As a user navigating between page modules (Dashboard, Queue, Calendar, Insights, Settings), I want a flat typographic tab bar that mirrors the filter tabs in the main Pages directory.

**Why this priority**: Seamless navigation between tabs requires clear active indicators and numeric badges without pill bloat.

**Independent Test**: Click through each tab (Dashboard, Queue, Calendar, Insights, Settings) and verify active underline states and correct tab content rendering.

**Acceptance Scenarios**:
1. **Given** the user is on the page detail view, **When** viewing the tab bar, **Then** tabs are rendered as flat typographic labels; the active tab has a 2px solid `#fad734` bottom underline with `var(--text-main)` color.
2. **Given** items exist in the queue, **Then** the Queue tab shows a subtle numerical count chip (e.g., `Queue [4]`) styled with a hairline border without capsule pills.

---

### User Story 4 - Checkpoint Verification Alert Banner (Priority: P2)

As a user whose page has encountered a Facebook security checkpoint, I want an alert banner explaining what happened in plain language with a direct reactivation action.

**Why this priority**: Checkpoints halt publishing; users need clear, non-technical guidance on how to resume automation.

**Independent Test**: Simulate or view a page in `page_checkpoint` status and verify the warning banner appears with instructions and a working "Verify & Reactivate" button.

**Acceptance Scenarios**:
1. **Given** a page with status `page_checkpoint`, **When** the page detail view loads, **Then** a high-contrast amber banner displays explaining that verification is required in Facebook, accompanied by a "Verify & Reactivate" button.
2. **Given** the user completes verification and clicks "Verify & Reactivate", **Then** the status updates to active, the banner dismisses, and normal automation resumes.

---

## 3. Requirements

### Functional Requirements

- **FR-001**: System MUST provide a quiet back link reading `← Facebook Pages` above the page header that navigates to `/tenant/[subdomain]/pages`.
- **FR-002**: System MUST display a 44x44px Page Avatar with rounded corners (`RADII.md`) and a 1.5px status-colored border matching `PageCard`:
  - Active: `#10b981` (emerald)
  - Paused: `#fad734` (yellow)
  - Attention/Checkpoint: `#ef4444` (crimson)
- **FR-003**: System MUST display the Page Title in bold 1.5rem (`24px`) with an external link icon opening `https://facebook.com/{pageId}` in a new tab.
- **FR-004**: System MUST render an unboxed 6px luminous dot with micro-halo (`STATUS_SIGNALS`) representing live status.
- **FR-005**: System MUST NOT use any bullet point dots (`•`) in the subtitle metadata. All metadata items MUST be separated by subtle 12px vertical hairline dividers (`border-subtle`).
- **FR-006**: Subtitle metadata MUST display:
  1. Live status label ("Active", "Paused", "Needs Attention")
  2. Hairline divider
  3. Parent account ("Connected via [DisplayName]")
  4. Hairline divider
  5. Follower count formatted (e.g., "14,200 followers")
- **FR-007**: System MUST provide a uniform 34px height action button cluster on the right side:
  - `Pause / Resume Automation`: Secondary ghost button (`#121419` surface / `#1f242d` border), with pause icon `⏸` when active, or amber play icon `▶` when paused.
  - `+ Queue Post`: Primary action button (`#fad734` background, `#000000` text, font-semibold, plus icon).
  - `···` More Options: 34x34px icon button opening dropdown with Sync Data, Copy Page ID, Open on Facebook, and Disconnect Page.
- **FR-008**: System MUST render the tab bar using flat typographic tabs with a 2px solid `#fad734` bottom border for the active tab, and a quiet numeric chip for queued posts count.
- **FR-009**: When `page.status === 'page_checkpoint'`, system MUST display a prominent amber checkpoint banner with clear plain-language instructions and a "Verify & Reactivate" button.

### Non-Functional & Design Requirements

- **NFR-001**: Strict compliance with Pitch Black Dark Mode tokens (`#000000` canvas, `#0c0d10` panel, `#121419` subtle, `#1f242d` hairline borders).
- **NFR-002**: Zero capsule pill badges anywhere in the header or tab bar.
- **NFR-003**: Zero technical jargon or internal database schema leaks in copy.
- **NFR-004**: Backwards compatibility with existing data-testid attributes for automated test suites.

---

## 4. Edge Cases

- **Page without account display name**: Subtitle gracefully skips the account section without leaving double hairline dividers.
- **Page with zero or negative followers gained**: Follower count displays cleanly without breaking formatting.
- **Long page names**: Title truncates with ellipsis if screen width is constrained, preserving action buttons.
- **Network failure on status toggle**: Reverts local optimistic state and shows a clear error toast.
- **Dropdown click outside**: Dropdown closes automatically when clicking outside or pressing Escape.
