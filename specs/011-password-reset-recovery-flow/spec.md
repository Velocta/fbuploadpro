# Feature Specification: Password Reset & Recovery Flow

**Feature Branch**: `feat/011-password-reset-recovery-flow`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User prompt: "Option A password reset/ recovery flow using speckit"

---

## 1. Executive Summary

This feature adds a password reset and recovery experience to FBUploadPro:
1. **Entry Point on Sign In (`/login`)**: A clean "Forgot password?" link placed directly on the login form above the password field.
2. **Password Recovery Request (`/forgot-password`)**: A dedicated split-screen view where operators submit their registered email address. The system triggers Supabase Auth's `resetPasswordForEmail` and displays a confirmation state.
3. **Password Reset Page (`/reset-password`)**: A dedicated split-screen view where the user submits their new password and confirms it. The system verifies password strength (minimum 8 characters), asserts both passwords match, updates the user credentials via Supabase Auth, and redirects to `/login` with an informational success alert.
4. **Backend API Endpoints**:
   - `POST /api/auth/forgot-password`: Validates email and dispatches password recovery email.
   - `POST /api/auth/reset-password`: Validates token/credentials and securely updates the password.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - Request Password Recovery via Email (Priority: P1) 🎯 MVP

When a user cannot recall their password on `/login`, they click "Forgot password?" located directly above the password field. They are taken to `/forgot-password`, presented in the branded split-screen layout. They enter their registered email address and click "Send Recovery Link". The system validates the email format, calls the recovery service (`POST /api/auth/forgot-password`), and displays a clear confirmation view informing them to check their inbox.

**Why this priority**: Essential self-service capability to prevent account lockouts and user churn.

**Independent Test**:
- Navigate to `/login` and verify presence of the "Forgot password?" link above the password field.
- Click the link to reach `/forgot-password`.
- Enter an email address and submit.
- Verify `POST /api/auth/forgot-password` responds with success and the UI renders the confirmation state.

**Acceptance Scenarios**:
1. **Given** a visitor on `/login`, **When** viewing the credentials form, **Then** a "Forgot password?" link is rendered directly above the password input, linking to `/forgot-password`.
2. **Given** a visitor on `/forgot-password`, **When** entering a valid email and submitting, **Then** the system triggers the password recovery flow and shows a clear confirmation message with a button to return to `/login`.
3. **Given** an invalid or empty email, **When** submitting, **Then** client validation displays an error banner without dispatching the request.

---

### User Story 2 - Set New Password & Confirm Credentials (Priority: P2)

When an operator clicks the password reset link from their email, they arrive at `/reset-password`. The page renders in the branded split-screen layout with fields for "New Password" and "Confirm New Password" (both featuring show/hide visibility toggles). The form verifies that both password entries match and satisfy the 8+ character minimum. Upon clicking "Update Password", the system updates the credentials via `POST /api/auth/reset-password`, displays a success message, and redirects them to `/login`.

**Why this priority**: Completes the recovery loop, allowing users to securely regain access to their account.

**Independent Test**:
- Open `/reset-password`.
- Enter mismatched passwords and verify the "Passwords do not match" validation alert.
- Enter a password shorter than 8 characters and verify the length error.
- Enter matching 8+ character passwords and submit.
- Assert successful response and redirection to `/login`.

**Acceptance Scenarios**:
1. **Given** a visitor on `/reset-password`, **When** viewing the form, **Then** fields for "New Password" and "Confirm New Password" with show/hide eye toggles are present.
2. **Given** mismatched passwords, **When** submitting, **Then** an `Alert` message "Passwords do not match. Please verify both password fields." is rendered.
3. **Given** matching passwords of 8+ characters, **When** submitting, **Then** `POST /api/auth/reset-password` updates the password and the user is redirected to `/login`.

---

### User Story 3 - Production-Grade Split-Screen Polish & Security (Priority: P3)

The `/forgot-password` and `/reset-password` pages adhere to the established `AuthSplitLayout` aesthetic with zero technical plumbing leaks, zero decorative status dots, and full WCAG AA accessibility. If an invalid or expired reset token is used, the system renders an informative error banner with an option to request a new recovery email.

**Why this priority**: Consistent brand trust, accessibility compliance, and secure recovery token validation.

**Acceptance Scenarios**:
1. **Given** both recovery pages, **When** rendered on desktop and mobile, **Then** styling strictly consumes tokens from `apps/web/src/lib/theme.ts` with responsive single-column collapse on mobile viewports (<1024px).
2. **Given** an expired or invalid reset token, **When** attempting to update the password, **Then** the page displays a helpful error banner with a link to request a new reset email.

---

## 3. Design & Anti-Slop Specifications

- **Layout**: Shared `AuthSplitLayout` with brand mark and security value proposition on left, and form on right.
- **Microcopy**: Conversational, purposeful, free of internal technical jargon.
- **Theme Tokens**: All colors and hairlines reference `@/lib/theme` and CSS variables.
