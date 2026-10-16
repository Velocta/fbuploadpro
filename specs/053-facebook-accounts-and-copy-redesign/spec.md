# Spec 053: Facebook Accounts Section Redesign, Open Connection Dialog & Professional SaaS Copy

## 1. Executive Summary
This specification addresses UI consistency, visual clutter, modal layout hierarchy, and copy professionalization across Facebook Accounts and Workspace management:
1. **Accounts Top Section Alignment**: Replaces the legacy Accounts filter bar with the canonical top section and scale toolbar established in Facebook Pages (`apps/web/src/app/tenant/[subdomain]/pages/page.tsx`). Includes dynamic situational subtitle, primary `+ Connect Account` action, inset magnifying glass search with clear affordance, and pure typographic flat filter tabs with luminous gold active underline indicators.
2. **Sleek, Uncluttered Account Cards (`AccountCard`)**: Eliminates visual clutter by removing `"Token valid for X days"` and raw Facebook gender display. Implements 42px avatars with subtle 1.5px status rings (emerald `#2ebd85`, gold `#fad734`, rose `#f6465d`), a blended `[ X pages linked ↗ ]` button that deep-links directly to the pre-filtered Facebook Pages view (`/tenant/[subdomain]/pages?account=...`), and a refined ghost disconnect action.
3. **Open Flat Connection Dialog (`ConnectAccountModal`)**: Eradicates the nested "box-in-a-box" pattern in favor of an open, breathable midnight slate surface (`#12151c`). Provides clear plain-English copy distinguishing "This Browser" from "Different Browser or Phone" so non-technical users immediately understand both options without technical friction.
4. **Professional Workspace Modal Copy (`CreateWorkspaceModal`)**: Removes all technical plumbing and infrastructure leaks (strictly zero mentions of "subdomain"). Replaces copy with clear, business-focused language centered on team organization, brands, and client projects.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Unified Accounts Top Section & Scale Toolbar (P1)
**As a** workspace user managing Facebook accounts,  
**I want** the Facebook Accounts page header and controls to look and feel identical to the Facebook Pages section,  
**So that** navigation and filtering feel unified, predictable, and professional.

- **Acceptance Criteria**:
  - Page header displays "Facebook Accounts" with situational subtitle generated via `computeAccountsSubtitle`:
    - 0 accounts: `"Connect your first Facebook account to manage pages and publish reels."`
    - Filtered: `"Showing {filtered} of {total} accounts"`
    - Attention required: `"{total} connected {accounts} · {attention} requires reconnecting"`
    - All operational: `"{total} connected {accounts} · All operational"`
  - Primary header action: `+ Connect Account` button styled with `PALETTE.primary` and subtle hover elevation.
  - Scale toolbar contains:
    - Ghost search input with inset magnifying glass icon, keyboard Escape handler, and `×` clear affordance (`data-testid="accounts-search-input"`).
    - Pure typographic flat filter tabs (`All`, `Active`, `Needs Attention` / `Expiring Soon`, `Expired`) with gold underline indicator (`borderBottom: 2px solid ${PALETTE.primary}`).

### User Story 2: Sleek, Uncluttered Account Cards (P1)
**As a** creator or social media manager,  
**I want** account cards to present essential identity and health signals without noisy token countdowns or irrelevant metadata,  
**So that** my dashboard remains calm, sleek, and focused.

- **Acceptance Criteria**:
  - Remove `"Token valid for X days"` alert text from cards per explicit user direction.
  - Remove raw gender display (`• Male/Female`) from cards.
  - Avatar is 42px with a 1.5px status ring:
    - Active: `1.5px solid #2ebd85` (emerald)
    - Expiring soon: `1.5px solid #fad734` (gold)
    - Expired: `1.5px solid #f6465d` (rose)
  - Blended Linked Pages Button: Transparent, harmonious button (`[ X pages linked ↗ ]`) blended into the card surface that navigates to `/tenant/[subdomain]/pages?account=${encodeURIComponent(account.displayName)}`.
  - Disconnect button: Blended ghost button (`data-testid="account-disconnect-button"`).
  - Reconnect button: Minimal gold button (`data-testid="account-reconnect-button"`) displayed exclusively when `account.status === 'expired'` or expiring soon.

### User Story 3: Open Flat Connection Dialog with Plain-English Copy (P1)
**As an** everyday business user,  
**I want** connecting my Facebook account to be intuitive and open without confusing nested boxes or technical jargon,  
**So that** I immediately know whether to connect in this browser or use a link for another browser or mobile device.

- **Acceptance Criteria**:
  - Eliminate the nested "box-in-a-box" card structure in `ConnectAccountModal`.
  - Option 1 ("This Browser"): Clearly explains to click if the user is already signed into Facebook in this browser window.
  - Option 2 ("Different Browser or Phone"): Clearly explains to choose this if Facebook is open in another browser, private window, or on mobile.
  - Magic Link view: Clean, professional instructions explaining to copy the link into the browser where Facebook is logged in, with clear assurance that this window will automatically detect completion and update.
  - All test IDs (`connect-option-direct`, `connect-option-magic`, `magic-url-input`, `magic-copy-button`, `magic-countdown`, `magic-pulse-indicator`, `connect-close-btn`) preserved.

### User Story 4: Professional Workspace Creation Copy (P1)
**As a** business user creating a workspace,  
**I want** simple, professional instructions that explain what a workspace is without confusing me with technical concepts like "subdomain",  
**So that** I can confidently set up my organization.

- **Acceptance Criteria**:
  - Strictly eliminate the word "subdomain" from user-facing copy.
  - Dialog subtitle updated to: `"Workspaces keep your social accounts, scheduled posts, and media organized in one dedicated space."`
  - Helper text updated to: `"Give your workspace a recognizable name, such as your brand, company, or client project."`
  - Unit tests in `apps/web/tests/ui/workspace-switcher.test.tsx` updated to match the new professional copy.
