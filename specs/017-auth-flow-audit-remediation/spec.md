# Feature Specification: Authentication Flow Audit Remediation

**Feature Branch**: `fix/017-auth-flow-audit-remediation`

**Created**: 2026-10-09

**Status**: Draft

**Input**: Comprehensive audit findings from `auth_flow_comprehensive_audit_report.md` addressing vulnerabilities, broken token handling, credential memory exposure, session desynchronization, and WCAG 2.2 AA accessibility gaps across `/login`, `/signup`, `/forgot-password`, and `/reset-password`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Redirect Defense and Post-Auth Routing Integrity (Priority: P1)

As a creator logging into FBUploadPro,
I want to be redirected exclusively to my authenticated tenant workspace or safe internal application routes after authentication,
So that malicious third-party links cannot hijack my browser session and redirect me to phishing websites.

**Why this priority**:
Prevents critical security compromise (CVSS 7.4). Attackers must never be able to abuse `returnUrl` to redirect authenticated users to external phishing destinations.

**Independent Test**:
Can be fully tested by attempting login and OTP verification with external redirect parameters (e.g. `returnUrl=https://evil.com/?victim`, `returnUrl=//evil.com`, `returnUrl=javascript:...`) and verifying the application safely falls back to the internal dashboard (`/dashboard`) or strictly permits valid relative paths.

**Acceptance Scenarios**:
1. **Given** an unauthenticated user on `/login?returnUrl=/media`, **When** they submit valid credentials, **Then** they are redirected to `https://{subdomain}.{rootDomain}/media`.
2. **Given** an unauthenticated user on `/login?returnUrl=https://attacker.com/?subdomain`, **When** they submit valid credentials, **Then** the application ignores the external domain and redirects to `https://{subdomain}.{rootDomain}/dashboard`.
3. **Given** a new user on `/signup` completing OTP verification with `returnUrl=//evil.com`, **When** OTP is verified, **Then** the application rejects protocol-relative redirect and routes to the user's workspace dashboard.

---

### User Story 2 - Password Recovery Lifecycle and Secure Token Reset Flow (Priority: P1)

As a registered creator who forgot their password,
I want to receive a secure recovery link, open `/reset-password`, have my recovery token verified, and set a new password,
So that I can regain access to my workspace safely without dead ends, 500 errors, or exposure to arbitrary password overrides.

**Why this priority**:
Restores a broken core authentication journey (password recovery fails 100% in production) and eliminates the arbitrary password overwrite risk in fallback environments.

**Independent Test**:
Can be fully tested by requesting a reset link on `/forgot-password`, navigating to `/reset-password` with a valid recovery token, submitting a new password of 8+ characters, and confirming successful update and redirect to `/login`. Testing without a token or with a tampered token must present an explicit invalid token state.

**Acceptance Scenarios**:
1. **Given** a user navigating directly to `/reset-password` without a recovery token or code, **When** the page mounts, **Then** an informative warning state is displayed explaining the link is missing or expired, with a primary button to request a new link.
2. **Given** a user opening `/reset-password?code=valid-recovery-code` (or hash `#access_token=...`), **When** they submit matching 8+ character passwords, **Then** the token is verified, credentials are updated, and they are redirected to `/login`.
3. **Given** an attacker submitting `POST /api/auth/reset-password` with `{ email: "victim@gmail.com", password: "pwned" }` without a valid token, **Then** the API rejects the request with HTTP 400/401 unauthorized.
4. **Given** a client sending rapid repeated requests to `POST /api/auth/reset-password`, **When** requests exceed 5 in 60 seconds, **Then** the API enforces rate limiting with HTTP 429.

---

### User Story 3 - In-Memory Credential Zero-Retention in OTP Staging (Priority: P1)

As a security-conscious SaaS platform operator,
I want user registration passwords to be pre-hashed immediately upon form receipt before being held in OTP staging memory,
So that cleartext passwords never linger in unhashed server memory during the 10-minute verification window, complying strictly with Constitution Principle X.

**Why this priority**:
Enforces Constitution Principle X ("Cleartext passwords must never linger in unhashed memory") and shields customer credentials from memory dumps or process inspection attacks.

