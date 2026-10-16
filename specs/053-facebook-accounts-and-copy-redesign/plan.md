# Spec 053: Technical Architecture & Implementation Plan

## 1. Architectural Overview
This plan specifies the refactoring and modernization of four target components:
1. `apps/web/src/components/workspace/create-workspace-modal.tsx`: Professionalize customer-facing copy; eradicate technical jargon and "subdomain" references.
2. `apps/web/src/components/accounts/account-card.tsx`: Redesign card layout; remove "Token valid for X days" and gender metadata; add 42px avatar status rings; provide blended linked pages navigation to pre-filtered Pages view.
3. `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx`: Rebalance header and toolbar using the canonical split-horizon pattern from `pages/page.tsx`.
4. `apps/web/src/components/accounts/connect-account-modal.tsx`: De-box modal choices; introduce open flat midnight slate styling; rewrite plain-English copy for desktop browser vs mobile/different browser connection.

---

## 2. Component Design & State Contracts

### A. `CreateWorkspaceModal` (`create-workspace-modal.tsx`)
- **Subtitle Copy**:
  - `Workspaces keep your social accounts, scheduled posts, and media organized in one dedicated space.`
- **Field Helper Copy**:
  - `Give your workspace a recognizable name, such as your brand, company, or client project.`
- **Placeholder**:
  - `e.g. Acme Media or Client Name`

### B. `AccountCard` (`account-card.tsx`)
- **Status Ring Logic**:
  - Expired: `1.5px solid #f6465d` (PALETTE.accent3)
  - Expiring Soon (1-7 days remaining): `1.5px solid #fad734` (PALETTE.primary)
  - Active: `1.5px solid #2ebd85` (PALETTE.accent4)
- **Avatar Geometry**:
  - 42px diameter (`RADII.full`), with `boxShadow` or border acting as the luminous status indicator.
- **Linked Pages Action**:
  - Replaces heavy expandable list with a blended button:
    `[ X pages linked ↗ ]`
  - On click: calls `router.push(/tenant/${subdomain}/pages?account=${encodeURIComponent(account.displayName)})`.
  - For unit test safety, supports prop `subdomain?: string` and preserves `data-testid="account-pages-count"`.
  - Preserves optional `onDisconnect` and `onReconnect` callbacks.
- **Removed Elements**:
  - `daysRemaining` / `account-expiring-soon-alert` showing "Token valid for X days".
  - `formattedGender` display.

### C. `AccountsPage` (`apps/web/src/app/tenant/[subdomain]/accounts/page.tsx`)
- **Top Section**:
  - Modeled strictly after `PagesScaleToolbar` and `computeSituationalSubtitle` in `pages/page.tsx`.
  - Exported helper `computeAccountsSubtitle(totalCount, filteredCount, attentionCount, isFiltered): React.ReactNode`.
  - Cognitive complexity $\le 15$.
  - Ghost search input with inset magnifying glass icon & clear button.
  - Typographic flat tabs with 2px gold bottom border on active tab.

### D. `ConnectAccountModal` (`connect-account-modal.tsx`)
- **De-boxed Selection Surface**:
  - Replaces nested border-in-border button boxes with clean, open option rows on the midnight slate canvas.
  - Option 1: "This Browser"
    - "If you're already logged into Facebook in this browser window."
  - Option 2: "Different Browser or Phone"
    - "If your Facebook account is open in another browser, private window, or on your mobile device."
- **Magic Link View**:
  - Clean instruction: "Open this link in the browser or mobile window where your Facebook account is currently logged in. Once approved, this window will update automatically."
  - Polling interval (3s) and timer countdown preserved with clean typography.

---

## 3. Test Alignment & Verification Plan
- `apps/web/tests/ui/workspace-switcher.test.tsx`:
  - Update assertion from `'A unique subdomain will be automatically created'` to `'Give your workspace a recognizable name'`.
- `apps/web/tests/ui/accounts.test.tsx`:
  - Update tests to assert absence of token validity days and absence of gender string.
  - Verify blended linked pages navigation and status ring styling.
  - Verify updated copy in `ConnectAccountModal`.
- Offload full verification to remote GitHub Actions CI upon opening the Pull Request.
