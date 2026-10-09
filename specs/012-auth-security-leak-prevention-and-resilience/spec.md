# Feature Specification: Auth Security Leak Prevention & Fault-Tolerant Resilience (Spec 012)

**Feature Branch**: `feat/012-auth-security-leak-prevention-and-resilience`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Couldn't sign you in: connect ECONNREFUSED 127.0.0.1:5432 what is this i told you never reveal anything to user and always cover test cases in spec driven development"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Zero Technical Plumbing Leaks on Failure (Priority: P1) 🎯 MVP

As an authentication customer, when the underlying authentication infrastructure, database, or network experiences an unexpected failure or outage, I see a professional, reassuring, customer-focused error message, and never see internal backend plumbing, IP addresses, database port numbers, or system exception details.

**Why this priority**:
Violating zero technical leak standards degrades trust, damages commercial product perception, and creates security enumeration vulnerabilities by disclosing internal infrastructure architecture.

**Independent Test**:
Can be fully tested by simulating a total database outage (e.g. simulated network partition or connection refusal) during sign-in and sign-up requests. The response body and rendered UI must only present human-friendly error copy with zero technical terminology.

**Acceptance Scenarios**:

1. **Given** the database or authentication service is unreachable (e.g., connection refused or network timeout),  
   **When** a user submits valid or invalid credentials on `/login`,  
   **Then** the server logs the detailed error internally and returns an HTTP 500 response containing a sanitized message: `"Unable to sign in at this moment. Please try again shortly."`
2. **Given** an error response is returned to the browser,  
   **When** the login or signup page renders the error alert,  
   **Then** the rendered text contains zero technical tokens (`ECONNREFUSED`, `127.0.0.1`, `5432`, `SELECT`, `INSERT`, `postgres`, `socket`, `error:`).
3. **Given** a user inputs bad credentials (wrong password or unregistered email),  
   **When** submitting the sign-in form,  
   **Then** the response and UI display a clean credential message: `"Invalid email or password. Please try again."` without disclosing account existence.

---

### User Story 2 - Fault-Tolerant Multi-Runtime Data Access (Priority: P2)

As a cloud user, when accessing the application on serverless platforms (e.g., Vercel) where Supabase HTTPS credentials are configured, the authentication service executes queries through Supabase HTTPS client queries rather than attempting direct unconfigured local TCP connections to `127.0.0.1:5432`.

**Why this priority**:
Serverless environments do not run local PostgreSQL daemons on port 5432. The system must adaptively query Supabase via HTTPS when Supabase service credentials are provided, guaranteeing high availability across local, serverless, and preview deployments.

**Independent Test**:
Can be verified by executing user lookup, registration, and subdomain resolution with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set, ensuring operations execute over HTTPS without requiring a local port 5432 socket.

**Acceptance Scenarios**:

1. **Given** Supabase HTTPS credentials are present,  
   **When** authenticating or registering a user,  
   **Then** user records and storage quotas are queried and persisted via the Supabase client without attempting connections to `127.0.0.1:5432`.
2. **Given** Supabase HTTPS is unreachable or database queries fail,  
   **When** the failure occurs,  
   **Then** the error is captured gracefully without unhandled exception crashes.

---

### User Story 3 - Client-Side Defensive Message Sanitization (Priority: P3)

As a user on any authentication screen (`/login`, `/signup`, `/forgot-password`, `/reset-password`), even if an unexpected external API, proxy, or gateway emits an unformatted error string, the frontend defensive boundary filters and normalizes the message into a human-friendly string.

**Why this priority**:
Defense-in-depth: ensures that even if a future proxy, CDN, or third-party service bypasses backend formatting, raw technical dumps can never be rendered into the user interface.

**Independent Test**:
Can be tested by injecting raw technical error strings into the error alert state and verifying that the sanitized text renders user-friendly copy.

**Acceptance Scenarios**:

1. **Given** an API returns `{ "error": "connect ECONNREFUSED 127.0.0.1:5432" }`,  
   **When** rendered by the client,  
   **Then** the UI displays `"Unable to complete your request at this moment. Please try again shortly."`

---

## Edge Cases

- **Database Connection Refusal (`ECONNREFUSED`)**: Must be caught on server, logged to `console.error('[Auth Error]')`, and mapped to a friendly 500 status message.
- **Connection Timeout (`ETIMEDOUT`)**: Handled identically to connection refusal with zero leak.
- **Account Suspended**: Returns specific 403 status with clean user copy: `"Your account is suspended. Please contact support."` and redirect URL.
- **Duplicate Email Registration**: Returns 409 status with: `"This email address is already registered. Please sign in instead."`
- **Password Complexity Under 8 Characters**: Returns 400 status with: `"Password must be at least 8 characters long."`
- **Unknown Error Type**: Any non-Error or unexpected exception caught is safely cast and rendered as generic friendly error.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST sanitize all error responses across `/api/auth/login`, `/api/auth/signup`, `/api/auth/forgot-password`, and `/api/auth/reset-password`, preventing any technical plumbing leakage.
- **FR-002**: System MUST log detailed internal error messages to server console for operational observability while sending only sanitized messages to clients.
- **FR-003**: System MUST prioritize Supabase HTTPS client (`@supabase/supabase-js`) for user lookup and provisioning when Supabase environment credentials are present.
- **FR-004**: System MUST provide a client-side defensive error sanitization utility (`sanitizeAuthErrorMessage`) applied across all auth UI forms.
- **FR-005**: All test suites MUST assert that zero technical keywords appear in user-facing responses or components under failure conditions.

### Key Entities

- **AuthErrorEnvelope**: Standardized JSON response structure `{ success: false, error: string, details?: Record<string, string[]> }` with strictly sanitized `error` messages.
- **SanitizedErrorMessage**: Client-safe human copy free of infrastructure, database, or technical plumbing terms.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of authentication error responses contain zero technical plumbing terminology (`ECONNREFUSED`, `127.0.0.1`, `5432`, `SELECT`, `INSERT`, `postgres`, `socket`).
- **SC-002**: 100% of test suites covering simulated connection failures pass with zero unhandled exceptions.
- **SC-003**: User sign-in succeeds over Supabase HTTPS in cloud/serverless environments without requiring a local port 5432 TCP socket.
- **SC-004**: All project quality gates (`pnpm turbo run build lint typecheck test`) pass with zero errors.

---

## Assumptions

- Supabase service role key and project URL are provided in production and preview environments on Vercel.
- When local PostgreSQL is available via `DATABASE_URL`, direct database client queries execute seamlessly.
- Client-side defensive sanitizer functions synchronously and requires zero network requests.