**Independent Test**:
Can be tested by initiating registration on `/api/auth/signup` and inspecting the pending registration staging store: the stored password must be a cryptographic PBKDF2 hash, not plaintext.

**Acceptance Scenarios**:
1. **Given** a new user submitting the registration form, **When** `/api/auth/signup` stages the pending registration, **Then** the password is pre-hashed via PBKDF2 and only the hash is retained in memory.
2. **Given** a user verifying their 6-digit OTP, **When** `/api/auth/signup/verify-otp` provisions the user, **Then** the pre-hashed password is saved directly to the database without requiring cleartext regeneration.

---

### User Story 4 - Session Synchronization and Password Reset Invalidation (Priority: P2)

As an authenticated creator,
I want my session cookie and signed JWT token to have matching 30-day lifespans, and I want existing active sessions to be invalidated whenever I change my password,
So that my session does not abruptly expire after 24 hours and unauthorized active sessions on other devices are terminated upon password reset.

**Why this priority**:
Resolves unexpected session drops (24h JWT vs 30d cookie) and ensures account recovery terminates potentially compromised sessions.

**Independent Test**:
Can be tested by generating a session token and verifying its `exp` is 30 days (`now + 2592000`). When a password reset occurs, previous session tokens are invalidated.

**Acceptance Scenarios**:
1. **Given** a user logging in, **When** the session token is signed, **Then** the JWT `exp` timestamp is set to 30 days, matching the `fbup_session` cookie `maxAge`.
2. **Given** a user with active sessions on multiple devices, **When** they successfully reset their password, **Then** all previous session tokens become invalid.

---

### User Story 5 - WCAG 2.2 AA Accessibility & Usability Hardening (Priority: P2)

As a creator with accessibility needs or navigating via keyboard/mobile,
I want clear helper text, properly associated form labels, correct autocomplete attributes, visible focus indicators, safe external legal links, and adequate touch targets,
So that I can complete authentication smoothly without disorientation, data loss, or accessibility barriers.

**Why this priority**:
Ensures compliance with WCAG 2.2 AA standards, prevents accidental form data loss on legal links, and provides clear, accessible form interaction.

**Independent Test**:
Can be tested by inspecting DOM labeling (`htmlFor`), tabbing through all controls to verify visible focus rings, testing legal link navigation (`target="_blank"`), and verifying autocomplete behavior with password managers.

**Acceptance Scenarios**:
1. **Given** a user entering details on `/signup`, **When** they click "Terms of Service" or "Privacy Policy", **Then** the legal documents open in a new tab without navigating away or losing form input.
2. **Given** a user on `/login`, **When** they view the email field, **Then** static helper text clarifies that only `@gmail.com` accounts are supported.
3. **Given** a user inspecting the DOM on `/login`, **When** examining the password field, **Then** the label has an explicit `htmlFor` pointing to the password input ID.
4. **Given** a user on `/forgot-password` or `/reset-password`, **When** browser autofill runs, **Then** `autoComplete="email"` and `autoComplete="new-password"` are present.
5. **Given** a keyboard user tabbing through password fields, **When** focusing the visibility toggle eye button, **Then** a visible focus ring is clearly displayed.
6. **Given** an API request to `POST /api/auth/login`, **When** the password exceeds 128 characters, **Then** the request is rejected with 400 Bad Request by `LoginRequestSchema`.
7. **Given** a mobile user tapping secondary action buttons ("Return to form", "Try a different email"), **When** measuring target dimensions, **Then** touch target heights meet WCAG 2.2 minimums (padding >= 8px 12px).

---

### Edge Cases

- **Open redirect attempts**:
  - `returnUrl=//evil.com` -> rejected, defaults to dashboard.
  - `returnUrl=https://attacker.com/user_subdomain` -> rejected, defaults to dashboard.
  - `returnUrl=/dashboard/reels` -> accepted, redirects to `https://{subdomain}.{rootDomain}/dashboard/reels`.
  - `returnUrl=https://{subdomain}.{rootDomain}/dashboard` -> accepted.
- **Direct visit to `/reset-password`**:
  - No query param `code` and no hash `access_token` -> displays clean "Invalid or Expired Link" warning card with "Request new link" action.
