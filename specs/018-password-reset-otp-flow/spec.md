# Feature Specification: 018 - 6-Digit OTP Password Reset Flow

**Feature Branch**: `feat/018-password-reset-otp-flow`  
**Created**: 2026-10-09  
**Status**: Ready for Implementation  
**Input**: User request: "Remove recovery link and have otp only make a proper SDD approach read your agent file"

---

## 1. Executive Summary & Context

FBUploadPro currently uses email magic recovery links for password resets (`/api/auth/forgot-password` dispatches Supabase magic links, and `/reset-password` parses link tokens). To provide a unified, predictable, and robust recovery experience matching the signup OTP flow, all email magic recovery links are eliminated in favor of a **6-Digit Numeric OTP Recovery Flow**.

### Clarifications & Architectural Decisions (Pre-Flight Alignment)
- **Clarification 1 (UX Layout & Routing)**: The recovery flow is hosted directly on `/forgot-password` as a seamless two-step sequence: Step 1 collects and validates the canonical Gmail address; Step 2 prompts for the 6-digit numeric OTP, new password, and confirmation password, while providing a 60s resend timer and a "Change email address" link. `/reset-password` safely redirects visitors to `/forgot-password`.
- **Clarification 2 (Email Dispatch Service)**: 6-digit password reset codes are dispatched via Resend using `apps/web/src/lib/email-service.ts`, utilizing a dedicated password recovery email template. When offline or unconfigured, the service logs code delivery safely in simulated mode.
- **Clarification 3 (Security Policy & Cryptographic Verification)**: Reset OTPs are valid for 10 minutes, enforce a 60-second resend cooldown, 5-attempt progressive lockout with 15-minute freeze, and are verified using constant-time string comparison (`crypto.timingSafeEqual`). Successful password mutations immediately update `passwordUpdatedAt`, invalidating pre-existing active sessions.

The recovery workflow operates via an intuitive two-step interface directly on `/forgot-password`:
1. **Step 1 (Identifier Submission)**: The user provides their registered Gmail address. The system validates canonicalization, checks rate limits, generates a cryptographically secure 6-digit numeric OTP, and delivers it via the dedicated email notification service.
2. **Step 2 (Code Verification & Password Mutation)**: The user inputs the 6-digit OTP alongside their new password (and confirmation password). Upon constant-time verification, the password is reset, pre-existing sessions are invalidated to secure the account, and the user is guided to log in.

Direct visits to `/reset-password` are gracefully routed to the unified recovery interface.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - 6-Digit Password Reset OTP Request & Delivery (Priority: P1)

As a registered FBUploadPro user who forgot their password,  
I want to submit my registered Gmail address and receive a 6-digit numeric verification code in my email,  
So that I can verify my identity without relying on magic links or leaving my current browser session.

**Why this priority**: Without requesting and receiving a verification code, no password recovery can occur.

**Independent Test**: Can be tested independently by submitting a valid Gmail address to the password recovery request endpoint and verifying that a 6-digit code is generated with a 10-minute expiration window and dispatched via the email service.

**Acceptance Scenarios**:
1. **Given** a user on the password recovery screen, **When** they submit a valid Gmail address, **Then** the system normalizes the address, generates a 6-digit numeric OTP with a 10-minute time-to-live, dispatches a notification email containing the code, and transitions the user interface to the verification step.
2. **Given** any recovery request (whether the email address exists in the system or not), **When** the request is submitted, **Then** the interface transitions to the verification step with uniform feedback to prevent user enumeration.
3. **Given** an invalid or non-Gmail email format, **When** submitted, **Then** the system provides clear, inline feedback requiring a valid Gmail address without triggering an OTP dispatch.
4. **Given** a user requests a code and immediately requests another, **When** within the 60-second cooldown window, **Then** the system enforces the cooldown and informs the user of the remaining wait time.

---

### User Story 2 - OTP Verification and Password Reset (Priority: P1)

As a user with a valid 6-digit verification code,  
I want to enter the code along with my new password and confirmation password,  
So that I can regain access to my account with my updated credentials.

**Why this priority**: Completes the core recovery journey, updating credentials and restoring access.

**Independent Test**: Can be tested independently by submitting a valid code alongside compliant new password fields to verify successful credential update and session invalidation.

**Acceptance Scenarios**:
1. **Given** an active 6-digit reset code, **When** the user submits the correct code and a matching password meeting policy requirements (8 to 128 characters), **Then** the system updates the password, clears the reset code (single-use), invalidates existing active sessions, and presents a success confirmation directing the user to sign in.
2. **Given** an incorrect 6-digit code, **When** submitted, **Then** the system rejects the request, decrements the remaining attempts, and informs the user of the remaining attempts without revealing internal details.
3. **Given** 5 consecutive incorrect code submissions, **When** the threshold is reached, **Then** the system triggers a 15-minute temporary lockout for that email identifier.
4. **Given** an expired reset code (>10 minutes old), **When** submitted, **Then** the system informs the user that the code has expired and prompts them to request a fresh code.

---

### User Story 3 - Resend Cooldown, Navigation & Direct URL Handling (Priority: P2)

