# Research: Rebuild Workspace Settings Facebook Tab

## Technical Decisions & Analysis

### 1. Tab Renaming & Architecture Boundary
- **Current Tab Name**: "Facebook BYOC" in `apps/web/src/app/tenant/[subdomain]/settings/page.tsx`.
- **Target Tab Name**: "Facebook".
- **Internal ID / Query Param**: Remains `tab=byoc` to preserve URL bookmarks and ensure zero breaking changes to routing or other pages.
- **Boundary**: General tab, auth logic, and external routing must remain 100% untouched.

### 2. State 1 (Not Connected) UI Architecture
- **Component**: Rebuilding `apps/web/src/components/settings/byoc-settings-view.tsx` into a clean, modern implementation.
- **Card 1: "Connect Facebook"**:
  - Unboxed status dot: amber `#fad734` (`status="queued"`, label="Not connected").
  - Subtext: "Link your Facebook app to start publishing from this workspace."
  - Step 1 (Numbered "1"): "Get your app details".
    - Body: "Open your Meta App Dashboard → and copy your App ID and App Secret from Settings → Basic."
    - Link to `https://developers.facebook.com` in accent color (`PALETTE.accent1` / `var(--accent-1)`), semibold, target `_blank`.
  - Step 2 (Numbered "2"): "Add them here".
    - "APP ID": Text input with placeholder `"e.g. 123456789012345"`, helper `"You'll find this in your Meta app under Settings → Basic."`
    - "APP SECRET": Masked password input with placeholder `"Enter your App Secret"`, internal "Show"/"Hide" toggle, helper `"Only you can see this — we keep it safe and never show it again."`
    - Primary button: "Connect Facebook".
    - Helper under button: "We check everything works the moment you connect."
    - Validation: App ID must be numeric (10–20 digits), App Secret non-empty. Display inline field errors on failure.
    - Toast on success: "Facebook connected."
- **Card 2: "One more step"** (Shown only in State 1 and in edit mode):
  - Subtext: "Add this address to your Meta app so Facebook can bring you back here after you sign in."
  - Label: "SIGN-IN ADDRESS"
  - Monospace read-only callback URL: `https://<workspace>.vinsmokemedia.online/api/auth/facebook/callback` (or window origin) in accent color with "Copy" button.
  - Helper: 'Paste this into the "Valid OAuth Redirect URIs" field in your Meta app.'

### 3. State 2 (Connected) UI Architecture
- **Card 1: "Connect Facebook"**:
  - Unboxed status dot: green `#2ebd85` (`status="operational"`, label="Connected").
  - Subtext: "Your Facebook app is linked and publishing is ready to go."
  - "APP ID": displays saved App ID with "Copy" button.
  - "APP SECRET": displays masked dots (`••••••••••••••••••••••••`) with "Show"/"Hide" toggle revealing masked / masked state (secret is never returned in cleartext from server; showing toggle shows obscured placeholder). Helper: "Only you can see this — we keep it safe and never show it again."
  - Buttons: Secondary "Edit details" and danger-outline "Disconnect".
  - Date line: "Connected on <date>." (formatted e.g. "Connected on Oct 16, 2026.").
  - Card 2 ("One more step") is HIDDEN.
  - Clicking "Edit details": switches to State 1 edit mode pre-filled with the App ID, reveals Card 2 ("One more step"), and allows updating credentials.

### 4. Disconnect Workflow & API
- **Confirmation Dialog**:
  - Title: "Disconnect Facebook?"
  - Body: "We'll remove your App ID and App Secret from this workspace. Your connected accounts and posting will keep working as normal — but you won't be able to reconnect or connect new accounts until you add new details."
  - Buttons: Secondary "Keep connected" (dismisses) and danger "Disconnect" (confirms).
- **Backend DELETE Endpoint**:
  - `DELETE /api/tenant/[subdomain]/settings/byoc`
  - Deletes row from `workspace_byoc_credentials` for the workspace.
  - Does NOT touch `facebook_accounts`, `facebook_pages`, access tokens, or publishing queue.
  - Returns `{ success: true }`.
  - Frontend shows toast "Facebook disconnected." and transitions to State 1.

### 5. Styling & Theme Tokens
- Strictly reference `THEME`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`, and CSS variables from `apps/web/src/lib/theme.ts` and `apps/web/src/app/globals.css`.
- Zero capsule pill badges; unboxed 6px luminous status dot with micro-halo.
- Verbatim copy throughout; zero emojis.
