# Feature Specification: Rebuild Workspace Settings Facebook Tab

**Feature Branch**: `rebuild_facebook_settings_tab`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "You are working on the FBUploadPro Studio web app (Workspace Settings page, Facebook tab). Rebuild the Facebook tab per the design specification: Rename tab from 'Facebook BYOC' to 'Facebook'. State 1 Not connected with step 1 and step 2, connect button validation, copy URL card. State 2 Connected with masked secret, copy buttons, edit details, disconnect button with confirmation dialog. Delete only App ID and Secret on disconnect."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect Facebook Application Setup Flow (State 1) (Priority: P1)

When a workspace does not have Facebook credentials configured, the user views the "Connect Facebook" card with an amber "Not connected" status badge. The card presents a minimal, numbered step-by-step setup guide:
- **Step 1 ("Get your app details")**: Guides the user to copy their App ID and App Secret from Meta App Dashboard (with external link `https://developers.facebook.com`).
- **Step 2 ("Add them here")**: Provides input fields for "APP ID" and masked "APP SECRET" (with inline "Show" toggle). Clicking "Connect Facebook" performs strict validation (App ID 10–20 numeric digits; App Secret non-empty), displays inline field errors on validation failure, saves credentials via the API, displays a success toast ("Facebook connected."), and transitions to State 2 without cleartext secret exposure.
- **"One more step" Card**: Displays the workspace OAuth redirect URI with an instant "Copy" button.

**Why this priority**: Core onboarding journey enabling self-service Meta Graph API integration for publishing.

**Independent Test**:
1. Mount Facebook tab with no saved credentials. Verify State 1 renders: tab titled "Facebook", "Connect Facebook" card with amber "Not connected" badge, Step 1, Step 2, and "One more step" card.
2. Enter invalid App ID (e.g., non-numeric or short) or empty App Secret and click "Connect Facebook": verify inline errors appear and submission is blocked.
3. Enter valid numeric App ID and non-empty App Secret: verify API call is made, "Facebook connected." toast appears, and view transitions to State 2.

**Acceptance Scenarios**:
1. **Given** a workspace without saved Facebook credentials, **When** navigating to the Facebook settings tab, **Then** the tab is labeled "Facebook", the status badge shows amber "Not connected", Step 1 and Step 2 are visible, and the "One more step" card is visible.
2. **Given** the State 1 form, **When** submitting an App ID that is non-numeric or not 10–20 digits long, **Then** an inline field error is shown under the App ID field.
3. **Given** the State 1 form, **When** submitting an empty App Secret, **Then** an inline field error is shown under the App Secret field.
4. **Given** valid App ID and App Secret, **When** clicking "Connect Facebook", **Then** the credentials are encrypted and saved, toast "Facebook connected." is displayed, and the tab renders State 2.

---

### User Story 2 - Connected Workspace Presentation & Edit Flow (State 2) (Priority: P1)

When a workspace already has credentials saved, the tab renders the "Connect Facebook" card in State 2:
- Status badge shows green "Connected".
- Subtext: "Your Facebook app is linked and publishing is ready to go."
- App ID is displayed in cleartext with a "Copy" button.
- App Secret is masked with dots (`••••••••••••••••••••••••`) and includes a "Show" toggle button.
- Secondary button "Edit details" and danger-outline button "Disconnect".
- Real timestamp under buttons: "Connected on <date>." (e.g., "Connected on Oct 16, 2026.").
- The "One more step" card is completely hidden.
- Clicking "Edit details" transitions back to the editable State 1 form pre-filled with the current App ID, leaving the secret masked/optional unless updated, and reveals the "One more step" card.

**Why this priority**: Empowers users to inspect configuration health, copy credentials, update settings, or verify connected dates at a glance.

**Independent Test**:
1. Mount tab with saved credentials. Verify green "Connected" badge, displayed App ID, masked secret with "Show" toggle, "Edit details" and "Disconnect" buttons, and "Connected on <date>." line. Verify "One more step" card is hidden.
2. Click "Edit details": verify form returns to editable inputs with App ID pre-filled and "One more step" card reappears.

**Acceptance Scenarios**:
1. **Given** saved credentials, **When** the Facebook tab loads, **Then** State 2 is displayed with green "Connected" status, "Edit details" and "Disconnect" buttons, and formatted connection date. The "One more step" card is hidden.
2. **Given** State 2 view, **When** clicking "Edit details", **Then** the view opens the form with App ID pre-filled, reveals the "One more step" card, and allows saving updated credentials.

---

### User Story 3 - Disconnect Facebook Confirmation & Selective Data Removal (Priority: P1)

When the user clicks "Disconnect" in State 2, an explicit confirmation dialog opens:
- Dialog Title: "Disconnect Facebook?"
- Dialog Body: "We'll remove your App ID and App Secret from this workspace. Your connected accounts and posting will keep working as normal — but you won't be able to reconnect or connect new accounts until you add new details."
- Buttons: Secondary "Keep connected" (dismisses dialog) and Danger "Disconnect" (confirms removal).
- On confirm: issues `DELETE` request to delete only the App ID and App Secret (`workspace_byoc_credentials`). All access tokens, connected Facebook accounts, pages, media, and scheduled publishing items remain intact. Toast displays "Facebook disconnected." and tab returns to State 1.

