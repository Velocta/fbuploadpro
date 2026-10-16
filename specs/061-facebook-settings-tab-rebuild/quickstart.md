# Quickstart: Rebuild Workspace Settings Facebook Tab

## Verification Guide

### 1. View State 1 (Not Connected)
1. Open Workspace Settings: `http://localhost:3000/tenant/<subdomain>/settings?tab=byoc`.
2. Confirm the tab navigation renders "General" and "Facebook" (not "Facebook BYOC").
3. Confirm the "Connect Facebook" card renders:
   - Amber unboxed status dot: "Not connected".
   - Subtext: "Link your Facebook app to start publishing from this workspace."
   - Step 1 ("Get your app details") with external link "Meta App Dashboard →" pointing to `https://developers.facebook.com`.
   - Step 2 ("Add them here") with APP ID and APP SECRET inputs.
   - Primary button "Connect Facebook" and sub-button helper "We check everything works the moment you connect."
4. Confirm "One more step" card renders with:
   - Subtext: "Add this address to your Meta app so Facebook can bring you back here after you sign in."
   - Monospace SIGN-IN ADDRESS with "Copy" button.
   - Helper: 'Paste this into the "Valid OAuth Redirect URIs" field in your Meta app.'

### 2. Validation Testing
1. Click "Connect Facebook" with empty fields: verify inline field errors appear ("Please enter a valid numeric App ID (10–20 digits)." and "Please enter your App Secret.").
2. Enter non-numeric App ID (e.g. `abc12345`): verify numeric validation error displays inline.
3. Enter valid numeric App ID (e.g. `123456789012345`) and valid App Secret (e.g. `secret_abc_987`): click "Connect Facebook".
4. Verify success toast: "Facebook connected." and transition to State 2.

### 3. View State 2 (Connected)
1. Confirm the "Connect Facebook" card renders:
   - Green unboxed status dot: "Connected".
   - Subtext: "Your Facebook app is linked and publishing is ready to go."
   - "APP ID" with "Copy" button.
   - "APP SECRET" masked dots (`••••••••••••••••••••••••`) with "Show" toggle.
   - Secondary button "Edit details" and danger-outline button "Disconnect".
   - Date line: "Connected on <date>."
2. Confirm "One more step" card is HIDDEN.
3. Click "Edit details": confirm form opens in edit mode pre-filled with App ID and reveals "One more step" card.

### 4. Disconnect Testing
1. In State 2, click "Disconnect".
2. Confirm modal dialog opens:
   - Title: "Disconnect Facebook?"
   - Body: "We'll remove your App ID and App Secret from this workspace. Your connected accounts and posting will keep working as normal — but you won't be able to reconnect or connect new accounts until you add new details."
   - Secondary button "Keep connected" and danger button "Disconnect".
3. Click "Keep connected": verify dialog closes and state remains Connected.
4. Click "Disconnect" in dialog: verify DELETE request succeeds, toast displays "Facebook disconnected.", and tab resets to State 1.
