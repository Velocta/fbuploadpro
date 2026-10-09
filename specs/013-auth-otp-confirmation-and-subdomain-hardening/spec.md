# Feature Specification: Auth OTP Confirmation & Subdomain Hardening (Spec 013)

**Feature Branch**: `feat/013-auth-otp-confirmation-and-subdomain-hardening`  
**Created**: 2026-10-09  
**Status**: Draft  
**Input**: User directives:
1. Add email confirmation in signup requiring a 6-digit OTP, using Resend for sending the OTP.
2. Eliminate 404s on tenant subdomains by removing the buggy `isPublicTenantPath` in `apps/web/src/middleware.ts` and 307 redirecting all auth routes (`/login`, `/signup`, `/forgot-password`, `/reset-password`) on customer tenant subdomains to the central gateway (`https://app.fbuploadpro.com${pathname}`) with query parameters preserved.
3. Live Password Strength Meter & Complexity: Add visual strength indicator (Weak / Fair / Strong) with real-time criteria feedback (length, mixed case, numbers).
4. Caps Lock Warning: Show an inline warning when Caps Lock is active on password fields.
5. Context & Deep-Link Preservation: Retain `returnUrl` when switching between Sign In and Create Account, and redirect upon completion.
6. Clear consent copy and links on `/signup` ("By creating an account, you agree to our Terms of Service and Privacy Policy").

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 6-Digit Email OTP Confirmation with Resend (Priority: P1) 🎯 MVP

As a new user creating an account, after entering my registration details, I receive a secure 6-digit verification code via email (powered by Resend) and enter it on a dedicated verification step to confirm my email address before my account and workspace are activated.

**Why this priority**:
Verifying email addresses prevents bot account abuse, invalid email submissions, and ensures customers genuinely own their registered email address prior to issuing workspace sessions and cloud storage quotas.

**Independent Test**:
Submit registration details on `/signup`, verify that a 6-digit OTP is generated and dispatched via Resend, enter the valid OTP on the verification screen, and confirm the account is created, session token is issued, and browser redirects to the user's workspace. Test with invalid/expired OTP to ensure user is shown helpful, sanitized feedback.

**Acceptance Scenarios**:

1. **Given** valid registration details (name, phone, email, password),  
   **When** the user submits the signup form,  
   **Then** a cryptographically secure 6-digit OTP is generated with a 10-minute expiry, an email is dispatched via Resend, and the UI transitions smoothly to the OTP verification screen displaying the user's email address.
2. **Given** the user is on the OTP verification screen,  
   **When** they enter the correct 6-digit code and submit,  
   **Then** the account is provisioned in the database, the `fbup_session` cookie is set, and the user is redirected to their tenant workspace `/dashboard` (or `returnUrl` if provided).
3. **Given** the user enters an incorrect or expired OTP,  
   **When** they submit,  
   **Then** an error alert is shown ("Invalid or expired verification code. Please check your email or request a new code.") without exposing backend exceptions.
4. **Given** the user has not received the OTP,  
   **When** they click "Resend code" after the 60-second cooldown expires,  
   **Then** a new 6-digit OTP is dispatched and the cooldown resets.

---

### User Story 2 - Subdomain Auth Redirection & 404 Elimination (Priority: P1) 🎯 MVP

As a user or customer visiting a tenant subdomain (e.g., `client.fbuploadpro.com` or `client.localhost:3000`), when I navigate to any authentication path (`/login`, `/signup`, `/forgot-password`, `/reset-password`), the Edge middleware cleanly redirects me via HTTP 307 to the central app gateway (`https://app.fbuploadpro.com${pathname}`), preserving all query parameters (such as `returnUrl`).

**Why this priority**:
Customer tenant subdomains only host private workspace tools (`/dashboard`, `/media`, etc.). Rewriting auth paths to `/tenant/[subdomain]/login` causes 404 Not Found errors because auth views are centralized on the root/gateway app.

**Independent Test**:
Send requests to `http://acme.localhost:3000/login?returnUrl=/media`, `/signup`, `/forgot-password`, and `/reset-password`. Assert that the middleware returns an HTTP 307 redirect to `http://app.localhost:3000/...` with the original query string intact.

**Acceptance Scenarios**:

