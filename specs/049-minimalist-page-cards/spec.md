# Feature Specification: Minimalist Standout Facebook Page Cards (Spec 049)

**Branch**: `feat/049-minimalist-page-cards`  
**Status**: In Progress  
**Category**: Frontend UX & Design Craft  
**Scope**: `apps/web/src/components/pages/page-card.tsx`

---

## 1. Problem Statement
The current Facebook Page Card (`apps/web/src/components/pages/page-card.tsx`) relies on a heavy, outdated "box-inside-a-box" layout with nested gray rectangles (`var(--bg-subtle)` container), rigid divider lines, and a cluttered status dot (`● Active`). This visual structure makes the page grid look generic, crowded, and uninspiring.

The user explicitly requested:
1. An ultra-minimalist, high-craft standout card based on **Direction 2 (The Precision Editorial)**.
2. Complete removal of the bullet dot before status (`● Active`).
3. Expressing status through **Option 1 (Pure Typographic Styling in status color)** combined with **Option 2 (Avatar Status Ring matching entity health)** across all status types (`active`, `paused`, `invalid_token`, `page_checkpoint`, `fb_rate_limited`, `disconnected`).
4. Eliminating the nested container box while keeping clean tabular metrics and necessary attention alerts.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Precision Editorial Layout (P1)
**As a** content creator or agency managing Facebook pages,  
**I want** a clean, uncluttered, beautifully balanced page card with generous negative space,  
**So that** I can scan my connected pages with ease and quiet confidence.

- **Acceptance Criteria**:
  - The card surface is a single, unified `#121722` panel (`var(--bg-panel)`) with a crisp hairline border (`var(--border-subtle)`).
  - The nested gray metric container (`gridTemplateColumns: '1fr 1fr'`) is removed.
  - Follower stats are rendered cleanly in two symmetrical columns:
    - Left column: Current follower count (`11,200 followers`) and net gain (`+1,200 net gain`).
    - Right column: Status label (`Active`, `Paused`, etc.) and parent account (`Account: Sarah Connor`).
  - Top row features the Page Avatar, Page Name, Category, and an interactive top-right affordance arrow glyph (`↗`).
  - Smooth hover micro-interaction: subtle `-2px` translateY lift, hairline border highlight, and arrow glyph shift.

### User Story 2: Pure Typographic Status & Dynamic Avatar Status Ring (P1)
**As a** user viewing page statuses,  
**I want** status to be clearly visible without annoying bullet dots or clunky badges,  
**So that** the interface feels modern, sleek, and high-end.

- **Acceptance Criteria**:
  - The bullet dot (`COMPONENT_STYLES.statusDot` / `●`) is completely removed from the card status indicator.
  - Status is displayed purely as styled text (`Active`, `Paused`, `Token Expired`, etc.) in its designated status color:
    - `active`: Emerald (`#2EBD85`, `PALETTE.accent4`).
    - `paused`: Amber (`#F0B90B`, `PALETTE.primary`).
    - `invalid_token`, `page_checkpoint`, `fb_rate_limited`: Rose (`#F6465D`, `PALETTE.accent3`).
    - `disconnected`: Muted (`var(--text-dim)`).
  - The page avatar (or fallback initials circle) renders a 1.5px status ring/border matching the active state:
    - `active`: 1.5px emerald ring (`rgba(46, 189, 133, 0.6)` or `#2EBD85`).
    - `paused`: 1.5px amber ring (`#F0B90B`).
    - `invalid_token`, `page_checkpoint`, `fb_rate_limited`: 1.5px rose ring (`#F6465D`).
    - `disconnected`: 1px subtle hairline border (`var(--border-subtle)`).

### User Story 3: Backward Compatibility & Test Suite Integrity (P1)
**As an** engineer maintaining the test suite,  
**I want** all existing `data-testid` attributes and semantic assertions to remain intact,  
**So that** no regressions occur in existing UI unit tests.

- **Acceptance Criteria**:
  - Preserves `data-testid="page-card-${page.id}"`, `page-avatar-img`, `page-avatar-initials`, `page-name`, `page-category`, `page-current-followers`, `page-followers-gained`, `page-parent-account`, `page-status`, and `page-attention-banner`.
  - Attention banners continue to render for `invalid_token`, `page_checkpoint`, and `fb_rate_limited` with rose border.
  - Full keyboard accessibility (`Enter`, `Space`) and click navigation preserved.

---

## 3. Non-Functional Requirements
- **Theme Conformance**: Strictly use tokens from `@/lib/theme` (`THEME.default`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`).
- **No Pill Badges**: Zero capsule pill badges or decorative tags.
- **Tabular Numbers**: Numbers formatted with `fontVariantNumeric: 'tabular-nums'`.