As a user navigating the recovery flow,  
I want the ability to resend a code after a reasonable delay, switch to a different email address if I made a typo, or navigate between auth pages seamlessly,  
So that I never get stuck in a dead-end state.

**Why this priority**: Eliminates friction, handles user error (typos in email), and guarantees consistent navigation across `/forgot-password` and `/reset-password`.

**Independent Test**: Can be tested independently by verifying the resend button cooldown timer, the "Change email address" transition back to Step 1, and direct access to `/reset-password`.

**Acceptance Scenarios**:
1. **Given** the user is on Step 2 of recovery, **When** 60 seconds have elapsed since code dispatch, **Then** the resend action becomes active and allows requesting a new 6-digit code.
2. **Given** the user realized they typed the wrong email address, **When** they click "Change email address", **Then** the interface returns to Step 1 with the email input ready for correction while preserving existing state safety.
3. **Given** a user navigates directly to `/reset-password`, **When** the page loads, **Then** the user is seamlessly guided or redirected to the unified `/forgot-password` workflow.

---

## 3. Edge Cases

1. **Code Timing & Verification Delay**: The verification comparison must use constant-time string comparison (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.
2. **Code Single-Use**: Once a 6-digit OTP is successfully used to reset a password, it is immediately deleted and cannot be reused under any circumstance.
3. **Whitespace and Formatting**: Input fields for the 6-digit OTP must automatically strip non-numeric characters and whitespace, accepting both raw 6-digit numbers and space-separated digits (e.g., `123 456`).
4. **Repeated Clicks & Concurrent Submissions**: The submit button must disable and show a loading spinner while verification is in progress, preventing duplicate network requests.
5. **Session Invalidation**: When a user updates their password via OTP, any active authentication sessions must be invalidated (`passwordUpdatedAt` timestamp updated) so that compromised or abandoned sessions are terminated.
6. **Rate Limiting & Abuse Prevention**: IP-based rate limiting (5 requests per 60s) and email-based rate limiting (3 requests per 60s) protect against automated spamming and credit exhaustion.

---

## 4. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a Gmail address on `/forgot-password` (Step 1) and canonicalize it according to project standards (trim, lowercase, strip dots and plus tags).
- **FR-002**: System MUST generate a cryptographically secure 6-digit numeric OTP (`100000` to `999999`) with a 10-minute time-to-live upon valid recovery request.
- **FR-003**: System MUST deliver the 6-digit code via email using the established email dispatch service with professional formatting matching project brand standards.
- **FR-004**: System MUST transition the `/forgot-password` interface from Step 1 (email input) to Step 2 (code + password inputs) upon successful code generation.
- **FR-005**: System MUST provide a resend action on Step 2 governed by a 60-second cooldown timer.
- **FR-006**: System MUST provide a "Change email address" link on Step 2 to return to Step 1.
- **FR-007**: System MUST validate the 6-digit OTP using constant-time string comparison (`crypto.timingSafeEqual`).
- **FR-008**: System MUST enforce a maximum of 5 failed verification attempts before triggering a 15-minute temporary lockout.
- **FR-009**: System MUST validate that new passwords satisfy policy requirements (8 to 128 characters) and match the confirmation password field.
- **FR-010**: System MUST invalidate the verified reset code immediately upon successful password change (single-use).
- **FR-011**: System MUST invalidate all pre-existing sessions for the user upon password change.
- **FR-012**: System MUST eliminate all dependencies on email magic recovery links across `/api/auth/forgot-password`, `/api/auth/reset-password`, and UI pages.
- **FR-013**: Direct visits to `/reset-password` MUST cleanly redirect or direct the user to the unified `/forgot-password` flow.
- **FR-014**: All error messages MUST adhere to UX writing standards (clear, concise, helpful, zero technical plumbing leaks).

---

## 5. Key Entities

- **PasswordResetOtpEntry**:
  - `email`: Canonical Gmail address.
  - `otp`: Cryptographically generated 6-digit numeric string.
  - `createdAt`: Timestamp in milliseconds.
  - `expiresAt`: Expiration timestamp in milliseconds (createdAt + 10 minutes).
  - `lastSentAt`: Timestamp of last dispatch in milliseconds (for 60s cooldown).
  - `attempts`: Counter of incorrect verification attempts (max 5).
- **PasswordResetRequestContract**:
  - `email`: Canonical Gmail address.
  - `otp`: 6-digit numeric string.
  - `password`: String (8–128 characters).

---

## 6. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of password resets complete via 6-digit numeric OTP without requiring magic links or token-in-URL parsing.
- **SC-002**: End-to-end recovery time (from email submission to completed password reset) takes under 60 seconds under normal conditions.
- **SC-003**: 0% user enumeration vulnerability: identical positive UX response whether email is registered or unverified.
- **SC-004**: 100% compliance with quality gate: `pnpm turbo run build lint typecheck test` passes with zero errors and zero warnings.

---

## 7. Assumptions & Dependencies

- The email dispatch service (`apps/web/src/lib/email-service.ts`) is configured with Resend and operates gracefully in test/simulated mode when API keys are absent.
- The user's browser retains session state on `/forgot-password` across the two steps, requiring no cross-tab communication.
- Password hashing and session invalidation mechanisms follow the existing `apps/web/src/lib/supabase-auth.ts` patterns.
