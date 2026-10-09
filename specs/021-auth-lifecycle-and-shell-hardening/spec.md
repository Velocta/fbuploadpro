# Feature Specification: Spec 021 — Comprehensive Auth Lifecycle, Resilient Session Termination & Workspace Shell Usability Hardening

**Feature Branch**: `feat/spec-021-auth-lifecycle-and-shell-hardening`  
**Created**: 2026-10-09  
**Status**: Ready for Implementation  
**Constitution Reference**: FBUploadPro Constitution v2.10.0 (Principle 15)  

---

## 1. Executive Summary & Objective

This specification provides end-to-end hardening across all 22 identified edge cases and real-world failure modes spanning user registration, OTP onboarding, sign-in, password recovery, session termination, multi-tab synchronization, and workspace shell responsive navigation. It ensures zero trapped users, zero session hijacking or offline sign-out deadlocks, zero theme flash, zero mobile drawer navigation trapping, and zero technical plumbing leaks.

---

## 2. User Scenarios & Testing (Prioritized User Stories)

### User Story 1 — Pending Registration Recovery & OTP Onboarding Resilience (Priority: P1)
**Description**:  
When a user signs up but departs before completing the 6-digit email OTP verification step, attempting to sign in on `/login` must recognize their pending registration. Rather than returning "Invalid email or password", the system validates the entered password against the staged registration, dispatches a fresh OTP code via Resend, and routes the user directly to the OTP verification screen (`/signup?step=otp&email=...`) with an explanatory notice. Furthermore, the OTP verification screen eliminates traps by providing a 1-click "Wrong email? Edit details" button that preserves all previously entered fields, persists pending verification state across reloads, provides a 1-click "Send fresh code" button when OTPs expire, and offers immediate "Sign in instead" links on 409 duplicate registration.

**Why this priority**:  
Prevents customer drop-off during the critical initial onboarding funnel where users accidentally close tabs or mistype email addresses.

**Independent Test**:  
1. Fill signup form with `newuser@gmail.com` and password. Close browser on OTP step.
2. Go to `/login` and enter `newuser@gmail.com` with the same password.
3. System responds with HTTP 403 `requiresOtp: true`, dispatches fresh OTP, and redirects to `/signup?step=otp&email=newuser@gmail.com`.
4. User enters OTP and lands directly on their workspace root.

**Acceptance Scenarios**:
1. **Given** a user with pending unverified signup, **When** they submit valid credentials on `/login`, **Then** they receive a fresh OTP and are directed to the OTP screen with notice "Please verify your email address to complete registration."
2. **Given** a user with pending unverified signup, **When** they submit an invalid password on `/login`, **Then** the system returns standard "Invalid email or password" to prevent account state enumeration.
3. **Given** a user on Step 2 of `/signup`, **When** they click "Wrong email? Edit details", **Then** the form returns to Step 1 with Full Name, Phone, and Password fields preserved and editable.
4. **Given** a user on Step 2 of `/signup`, **When** the page is reloaded, **Then** the page resumes on Step 2 with the email parameter intact.
5. **Given** an expired OTP (>10 minutes), **When** submitted, **Then** an inline callout displays "Code has expired" with a 1-click "Send fresh code" button.
6. **Given** an attempt to register an already-verified email (409 Conflict), **When** submitted, **Then** the error callout includes direct clickable links: "Email is already registered. Sign in instead or Reset password."

---

### User Story 2 — Bulletproof Sign Out & Multi-Tab Synchronization (Priority: P1)
**Description**:  
Sign-out must be absolute and resilient against offline network drops, multi-tab divergence, and browser history caching. Clicking "Sign Out" must immediately expire local session cookies (`document.cookie = 'fbup_session=; Max-Age=0; path=/; ...'`), broadcast a termination event across all open tabs via `BroadcastChannel('fbup_auth')`, and navigate directly to the canonical central gateway (`https://app.${rootDomain}/login?logout=success`). The middleware guard must honor `logout=success` to bypass automatic forward redirects. Authenticated HTML views must specify `Cache-Control: no-store` and execute a `pageshow` guard to prevent back-button bfcache data exposure.

**Why this priority**:  
Session termination is a non-negotiable security requirement. Users must never be trapped in logged-in states during network degradation or leave residual authenticated views accessible via the browser Back button.

