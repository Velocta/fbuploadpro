# Quickstart & Verification Guide: Spec 021

## 1. Local Testing Setup
Run the web application locally:
```bash
pnpm --filter @fbuploadpro/web dev
```

## 2. Verification Steps

### Step 1: Unverified Account Login Recovery
1. Visit `http://app.fbuploadpro.localhost:3000/signup`.
2. Fill details for a new user:
   - Full Name: `Test Unverified`
   - Phone: `+12025550123`
   - Email: `unverified.test@gmail.com`
   - Password: `Password123!`
3. Click "Create Account" -> User arrives at Step 2 (OTP form).
4. Do NOT enter the OTP. Close the tab or navigate to `http://app.fbuploadpro.localhost:3000/login`.
5. Enter `unverified.test@gmail.com` and `Password123!`.
6. Click "Sign In".
7. Verify:
   - The user is redirected to `/signup?step=otp&email=unverified.test@gmail.com`.
   - A fresh OTP is issued and sent.
   - User enters OTP and is successfully logged in.

### Step 2: Resilient Sign-Out & Multi-Tab Synchronization
1. In a tenant workspace, open two tabs side-by-side (`http://test.fbuploadpro.localhost:3000/`).
2. Disconnect your internet (or toggle offline in DevTools).
3. In Tab 1, click user menu -> "Sign Out".
4. Verify:
   - Tab 1 immediately clears cookies and redirects to `/login?logout=success`.
   - Tab 2 immediately detects the sign-out event via `BroadcastChannel` / `storage` and redirects to `/login?logout=success`.
   - Re-visiting the tenant root redirects to login (no session remains).

### Step 3: Responsive Drawer & Theming
1. Shrink browser viewport to mobile width (<768px).
2. Open sidebar drawer.
3. Tap "Accounts" or "Home".
4. Verify:
   - Drawer sheet closes automatically.
   - Header content has left clearance and is not covered by the hamburger button.
5. In user menu, toggle theme from Dark to Light.
6. Refresh the page:
   - Verify page renders in Light mode with zero flash.

### Step 4: Quality Gate
Run full repository suite:
```bash
pnpm turbo run build lint typecheck test
```
All tasks and tests must be 100% green.
