# Feature Specification: Auth UX Refinement, Inline Error Highlighting & Edge-Case Hygiene (Spec 016)

**Feature Branch**: `feat/016-auth-ux-refinement-inline-errors-and-edge-cases`  
**Created**: 2026-10-09  
**Status**: Approved  
**Input**: Comprehensive UX & Security audit of authentication pages (`/login`, `/signup`, `/forgot-password`, `/reset-password`):
1. **Eliminate Annoying Alert/Modal Error Boxes**: Replace large, jarring `<Alert severity="error">` banners that push layout down like dialogues with field-level inline error styling.
2. **Field-Specific Red Highlighting & Error Text**: When validation fails on any field (email, phone, name, password, confirmPassword), highlight that specific input field red (`border: 1px solid var(--accent-3)`, `aria-invalid="true"`, red focus ring) and display clear, human-grade error text directly beneath the field (`<span role="alert">`).
3. **Robust Phone Number Edge-Case Validation**: Fix phone validation on `/signup` so that non-numbers (`asdf`), missing country code, or incomplete numbers (`+32433`) immediately highlight the phone field with specific, actionable feedback without generic "Validation failed" alerts.
4. **End-to-End Server Error Mapping**: Ensure backend Zod validation failures (`400 Bad Request` with `{ error: 'Validation failed', details: { ... } }`) are parsed and mapped field-by-field directly to corresponding form inputs.
5. **Remove Password Strength Checker**: Completely eliminate the noisy `PasswordStrengthMeter` visual component from the signup page and codebase, relying on clear static requirements ("Minimum 8 characters") and inline error states.
6. **Non-Disruptive General Error Callout**: General form-level failures (invalid credentials, rate-limiting, network drop) render as compact, non-disruptive inline callouts positioned directly above the submit button without jarring layout displacement.
7. **Hybrid Real-Time Error Clearing**: Once an error is displayed, typing or correcting the input automatically clears the error state and re-validates live so users have immediate positive feedback.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Field-Level Inline Error Highlighting on Form Submission (Priority: P1) 🎯 MVP

As a user filling out authentication forms (signup, login, forgot-password, reset-password), when I submit invalid or empty fields, the offending fields are immediately outlined in red with precise error messages positioned directly beneath each field. I do not see a bulky top alert box pushing the layout around.

**Why this priority**:
Standard SaaS UX (Linear, Stripe, GitHub). Prevents jarring visual shifts and instantly directs the user's attention to exactly what needs fixing.

**Independent Test**:
1. Navigate to `/signup` and click "Create Account" with empty fields -> "Full Name", "Phone Number", "Email Address", "Password", and "Confirm Password" are each highlighted with red borders and localized error labels below their inputs.
2. Verify no top alert banner or dialog box appears.
3. Navigate to `/login` and submit an empty form -> Both email and password fields highlight in red with inline messages.

**Acceptance Scenarios**:
1. **Given** any authentication form with an invalid field,  
   **When** the user submits the form,  
   **Then** the offending input renders with `aria-invalid="true"`, red border (`PALETTE.accent3`), and an accessible `<span role="alert">` directly underneath.
2. **Given** field-specific validation errors,  
   **When** rendered,  
   **Then** no top `<Alert severity="error">` is displayed.

---

### User Story 2 - Comprehensive Phone Number Edge Cases & E.164 Validation (Priority: P1) 🎯 MVP

As a user signing up, if I enter letters (`asdf`), incomplete country codes (`+`), or invalid international numbers (`+32433`), the phone input field immediately highlights in red with actionable guidance (e.g. "Please enter a valid international phone number with country code, e.g. +1 555 123 4567"). The form never submits invalid phone formats to the backend or shows a generic "Validation failed" banner.

**Why this priority**:
Directly addresses user-reported bug where typing `asdf` produced an alert dialog and `+32433` produced a cryptic "Validation failed" banner.

**Independent Test**:
1. Enter `asdf` in phone field -> On submit or blur, phone field highlights red: "Phone number must include an international calling code starting with + (e.g. +1 555 123 4567)".
2. Enter `+32433` in phone field -> Phone field highlights red: "Please enter a valid international phone number with a recognized country code and full digit length".
3. Enter `+1 (555) 234-5678` -> Accepted and formatted cleanly to E.164.

**Acceptance Scenarios**:
1. **Given** non-numeric or malformed phone input (e.g. `asdf`),  
   **When** validated,  
   **Then** the phone input field displays a red border and specific inline helper message.
2. **Given** an incomplete or invalid country code / digit length (e.g. `+32433`),  
   **When** evaluated via `libphonenumber-js` client-side validation,  
   **Then** the phone field highlights red with descriptive inline error text before any network request is fired.

