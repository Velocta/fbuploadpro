# Feature Specification: Spec 034 — Dedicated Facebook Pages Management Section, Follower Growth Tracking & Two-Step Page Import

**Feature ID**: `034-facebook-pages-section`  
**Status**: Approved  
**Created**: 2026-10-11  
**Constitution Authority**: Principle 25 (Dedicated Facebook Pages Management Section, Follower Growth Tracking (`current_followers` & `starting_followers`), Two-Step Account-to-Page Import & Dedicated Page Route)

---

## 1. Executive Summary & Problem Statement

Operators managing social media publishing need a dedicated **Facebook Pages** section positioned directly below **Accounts** in the collapsible **Facebook** sidebar menu (`/pages` $\rightarrow$ `/tenant/[subdomain]/pages`). Currently, only the Facebook Accounts view is wired in the sidebar, and `facebook_pages` stores only a single `followers_count` column without tracking the baseline starting followers when a Page was added to the workspace.

Spec 034 delivers:
1. **Sidebar Navigation & Tenant Subdomain Routing**: Adds **Pages** directly below **Accounts** inside the collapsible **Facebook** menu in `WorkspaceSidebar`, with full middleware support for `/pages` and `/pages/[pageId]`.
2. **Follower Growth Schema (`current_followers` & `starting_followers`)**: Renames `facebook_pages.followers_count` to `current_followers`, adds `starting_followers`, and computes signed `followersGained = currentFollowers - startingFollowers` (handling positive, zero, and negative growth when `currentFollowers < startingFollowers`).
3. **Clean, Clickable Page Cards with Attention Standout (`PageCard`)**: Displays Page avatar (with monogram fallback), Page name, category, **Current Followers**, **Followers Gained** (showing negative values in rose red when current followers drop below starting followers), **Parent Facebook Account** name, and **Status**. Pages needing attention (`invalid_token`, `page_checkpoint`, `fb_rate_limited`) are pinned to the top of the grid and highlighted with a red/rose border and callout banner. All page-level management actions are reserved for the dedicated Page view opened when clicking a card.
4. **Two-Step "Add Page" Modal (`AddPageModal`)**: Clicking **Add Page** opens a modal where the user first selects a connected Facebook Account (Step 1) and then multi-selects from its discovered Facebook Pages with checkboxes, **Select All**, and **Already added** indicators (Step 2).
5. **Dedicated Page Placeholder View (`/tenant/[subdomain]/pages/[pageId]`)**: Clicking any Page card opens its dedicated Page route, rendered as a clean placeholder view ready for full Page management in the next milestone.
6. **Soft-Delete Page Disconnection**: Updates `DELETE /api/tenant/[subdomain]/pages/[pageId]` to soft-delete (`status = 'disconnected'`, wiping the encrypted token and canceling queued items while preserving historical logs and insights).

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1: Sidebar Navigation & Viewing Facebook Pages Grid (Priority: P1)
**As a** workspace operator,  
**When** I look under **Facebook** in the sidebar below **Accounts** and click **Pages**,  
**Then** I navigate to `/tenant/[subdomain]/pages` and see a responsive grid of my imported Facebook Pages (or a clean empty state with an **Add Page** button if 0 pages are linked).

**Acceptance Criteria**:
1. `WorkspaceSidebar` renders a `Pages` sub-item directly below `Accounts` inside the collapsible `Facebook` group, active on both `/tenant/[subdomain]/pages` and `/tenant/[subdomain]/pages/[pageId]`.
2. Each `PageCard` is a clean, clickable card linking to `/tenant/[subdomain]/pages/[pageId]` and displays:
   - `48px` Page avatar (`profilePictureUrl`) with automatic `onError` fallback to monogram initials.
   - Page name (`pageName`) and category (`category`).
   - **Current followers** (`currentFollowers`) formatted with locale separators.
   - **Followers gained** (`followersGained = currentFollowers - startingFollowers`), showing `+N` in emerald when positive, `0` when unchanged, and `-N` in rose red when `currentFollowers < startingFollowers`.
   - Parent Facebook Account name (`accountDisplayName`).
   - Page status (`Active`, `Paused`, `Rate Limited`, `Identity Checkpoint`, `Token Expired`), with red/rose border and prominent callout styling when attention is required (`invalid_token`, `page_checkpoint`, `fb_rate_limited`).
3. Attention-needed pages (`invalid_token`, `page_checkpoint`, `fb_rate_limited`) are automatically pinned to the top of the grid.
4. No management action buttons (such as disconnect or toggle switches) clutter the grid cards; clicking a card navigates to `/tenant/[subdomain]/pages/[pageId]`.

---

### User Story 2: Adding Pages via Two-Step Account-to-Page Modal (Priority: P1)
**As a** workspace operator clicking **Add Page**,  
**When** the modal opens,  
**Then** I first select one of my connected Facebook Accounts (Step 1), and then select one or multiple Facebook Pages from that account to add to my workspace (Step 2).