- **Expired/Tampered reset token**:
  - Exchange fails -> displays "Invalid or expired recovery code" with recovery button.
- **Excessive reset requests**:
  - 6 requests in 60s to `POST /api/auth/reset-password` -> returns 429 Too Many Requests.
- **Legal links during signup**:
  - Clicking Terms or Privacy opens new browser tab; all input values (name, phone, email, password) remain intact in active form.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST strictly validate `returnUrl` on login and signup OTP verification, allowing only relative paths starting with a single forward slash (`/`) and disallowing protocol-relative URLs (`//`) or external origins unless strictly matching `https://{user.subdomain}.{rootDomain}/*`.
- **FR-002**: System MUST parse recovery tokens on `/reset-password` from both search parameters (`code`) and hash fragments (`access_token`).
- **FR-003**: System MUST display an explicit "Invalid or Expired Link" state on `/reset-password` whenever a valid token is not present on page load, rather than rendering an active password entry form.
- **FR-004**: System MUST verify the recovery token on `POST /api/auth/reset-password` prior to updating user credentials and MUST reject any password change attempt lacking a valid, verified token.
- **FR-005**: System MUST enforce IP rate limiting on `POST /api/auth/reset-password` (maximum 5 requests per 60 seconds).
- **FR-006**: System MUST pre-hash passwords using PBKDF2 in `createPendingSignup` before persisting to staging memory in `pendingSignups`, storing zero plaintext passwords in heap memory.
- **FR-007**: System MUST synchronize JWT session expiration to 30 days (`expiresInSeconds: 86400 * 30`) matching the `fbup_session` cookie `maxAge`.
- **FR-008**: System MUST record a `password_updated_at` timestamp upon password change and invalidate pre-existing session tokens issued prior to that timestamp.
- **FR-009**: System MUST render Terms of Service and Privacy Policy links in `SignupPage` with `target="_blank"` and `rel="noopener noreferrer"`.
- **FR-010**: System MUST associate the password label on `LoginPage` with `htmlFor` referencing the input ID.
- **FR-011**: System MUST provide proactive helper text on the `LoginPage` email field stating `@gmail.com` account support.
- **FR-012**: System MUST provide `autoComplete="email"` on `/forgot-password` and `autoComplete="new-password"` on `/reset-password`.
- **FR-013**: System MUST render a visible `:focus-visible` ring on password visibility toggle buttons.
- **FR-014**: System MUST enforce `.max(128)` on the `password` property in `LoginRequestSchema`.
- **FR-015**: System MUST ensure secondary recovery action buttons have interactive padding meeting minimum touch target requirements.

### Key Entities

- **AuthSession**: Represents an authenticated user session containing `userId`, `email`, `subdomain`, `role`, `status`, `iat`, `exp`, and `authTime`.
- **PendingSignup**: Staging record for user registration containing user details, PBKDF2 `hashedPassword` (never plaintext), cryptographic 6-digit OTP, expiration timestamp, and attempt counters.
- **PasswordResetRequest**: Token-bound recovery state verifying customer intent before credential mutation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of open redirect exploits via `returnUrl` fail, strictly constraining post-auth navigation to internal tenant workspace routes.
- **SC-002**: Password reset end-to-end user journey completes with 100% success rate when initiated via valid recovery links.
- **SC-003**: 0 plaintext passwords exist in server heap memory across all active states of the registration OTP staging service.
- **SC-004**: 100% compliance with WCAG 2.2 AA accessibility criteria across all four authentication pages (label binding, autocomplete attributes, visible focus indicators, and touch targets).
- **SC-005**: Zero broken links, zero data loss upon legal terms inspection, and zero technical plumbing leaked in error messages.
- **SC-006**: 100% test pass rate across all unit, component, integration, and security test suites with 0 linter errors and 0 typecheck warnings.

## Assumptions

- FBUploadPro runs in a hybrid environment supporting Supabase Auth / PostgreSQL in production, with in-memory resilient fallbacks for offline test execution.
- Session tokens are verified at the gateway and middleware layers before routing requests to private tenant subdomains.
- Email verification codes and password recovery messages are dispatched via Resend and Supabase Auth.