---

### User Story 3 - Full Server-to-Client Validation Error Mapping (Priority: P1) 🎯 MVP

As a user submitting a form, if the server returns HTTP 400 with structured validation details (`{ error: 'Validation failed', details: { fieldName: ['Error text'] } }`), the frontend maps every error directly to its respective form field, highlighting the field in red with the server-provided message.

**Why this priority**:
Eliminates cryptic "Validation failed" banners and guarantees seamless synchronization between client-side and server-side Zod validation contracts.

**Independent Test**:
1. Mock or trigger a server 400 response with `{ details: { email: ['Only @gmail.com accounts are permitted'] } }` -> Email input displays red border and inline message "Only @gmail.com accounts are permitted".
2. Ensure top-level error state remains null or only displays unmapped general errors.

**Acceptance Scenarios**:
1. **Given** a 400 response containing `details`,  
   **When** parsed by the form submit handler,  
   **Then** errors are assigned to `fieldErrors[field]` and reflected inline.

---

### User Story 4 - Removal of Password Strength Checker (Priority: P1) 🎯 MVP

As a user signing up, the password field is clean, predictable, and uncluttered. The visual `PasswordStrengthMeter` (bars, checklist, colored labels) is completely removed. Password criteria are clearly and quietly stated via helper text: "Minimum 8 characters".

**Why this priority**:
Direct user instruction to remove the distracting password strength checker while preserving necessary security minimums (8+ characters).

**Independent Test**:
1. Open `/signup` -> Verify `PasswordStrengthMeter` component is absent from DOM.
2. Enter various password values -> Verify no color-coded strength meters or criteria checklists appear.

**Acceptance Scenarios**:
1. **Given** the `/signup` page,  
   **When** rendered,  
   **Then** no `PasswordStrengthMeter` is displayed.

---

### User Story 5 - Non-Disruptive Compact Inline General Error Callouts (Priority: P2)

As a user, when an overall form error occurs (such as "Invalid email or password", "Too many attempts. Please wait 45 seconds", or connection failure), the error appears as a sleek, compact callout immediately above the primary action button, with no heavy alert box pushing form controls out of place.

**Why this priority**:
Prevents disruptive layout shifts and matches modern SaaS design standards (Linear, Stripe).

**Independent Test**:
1. Enter wrong password on `/login` -> A compact error callout appears right above the "Sign In" button: "Invalid email or password. Please try again."
2. The email and password input fields are preserved in place without jarring downward layout jumps.

**Acceptance Scenarios**:
1. **Given** a general authentication failure,  
   **When** received,  
   **Then** a compact inline message appears above the submit button styled cleanly with `PALETTE.accent3`.

---

### User Story 6 - Hybrid Live Error Clearing on Keystroke (Priority: P2)

As a user who has triggered an inline field error, as soon as I begin typing or editing that field, the red error state clears or updates live so I know immediately that my correction is registered.

**Why this priority**:
Chosen by the user in Phase 0 pre-flight interview: hybrid validation providing immediate, encouraging feedback.

**Independent Test**:
1. Submit empty email -> Email turns red with "Please enter your Gmail address".
2. Type a character in email -> Red border and error message disappear immediately.

**Acceptance Scenarios**:
1. **Given** a field currently in an error state,  
   **When** `onChange` fires on that field,  
   **Then** `fieldErrors[fieldName]` is cleared.

---

## Edge Cases & Boundary Conditions

1. **Phone International Prefix Variations**:
   - `+1 (555) 123-4567` (with spaces/parentheses/dashes) -> Valid E.164.
   - `+` alone -> Flagged as incomplete country code.
   - Letters/symbols (e.g. `+1-foo-bar`) -> Rejected inline.
   - Too short (`+32433`) -> Rejected inline with specific error.
   - Valid foreign numbers (e.g. `+92 300 1234567`, `+44 7911 123456`) -> Formatted and validated cleanly.
2. **Gmail Specific Validation**:
   - `test@yahoo.com` -> Inline error on email: "Only @gmail.com (or @googlemail.com) accounts are supported".
   - `user@gmail` (incomplete) -> Inline error: "Please enter a valid Gmail address".
   - `user@gmail.com` with whitespace -> Trimmed automatically.
3. **Password Mismatch on Signup & Reset**:
   - `password !== confirmPassword` -> Inline error directly on "Confirm Password": "Passwords do not match".
4. **Rate Limiting & Cooldowns**:
   - 429 response -> Displayed in compact callout above action button with live countdown timer if `retryAfterSeconds` is present.
5. **Session Expiry / Password Reset Tokens**:
   - Missing or expired reset token on `/reset-password` -> Shows calm, user-friendly guidance to request a new recovery link.