1. **Given** an unauthenticated request to `https://tenant.fbuploadpro.com/login?returnUrl=%2Fdashboard`,  
   **When** processed by the edge middleware,  
   **Then** the response is an HTTP 307 redirecting to `https://app.fbuploadpro.com/login?returnUrl=%2Fdashboard`.
2. **Given** requests to `/signup`, `/forgot-password`, or `/reset-password` on a tenant subdomain,  
   **When** processed by middleware,  
   **Then** the response redirects cleanly to the corresponding path on `app.fbuploadpro.com`.
3. **Given** an apex or reserved subdomain request (e.g. `fbuploadpro.com` or `app.fbuploadpro.com`),  
   **When** accessing auth paths,  
   **Then** the central auth pages are served directly without infinite redirection loops.

---

### User Story 3 - Real-Time Password Strength Meter & Complexity (Priority: P2)

As a user entering a password during account registration or password reset, I receive live visual feedback indicating password strength (Weak / Fair / Strong) alongside dynamic criteria indicators (length, uppercase/lowercase, numbers, special characters).

**Why this priority**:
Clear, real-time guidance empowers users to construct resilient passwords without frustrating submit-and-fail friction.

**Independent Test**:
Mount the password input in `/signup`, type varied passwords (short, weak, mixed, strong), and verify that the strength bar and criteria checklist update immediately in real-time.

**Acceptance Scenarios**:

1. **Given** a user is typing in the password field,  
   **When** the password has <8 characters or only single-case letters,  
   **Then** the meter displays "Weak" with error status styling.
2. **Given** a password has >=8 characters with mixed case and digits,  
   **When** evaluated,  
   **Then** the meter displays "Fair" or "Strong" with corresponding theme tokens.
3. **Given** all criteria are met,  
   **Then** the criteria ticks highlight green (`PALETTE.accent2` or success status).

---

### User Story 4 - Caps Lock Warning Indicator (Priority: P2)

As a user typing a password on sign-in, sign-up, or password reset, when my keyboard's Caps Lock is enabled, I see an inline warning signal so I don't fail authentication due to unintentional capitalization.

**Why this priority**:
Accidental Caps Lock is a frequent cause of password entry failure. An inline visual cue prevents user confusion.

**Independent Test**:
Trigger `keydown` with `getModifierState('CapsLock') === true` on a password input. Verify the warning indicator appears. Trigger with Caps Lock false to verify it dismisses.

**Acceptance Scenarios**:

1. **Given** Caps Lock is turned on,  
   **When** the user types or focuses in the password input,  
   **Then** a subtle inline warning indicator ("Caps Lock is on") appears.
2. **Given** Caps Lock is turned off,  
   **Then** the warning indicator immediately disappears.

---

### User Story 5 - Deep-Link (`returnUrl`) & Context Preservation (Priority: P2)

As an authentication user navigating between "Sign In" and "Create Account", any deep-linking parameter (`returnUrl`) is preserved so that upon completing authentication or registration, I am directed to my originally intended workspace destination.

**Why this priority**:
Preserving intent eliminates workflow interruption when invited or directed to specific tenant resources.

**Independent Test**:
Visit `/login?returnUrl=/media/upload`, click "Create one", verify URL is `/signup?returnUrl=/media/upload`. Complete signup and OTP verification, verify final redirect target includes `/media/upload`.

**Acceptance Scenarios**:

1. **Given** a `returnUrl` query parameter on `/login`,  
   **When** clicking the "Create one" link,  
   **Then** the destination URL contains `returnUrl`.
2. **Given** a `returnUrl` on `/signup`,  
   **When** completing OTP verification,  
   **Then** the user is redirected to their tenant subdomain with `returnUrl` rather than default `/dashboard`.

---

### User Story 6 - Terms of Service & Privacy Policy Consent (Priority: P3)

As a prospective customer creating an account, I clearly see the legal consent notice with links to the Terms of Service and Privacy Policy before creating an account.

**Why this priority**:
Mandatory for Meta Graph API App Review approval, commercial transparency, and privacy compliance.

**Acceptance Scenarios**:

1. **Given** the signup form,  
   **When** viewing the interface,  
   **Then** clear legal consent text is displayed: "By creating an account, you agree to our Terms of Service and Privacy Policy." with accessible links styled with theme tokens.