**Acceptance Criteria**:
1. Step 1 lists connected active Facebook accounts (`status === 'active'`). If 0 active accounts exist, the modal shows a clear prompt and button to navigate to `/tenant/[subdomain]/accounts`.
2. Selecting a Facebook account transitions to Step 2 and fetches `GET /api/tenant/[subdomain]/accounts/[accountId]/pages/discover`.
3. Step 2 displays discovered pages with avatar, page name, category, and current followers count.
4. Unimported pages can be toggled individually via checkboxes or all at once via **Select All**; pages already active in the workspace are marked **Already added** and disabled from duplicate selection.
5. Clicking **Add Selected Pages** calls `POST /api/tenant/[subdomain]/pages/import`, sets both `starting_followers` and `current_followers` to the discovered follower count on initial import, closes the modal, and refreshes the `/pages` grid with a confirmation notice.

---

### User Story 3: Dedicated Page View Placeholder & Scale Filtering (Priority: P2)
**As a** workspace operator with multiple Facebook Pages,  
**When** I click a Page card or manage more than 4 Pages,  
**Then** clicking a card opens `/tenant/[subdomain]/pages/[pageId]`, and having `> 4` Pages reveals search, status filter tabs, and an account filter on `/tenant/[subdomain]/pages`.

**Acceptance Criteria**:
1. Clicking a `PageCard` navigates to `/tenant/[subdomain]/pages/[pageId]`, which renders a clean placeholder view with a **Back to Pages** link and Page header.
2. When `pages.length > 4`, `/tenant/[subdomain]/pages` renders:
   - Search input filtering by `pageName` or `category`.
   - Status filter tabs (`All`, `Active`, `Needs Attention`, `Paused`).
   - Parent Facebook Account filter dropdown (`All accounts` + connected account names).
3. Calling `DELETE /api/tenant/[subdomain]/pages/[pageId]` performs a soft-delete (`status = 'disconnected'`, `encrypted_access_token = ''`, canceling pending `'queued'` items in `queue_items`), and `GET /api/tenant/[subdomain]/pages` excludes `'disconnected'` pages.

---

## 3. Functional Requirements

- **FR-001**: Forward SQL migration `supabase/migrations/20261011180000_facebook_pages_followers_tracking.sql` renaming `facebook_pages.followers_count` to `current_followers` and adding `starting_followers INT NOT NULL DEFAULT 0 CHECK (starting_followers >= 0)` (backfilled from `current_followers`).
- **FR-002**: Update `@fbuploadpro/contracts` (`FacebookPageSchema`, `FacebookPageViewSchema`, `DiscoveredPageSchema`) to support `currentFollowers`, `startingFollowers`, and signed `followersGained` (`currentFollowers - startingFollowers`).
- **FR-003**: Update `GET /api/tenant/[subdomain]/pages` to exclude `status = 'disconnected'` and return `currentFollowers`, `startingFollowers`, and `followersGained = currentFollowers - startingFollowers`.
- **FR-004**: Update `POST /api/tenant/[subdomain]/pages/import` to persist `starting_followers` and `current_followers` on insert, preserve `starting_followers` on conflict when updating an active page (resetting `starting_followers` only if the existing row had `status = 'disconnected'`), and update `current_followers`.
- **FR-005**: Update `DELETE /api/tenant/[subdomain]/pages/[pageId]` to soft-delete (`status = 'disconnected'`, `encrypted_access_token = ''`) and cancel pending `'queued'` items for that page.
- **FR-006**: Add `Pages` under `Facebook` below `Accounts` in `apps/web/src/components/workspace/workspace-sidebar.tsx`.
- **FR-007**: Build `PageCard`, `PagesEmptyState`, and `AddPageModal` in `apps/web/src/components/pages/`, and routes `/tenant/[subdomain]/pages/page.tsx` and `/tenant/[subdomain]/pages/[pageId]/page.tsx`.
- **FR-008**: Strictly adhere to `apps/web/src/lib/theme.ts` and `DESIGN.md` (zero ad-hoc hex colors, zero capsule pill badges, zero modifications to `DESIGN.md`).

---

## 4. Success Criteria

- **SC-001**: Operators can navigate to **Facebook -> Pages** in 1 click from the workspace sidebar and add pages via the 2-step Account $\rightarrow$ Page modal.
- **SC-002**: Positive, zero, and negative follower deltas (`currentFollowers - startingFollowers`) are accurately calculated and displayed on every Page card.
- **SC-003**: Attention-needed Pages (`invalid_token`, `page_checkpoint`, `fb_rate_limited`) are pinned to the top and highlighted in red/rose (`PALETTE.rose`).
- **SC-004**: 100% of unit, API, contract, database, and UI tests pass under `pnpm turbo run build lint typecheck test`.