**Independent Test**:  
1. In workspace tab, open DevTools and simulate offline mode.
2. Click "Sign Out".
3. Client cookie is wiped immediately and browser navigates to `/login?logout=success`.
4. Middleware permits login form rendering without auto-forwarding back to tenant workspace.

**Acceptance Scenarios**:
1. **Given** an authenticated user who disconnects from internet, **When** they click "Sign Out", **Then** client cookies are cleared and the browser navigates to `/login?logout=success` without getting bounced back to the workspace.
2. **Given** multiple workspace tabs open in the same browser, **When** user signs out in Tab 1, **Then** Tabs 2, 3, and 4 immediately redirect to `/login?logout=success`.
3. **Given** a signed-out user on `/login`, **When** they click the browser Back button, **Then** `window.onpageshow` (`event.persisted`) triggers a hard refresh, preventing cached workspace screens from displaying.
4. **Given** a sign-out trigger from any tenant subdomain, **When** initiated, **Then** navigation targets the canonical gateway `https://app.${rootDomain}/login?logout=success` directly, avoiding double-hop 307 redirects.

---

### User Story 3 — Workspace Shell Responsive Navigation & Theme Persistence (Priority: P2)
**Description**:  
The workspace app shell must deliver flawless mobile and visual ergonomics. Mobile drawer sheets (<768px) must automatically close whenever any navigation link is tapped. The mobile layout canvas must reserve left gutter padding (`pl-14` / 56px) so the floating hamburger button never overlaps page titles, headers, or action controls. The theme selector must persist the user's choice to both `localStorage` and a cookie (`fbup_theme`) to prevent dark/light theme flashes (FOUC). The user popover must check viewport bounds to prevent clipping on low-height viewports.

**Why this priority**:  
Mobile operators and creator power-users require seamless touch navigation without UI overlaps or theme flicker.

**Independent Test**:  
1. On viewport width <768px, open sidebar drawer and click "Accounts".
2. Drawer sheet automatically closes, revealing the Accounts page.
3. Page header has left clearance and is completely unobscured by the floating trigger.
4. Toggle theme to light, refresh browser: theme remains light with zero flash.

**Acceptance Scenarios**:
1. **Given** a mobile viewport (<768px) with sidebar drawer open, **When** any menu link is clicked, **Then** `setOpenMobile(false)` is invoked and the drawer sheet closes immediately.
2. **Given** mobile viewports, **When** pages render, **Then** layout reserves at least 56px left gutter so the floating button never covers content.
3. **Given** a theme toggle action, **When** clicked, **Then** theme is stored in `localStorage` and cookie `fbup_theme`, persisting across reloads and tab openings.
4. **Given** a user popover trigger on compact screens, **When** activated, **Then** popover renders within safe viewport bounds.

---

### User Story 4 — Sign In, Security Hygiene & Credential Lifecycle (Priority: P2)
**Description**:  
Hardens authentication security and operational hygiene: Caps Lock indicator on password fields, uniform rate-limiting messages to eliminate account enumeration, client-side interceptor transitions for 403 `ACCOUNT_SUSPENDED`, cross-tab session identity overwrite detection, and session termination notices (`/login?reason=password_changed`).

**Why this priority**:  
Prevents brute-force enumeration, avoids user confusion on Caps Lock errors, and enforces rapid termination of suspended accounts.

**Independent Test**:  
1. Turn on Caps Lock and focus password field on `/login`: subtle warning badge indicates "Caps Lock is on".
2. Send repeated failed login requests for both existing and non-existent accounts: rate limit message is identical ("Too many sign in attempts. Please try again in X seconds.").
3. Simulate 403 `ACCOUNT_SUSPENDED` from client fetch: page immediately transitions to `/account-suspended`.

**Acceptance Scenarios**:
1. **Given** a user with Caps Lock enabled, **When** typing in `PasswordInput`, **Then** an accessible Caps Lock indicator is visible.
2. **Given** login rate limits reached, **When** error is returned, **Then** copy is uniform regardless of whether email exists in the database.
3. **Given** an active session, **When** any client-side API call returns 403 `ACCOUNT_SUSPENDED`, **Then** the application navigates immediately to `/account-suspended`.
4. **Given** a user visiting `/login?reason=password_changed`, **When** page loads, **Then** an info banner states: "Your session was terminated because your password was recently updated. Please sign in again."
5. **Given** multiple tabs open, **When** a different user logs in on another tab, **Then** other tabs detect session change and reload.

