# Quickstart & Verification Guide: 020 Post-Authentication Workspace Home Landing Route

**Feature ID**: `020-post-auth-home-landing`  

---

## Verification Scenarios

### Scenario 1: Sign In Redirects to Workspace Home
1. Navigate to `/login`.
2. Enter valid credentials (e.g. `operator@gmail.com` / `ValidPassword123!`).
3. Click "Sign In".
4. Assert user is redirected to `http(s)://${subdomain}.${rootDomain}/` (Workspace Home).
5. Verify page renders with `WorkspaceSidebar` showing "Home" active.

### Scenario 2: Signup & OTP Verification Redirects to Workspace Home
1. Navigate to `/signup`.
2. Fill registration form and submit.
3. On OTP screen, enter valid 6-digit code.
4. Assert user is provisioned and redirected to `http(s)://${subdomain}.${rootDomain}/`.

### Scenario 3: Password Reset Redirects to Login with Banner
1. Navigate to `/forgot-password`.
2. Enter registered email to receive OTP.
3. Enter 6-digit OTP and new password, then submit.
4. Verify success screen displays, followed by automatic redirect to `/login?reset=success`.
5. Verify `/login` renders green Alert banner: "Password Updated - Your password has been successfully reset. Please sign in with your new credentials."
6. Sign in with the new password.
7. Verify immediate redirect to Workspace Home.
