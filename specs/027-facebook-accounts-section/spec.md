# Feature Specification: Spec 027 — Dedicated Facebook Accounts Management Section & Dual-Mode Connection Flow

**Feature ID**: `027-facebook-accounts-section`  
**Status**: Approved  
**Created**: 2026-10-10  
**Constitution Authority**: Principle 20 (Dedicated Facebook Accounts Section & Dual-Mode Multi-Browser Connection Architecture)

---

## 1. Executive Summary & Problem Statement

Currently, the workspace sidebar features a navigation item pointing to `/tenant/[subdomain]/accounts`, but navigating to this route returns a 404 error because no frontend view exists. Furthermore, while the backend supports OAuth 2.0 connection and multi-account storage, connecting an account currently assumes the user has their target Facebook profile logged in inside the exact same browser window. Operators running social media publishing frequently manage accounts across multiple browsers, profiles, or client devices.

Spec 027 delivers a dedicated, high-craft, professional SaaS Facebook Accounts management section strictly focused on Facebook Accounts (zero page clutter, zero AI slop, zero fake operational health dots):
1. **Minimalist Account Cards Grid**: Clean profile presentation displaying avatar, display name, gender, profile link, connected pages count, and connection timestamp. When healthy (`status === 'active'`), zero artificial status badges or dots are displayed. When attention is needed (`status === 'expired'`), a clean "Re-authentication required" notice and a 1-click **Reconnect** button appear.
2. **Dual-Mode "Connect Facebook Account" Modal**: A centered dialog offering:
   - **Direct Connection**: For profiles logged into the same browser, redirecting to Facebook OAuth dialog.
   - **Magic Link Connection**: For profiles logged into another browser or device, generating a cryptographically signed, 15-minute copyable connection link with live countdown and pure background polling (every 3 seconds) that auto-transitions to success and updates the grid upon authorization.
3. **Standalone Remote Success View**: [`/connect/facebook/success`](/connect/facebook/success) confirming connection in the external browser.
4. **Safety Disconnect Dialog**: Accessible modal warning of cascading Facebook Page disconnections before purging credentials.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1: Viewing Connected Facebook Accounts (Priority: P1)
**As a** workspace operator navigating to `/tenant/[subdomain]/accounts`,  
**When** I load the view,  
**Then** I see a professional page header, an action button to connect accounts, and a responsive grid of connected Facebook profiles (or a friendly empty state when 0 accounts are connected).

**Acceptance Criteria**:
1. When 0 accounts are connected, an empty state card appears with clear description and a "Connect Facebook Account" button.
2. When 1+ accounts are connected, each card displays:
   - 48px profile picture avatar (with monogram fallback).
   - Display name and external link icon to their Facebook profile (`accountLink`).
   - Demographics/assets: Gender and total connected pages count (`X connected pages`).
   - Connection timestamp (e.g. "Connected Oct 10, 2026").
   - Disconnect button opening confirmation modal.
3. When an account has `status === 'active'`, NO decorative status badges or dots are displayed.
4. When an account has `status === 'expired'`, a clear "Re-authentication required" callout and a **Reconnect** button appear.
5. The Reconnect button does NOT appear for active accounts.

---

### User Story 2: Connecting an Account via Direct Connection (Priority: P1)
**As a** workspace operator with a Facebook account logged in the same browser,  
**When** I click "Connect Facebook Account" and choose "Direct Connection",  
**Then** the button updates to "Redirecting to Facebook..." and executes a full-page redirect to the Facebook OAuth dialog, returning to the accounts view with a dismissible success banner on `?connected=1`.

**Acceptance Criteria**:
1. Clicking "Connect Facebook Account" opens the connection modal.
2. Selecting Direct Connection navigates the current tab to `/api/auth/facebook`.
3. Returning with `?connected=1` renders a non-intrusive green success banner ("Facebook account successfully connected") and scrubs the query parameter from the URL history.
4. Returning with `?error=...` renders a non-intrusive red error notice with human-readable copy.

---

### User Story 3: Connecting an Account via Magic Link (Priority: P1)
**As a** workspace operator whose Facebook account is logged in inside a different browser or machine,  
**When** I click "Connect Facebook Account" and choose "Magic Link",  
**Then** the modal generates a 15-minute copyable connection link, waits via automatic 3-second background polling, and automatically closes upon remote authorization.

**Acceptance Criteria**:
1. Choosing "Magic Link" calls `POST /api/tenant/[subdomain]/accounts/magic-link` to issue a signed token valid for 15 minutes.
2. The modal displays the link, a 1-click "Copy Link" button (transitioning to "Copied!"), and a live countdown timer.
3. Visiting the link in another browser (`/connect/facebook?token=...`) validates the signature and forwards directly to Facebook OAuth.
4. Completing OAuth redirects the remote browser to `/connect/facebook/success` displaying: *"Facebook Account Connected Successfully. You can safely close this window and return to your main workspace."*
5. The workspace modal polls `/api/tenant/[subdomain]/accounts` every 3 seconds, detects the new account, displays a brief success animation, and refreshes the accounts grid.

---

### User Story 4: Disconnecting an Account with Safety Warning (Priority: P2)
**As a** workspace operator wanting to remove a connected Facebook account,  
**When** I click "Disconnect" on an account card,  
**Then** a modal dialog warns me about cascading Page detachments and requires explicit confirmation.

**Acceptance Criteria**:
1. Clicking "Disconnect" opens a `Dialog` displaying the account display name and stating: *"Disconnecting [Name] will also detach X connected Facebook Page(s) and remove their stored publishing credentials."*
2. Clicking "Cancel" closes the modal with no mutations.
3. Clicking "Disconnect Account" executes `DELETE /api/tenant/[subdomain]/accounts/[accountId]`, removes the card from the UI, and shows a confirmation alert.

---

## 3. Functional Requirements

- **FR-001**: Dedicated route at `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx` rendering the Facebook Accounts management interface.
- **FR-002**: Pure accounts focus: strictly Facebook Accounts metadata; Facebook Pages are excluded from this view.
- **FR-003**: Account status domain strictly adheres to `['active', 'disconnected', 'expired']`.
- **FR-004**: Minimalist health UI: zero status pills/dots when `active`; clear warning and Reconnect button only when `expired`.
- **FR-005**: Modal connection selector supporting both Direct Connection (full-page redirect) and Magic Link Connection.
- **FR-006**: Backend endpoint `POST /api/tenant/[subdomain]/accounts/magic-link` signing a 15-minute token with `{ userId, tenantSubdomain, nonce }`.
- **FR-007**: Public route `GET /connect/facebook?token=...` validating the token and redirecting to Facebook OAuth dialog with state flag `isMagic: true`.
- **FR-008**: OAuth callback `GET /api/auth/facebook/callback` detecting `isMagic: true` and redirecting to `/connect/facebook/success`.
- **FR-009**: Standalone remote success page at `apps/web/src/app/connect/facebook/success/page.tsx`.
- **FR-010**: Disconnect confirmation dialog built on `apps/web/src/components/ui/dialog.tsx`.
- **FR-011**: Zero modifications to `DESIGN.md` and 100% adherence to `apps/web/src/lib/theme.ts`.