---

### User Story 5 — Password Recovery & Navigation Resilience (Priority: P3)
**Description**:  
Improves recovery and edge-case routing: notification when a newly requested recovery OTP invalidates earlier codes, clean cancellation when returning to login from recovery Step 2, `autoComplete="new-password"` with validation ensuring new password differs from old password, and feedback when cross-tenant manual URL edits are intercepted.

**Why this priority**:  
Eliminates confusion during multi-tab password recovery and protects against unintended password overwrites.

**Independent Test**:  
1. Request recovery OTP on `/forgot-password`, then click "Return to Sign In": reset staging is cleared cleanly.
2. Request a second OTP: clear notification informs the user that previous codes are invalidated.

**Acceptance Scenarios**:
1. **Given** a user requesting multiple recovery OTPs, **When** a new code is sent, **Then** message states: "A new code has been sent. Any previous codes have been invalidated."
2. **Given** Step 2 of password recovery, **When** user clicks "Return to Sign In", **Then** pending recovery state is cleared and user lands cleanly on `/login`.
3. **Given** new password input, **When** resetting password, **Then** `autoComplete="new-password"` is enforced.

---

## 3. Architecture & Contract Changes

### 3.1 Backend Contracts & Routes
- `POST /api/auth/login`:
  - Before returning 401 on missing active user, inspect pending unverified signups.
  - If email matches a pending registration and password hash verifies:
    - Generate fresh 6-digit OTP with 10m TTL.
    - Dispatch OTP email via Resend.
    - Return HTTP 403 with `{ error: 'Email verification required', requiresOtp: true, email: canonicalEmail }`.
- `POST /api/auth/signup`:
  - Return `{ success: true, email, step: 'otp' }`.
  - When returning 409 Conflict: include `{ error: 'This email is already registered', code: 'EMAIL_ALREADY_REGISTERED' }`.
- `POST /api/auth/logout`:
  - Set `fbup_session=; Max-Age=0; path=/; Domain=.${rootDomain}; HttpOnly; Secure; SameSite=Lax`.
- `middleware.ts`:
  - Check for `logout=success` query parameter on `/login` or central auth routes. If present, do NOT redirect authenticated users to tenant workspace; permit access to `/login`.
  - Set `Cache-Control: no-store, no-cache, must-revalidate` on all authenticated tenant workspace responses.

### 3.2 Frontend Components
- `apps/web/src/components/auth/password-input.tsx`:
  - Add `onKeyDown` / `onKeyUp` tracking for `e.getModifierState('CapsLock')`.
  - Display accessible inline Caps Lock indicator.
- `apps/web/src/app/login/page.tsx`:
  - Intercept `requiresOtp: true` response and navigate to `/signup?step=otp&email=${encodeURIComponent(email)}&notice=pending_verification`.
  - Display info banner when `reason=password_changed` or `logout=success`.
  - Uniform rate-limit error messaging.
- `apps/web/src/app/signup/page.tsx`:
  - Parse `step=otp` and `email` from query parameters on mount to resume pending verification.
  - Add "Wrong email? Edit details" button on Step 2 that returns to Step 1 with fields preserved.
  - Add 1-click "Send fresh code" trigger when code expires.
  - On 409 Conflict, render actionable inline links to `/login` and `/forgot-password`.
- `apps/web/src/components/workspace/workspace-user-menu.tsx`:
  - Client-side cookie expiration on Sign Out.
  - Broadcast logout event via `BroadcastChannel('fbup_auth')` and `localStorage.setItem('fbup_logout_event', Date.now())`.
  - Navigate directly to `https://app.${rootDomain}/login?logout=success`.
  - Persist theme selection in `localStorage` and `document.cookie = 'fbup_theme=...'`.
- `apps/web/src/components/workspace/workspace-sidebar.tsx`:
  - Auto-close mobile sheet on navigation link clicks via `setOpenMobile(false)`.
- `apps/web/src/app/tenant/[subdomain]/layout.tsx`:
  - Add mobile gutter (`pl-14` or responsive padding) to ensure floating hamburger button never overlaps page content.
  - Add `window.onpageshow` bfcache protection listener and cross-tab logout synchronization listener.