**Why this priority**: Protects users from accidental credential deletion while guaranteeing that publishing pipelines and connected account access tokens remain completely undisturbed.

**Independent Test**:
1. From State 2, click "Disconnect": verify modal dialog appears with exact title, exact body copy, "Keep connected", and "Disconnect" buttons.
2. Click "Keep connected": verify modal closes and state remains Connected.
3. Click "Disconnect" in modal: verify DELETE endpoint is called, toast "Facebook disconnected." appears, and view transitions to State 1.

**Acceptance Scenarios**:
1. **Given** the Disconnect dialog is open, **When** clicking "Keep connected" or pressing Escape, **Then** the dialog dismisses and credentials remain intact.
2. **Given** the Disconnect dialog is open, **When** clicking "Disconnect", **Then** only the App ID and Secret credentials row is deleted, publishing queue and connected pages remain untouched, toast "Facebook disconnected." displays, and tab resets to State 1.

---

### User Story 4 - Strict Theme Token Adherence & Responsive Layout (Priority: P2)

The Facebook tab must adhere strictly to design system theme tokens (`apps/web/src/lib/theme.ts`) and global CSS classes:
- Zero ad-hoc colors, custom hex borders, arbitrary shadows, or capsule pill badges.
- Cards are full width on mobile/narrow screens, stacking form inputs gracefully.
- Unboxed luminous status dots with micro-halos (amber `#fad734` for Not connected, green `#2ebd85` for Connected).
- Numbered step indicators with hairline dividers and generous airy spacing.
- Zero emojis anywhere in copy.
- No modifications to General tab, auth logic, or routing.

**Why this priority**: Guarantees visual craftsmanship, consistency across dark/light themes, and strict adherence to monorepo architectural rules.

**Independent Test**:
1. Verify tab responsiveness across viewports (360px mobile to 1200px desktop).
2. Validate that all tokens, colors, fonts, and radii match `apps/web/src/lib/theme.ts`.

---

## Edge Cases

- **Network Failure During Connect**: If the save request fails, display an inline error message and maintain the entered App ID/Secret without resetting the form.
- **Network Failure During Disconnect**: If the delete request fails, keep the confirmation dialog open or display an error message and maintain connected state.
- **Clipboard API Failure**: If `navigator.clipboard.writeText` fails or is denied permission, gracefully handle the error without crashing.
- **Masked Secret in Edit Mode**: When editing an existing connection, if the user leaves the App Secret empty, preserve the previously encrypted secret on the server.
- **Date Formatting Fallback**: If `connectedAt` is null or invalid, fallback gracefully to current date formatting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST rename the settings tab navigation from "Facebook BYOC" to "Facebook".
- **FR-002**: System MUST render State 1 ("Not connected") when no App ID / App Secret is saved for the workspace.
- **FR-003**: System MUST display an amber status dot with label "Not connected" in State 1.
- **FR-004**: System MUST present Step 1 with link to `https://developers.facebook.com` and Step 2 with App ID and masked App Secret inputs.
- **FR-005**: System MUST validate on click: App ID must be numeric (10–20 digits) and App Secret must be non-empty.
- **FR-006**: System MUST show inline field errors on validation failure.
- **FR-007**: System MUST display success toast "Facebook connected." upon successful connection and transition to State 2.
- **FR-008**: System MUST render the "One more step" card containing the workspace callback URL in State 1 and in edit mode, and hide it in State 2.
- **FR-009**: System MUST render State 2 ("Connected") with green status dot "Connected" when credentials exist.
- **FR-010**: System MUST render App ID with a "Copy" button and App Secret as masked dots with a "Show" toggle in State 2.
- **FR-011**: System MUST display "Edit details" and danger-outline "Disconnect" buttons in State 2.
- **FR-012**: System MUST display "Connected on <date>." under the buttons in State 2.
- **FR-013**: System MUST open a confirmation dialog on clicking "Disconnect" with verbatim copy: "Disconnect Facebook?", explanation body, "Keep connected", and "Disconnect" buttons.
- **FR-014**: System MUST delete ONLY the App ID and App Secret on disconnect confirmation via `DELETE /api/tenant/[subdomain]/settings/byoc`, keeping all access tokens and connected pages intact.
- **FR-015**: System MUST display toast "Facebook disconnected." on disconnect confirmation and return the tab to State 1.
- **FR-016**: System MUST NOT touch the General tab, auth logic, routing, or any other page.

### Key Entities

- **Workspace Credentials (`workspace_byoc_credentials`)**: Workspace-scoped Facebook App credentials (`workspace_id`, `fb_app_id`, `encrypted_fb_app_secret`, `created_at`, `updated_at`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user copy matches the verbatim specification with zero emojis.
- **SC-002**: Connect Facebook form validates inputs within <50ms and saves credentials reliably.
- **SC-003**: Disconnect removes only App ID and Secret; zero impact to connected Facebook accounts or publishing queue.
- **SC-004**: Zero accessibility or console errors; full responsiveness across mobile (<768px) and desktop viewports.

## Assumptions

- The workspace OAuth redirect URI is resolved dynamically from `window.location.origin` or host configuration as `${origin}/api/auth/facebook/callback`.
- The database table `workspace_byoc_credentials` row is deleted when disconnecting, which leaves `facebook_accounts`, `facebook_pages`, and scheduled posts intact.
