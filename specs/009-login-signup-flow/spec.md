# Feature Specification: Supabase Authentication, Login & Registration Flow

**Feature Branch**: `feat/login-signup-flow`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Fully working login and sign up page using Supabase authentication. Registration requires Name, Phone number, Email, and Password. Subdomain is automatically derived from email (stripping dots and plus signs/tags). Root domain cookie sharing (.fbuploadpro.com) with HttpOnly, Secure, SameSite=Lax for seamless tenant subdomain access. Immediately redirect to user's tenant workspace ({subdomain}.domain.com), honoring returnUrl if provided."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tenant Registration with Automatic Subdomain Derivation (Priority: P1) 🎯 MVP

A new user visits the platform sign-up portal (`/signup` or `app.fbuploadpro.com/signup`). They enter their Full Name, Phone Number, Email Address, and Password. As the user types their email, the system automatically derives and previews their tenant workspace subdomain in real time (e.g., `jane.doe+campaigns@agency.com` becomes `janedoe.fbuploadpro.com`). Upon clicking "Create Workspace", the system creates the user identity via Supabase Auth, provisions their tenant record in the database with role `user` and status `active`, initializes default storage quotas (5GB / 50 media assets), establishes an authenticated session cookie scoped to the root domain (`.fbuploadpro.com`), and automatically redirects them into their isolated workspace (`janedoe.fbuploadpro.com`).

**Why this priority**: Registration is the fundamental entry point for acquiring users and provisioning tenant workspaces. Without automated registration and subdomain generation, new operators cannot access the platform.

**Independent Test**: Can be tested independently by submitting the registration form via browser or calling `POST /api/auth/signup` with valid credentials, verifying that the user and tenant rows are inserted into the database, confirming the session cookie is set with root-domain scope, and asserting that the response redirects to the derived tenant workspace URL.

**Acceptance Scenarios**:

1. **Given** a new visitor on `/signup`, **When** they input `John Doe`, `+15551234567`, `john.doe+reels@example.com`, and a valid password, **Then** the interface dynamically derives the subdomain slug `johndoe` and renders a live preview badge `johndoe.fbuploadpro.com`.
2. **Given** valid registration inputs, **When** the user submits the form, **Then** Supabase Auth registers the user, a corresponding record is created in `public.users` with `role = 'user'`, `status = 'active'`, and derived subdomain `johndoe`, and default media quotas (5GB) are initialized in `storage_quotas`.
3. **Given** successful registration, **When** the session response completes, **Then** an HTTP-only, Secure session cookie (`fbup_session` / Supabase auth session) scoped to the root domain (`Domain=.fbuploadpro.com`) is set, and the client is automatically redirected to `http(s)://johndoe.{rootDomain}`.
4. **Given** an email address whose derived username collides with an existing tenant subdomain (e.g. `johndoe` already exists), **When** evaluated during derivation or submission, **Then** the system automatically resolves the collision by appending a deterministic numeric increment (e.g., `johndoe1`, `johndoe2`) or displays an informative availability status.
5. **Given** an invalid email, duplicate registered email, weak password (<8 characters), or invalid phone format, **When** submitted, **Then** the system prevents submission, displays clear inline validation errors, and presents an error banner using the `Alert` component without losing user input.

---

### User Story 2 - Tenant Workspace Sign-In & Multi-Tenant Session Transfer (Priority: P2)

An existing operator navigates to the sign-in page (`/login` or `app.fbuploadpro.com/login`). They provide their registered email address and password. The system verifies their credentials via Supabase Authentication, retrieves their associated tenant subdomain and profile from the database, asserts their account status is `active`, sets the root-domain session cookie, and immediately redirects them to their tenant workspace (`{subdomain}.fbuploadpro.com`). If the user arrived at `/login` via an intercepted protected URL (e.g. `?returnUrl=https://acme.fbuploadpro.com/media`), the system validates the return URL and redirects them to their intended destination upon successful authentication.

**Why this priority**: Registered users must be able to sign back into their tenant workspaces securely from any device or browser session without friction.

**Independent Test**: Can be tested independently by submitting valid and invalid email/password pairs to `POST /api/auth/login` and verifying session cookie creation, HTTP status codes, error messaging for invalid credentials, and accurate workspace URL redirection.

**Acceptance Scenarios**:

1. **Given** an active registered user, **When** they enter their correct email and password on `/login`, **Then** the system authenticates the user with Supabase, issues a root-domain session cookie, and redirects them to their tenant workspace (`{subdomain}.{rootDomain}`).
2. **Given** an unauthenticated visitor who was redirected from `{subdomain}.{rootDomain}/media` with `?returnUrl=...`, **When** they successfully log in, **Then** the system redirects them directly to the specified `returnUrl` within their authorized workspace.
3. **Given** invalid credentials (incorrect password or unregistered email), **When** submitted, **Then** the system returns a sanitized 401 Unauthorized error and displays a visible `Alert` banner with "Invalid email or password", preserving the entered email in the input.
4. **Given** a user whose account is marked `suspended` in `public.users`, **When** attempting to log in, **Then** authentication is halted, no tenant session is granted, and the user is redirected to `/account-suspended` with a clear contact administrator notice.
5. **Given** repeated failed login attempts, **When** rate limits are triggered, **Then** the system renders a rate-limit warning informing the user to wait before retrying.

---

### User Story 3 - Production-Grade Dual-Theme UI with Spec 008 Primitives (Priority: P3)

The login and registration pages are crafted to high-design standards utilizing the newly merged Spec 008 reusable UI components (`Card`, `Input`, `Button`, `Alert`, `StatusDot`). The pages strictly adhere to the Binance Precision Dual-Theme (Pitch Black `#000000` / Precision White `#ffffff` with Primary Gold `#fad734` accents and unboxed 6px status dots). Forms feature full keyboard accessibility, clear visual hierarchy, password show/hide eye toggles, interactive loading states (`isLoading={isSubmitting}`), client-side field validation before submission, and a clean theme-aware layout.

**Why this priority**: High-craft frontend presentation eliminates "generic AI visual slop", establishes brand credibility, and guarantees accessibility compliance (WCAG AAA contrast on primary actions) for all users.

**Independent Test**: Can be tested by visually inspecting both pages in dark and light modes, verifying tab key navigation order, testing password visibility toggle clicks, and verifying error banners and button loading spinner transitions.

**Acceptance Scenarios**:

1. **Given** the login or signup page, **When** rendered in either dark or light mode, **Then** all background colors, typography, borders, and input surfaces strictly consume tokens from `@web/lib/theme` (`PALETTE`, `COMPONENT_STYLES`, `RADII`, `SPACING`, `TYPOGRAPHY`) with zero ad-hoc hex literals or capsule pill badges.
2. **Given** the password field on either form, **When** the user clicks the eye icon toggle button, **Then** the password input switches between masked `type="password"` and plain text `type="text"`, with `aria-label` updating accordingly.
3. **Given** an active form submission, **When** the network request is in flight, **Then** the primary action button displays a luminous spinner (`isLoading={true}`), inputs are disabled to prevent duplicate submissions, and the form cannot be resubmitted until completion.
4. **Given** keyboard-only interaction, **When** navigating with `Tab`, `Shift+Tab`, and `Enter`, **Then** focus outlines strictly use the 3px Primary Gold ring (`rgba(250, 215, 52, 0.35)`), and pressing `Enter` within any field submits the form.

---

### User Story 4 - Session Sign-Out & Cross-Subdomain Invalidation (Priority: P4)

An authenticated user can securely terminate their session from any tenant workspace or platform page. When initiating sign-out, the system calls Supabase Auth `signOut()`, clears the `fbup_session` cookie across the entire root domain (`Domain=.fbuploadpro.com`, `Path=/`, `Max-Age=0`), invalidates any server-side session cache, and redirects the user cleanly back to the central gateway login page (`app.fbuploadpro.com/login`).

**Why this priority**: Secure session termination is vital for shared devices, security compliance, and preventing session hijacking.

**Independent Test**: Can be tested by executing sign-out, verifying that the `fbup_session` cookie is expired via response headers, and verifying that subsequent requests to protected tenant routes return 401 or redirect to `/login`.

**Acceptance Scenarios**:

1. **Given** an active authenticated session, **When** the user triggers sign-out via `POST /api/auth/logout`, **Then** the server clears the `fbup_session` cookie with `Max-Age=0` and `Domain=.fbuploadpro.com`.
2. **Given** a cleared session, **When** the browser navigates to `{subdomain}.fbuploadpro.com`, **Then** Next.js middleware intercepts the unauthenticated request and redirects the user to `app.fbuploadpro.com/login`.

---

### Edge Cases

- **Special Characters in Email Username**: Emails with dots (`john.doe@domain.com`), plus signs (`john+fb@domain.com`), underscores, or symbols must be sanitized: all dots and plus tags are stripped (`john.doe` -> `johndoe`, `john+fb` -> `john`), symbols removed, and the slug truncated to valid subdomain constraints (`[a-z0-9-]{3,50}`).
- **Subdomain Slug Collisions**: If `john@domain1.com` and `john@domain2.com` register, both derive `john`. The system must check existing subdomains in `public.users` and automatically append a numerical suffix (`john1`, `john2`) or prompt the user.
- **Reserved Subdomain Protection**: If an email derives a reserved platform slug (e.g. `admin@domain.com` -> `admin`, `api@domain.com` -> `api`, `app@domain.com` -> `app`), the system must prevent assignment of reserved slugs and append a suffix (e.g. `admin1`) or prompt for a customized slug.
- **Root Domain vs Localhost Cookie Scoping**: In production, cookies are scoped to `Domain=.fbuploadpro.com`; in local development, cookies must omit the domain attribute or use `localhost` so cookies persist seamlessly across `localhost:3000` and `test.localhost:3000`.
- **Supabase Auth vs PostgreSQL Synchronization**: If Supabase Auth succeeds but the database insert fails (e.g., transient database error), the system must cleanly handle the error, rollback or delete the orphaned Supabase user, and return a graceful error message to the user without leaving corrupt state.
- **Session Expiration During Active Use**: If a session expires while an operator is in the workspace, subsequent API requests return 401 with `WWW-Authenticate`, and client navigation redirects to `/login?returnUrl=...`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide dedicated, production-ready `/login` and `/signup` routes in `apps/web`.
- **FR-002**: The registration form MUST require Full Name (`name`), Phone Number (`phone`), Email (`email`), and Password (`password`).
- **FR-003**: The system MUST automatically derive the tenant workspace subdomain slug from the email address by extracting the username part before `@`, stripping all dots (`.`), stripping all plus tags (`+tag`), converting to lowercase alphanumeric characters, and truncating to between 3 and 50 characters.
- **FR-004**: The system MUST validate that the derived subdomain slug does not collide with reserved platform subdomains (`app`, `api`, `admin`, `billing`, `auth`, `www`, `docs`, `status`) or existing tenant subdomains in `public.users`, appending a numeric increment if a collision occurs.
- **FR-005**: The system MUST authenticate users and manage password credentials via Supabase Authentication (`@supabase/supabase-js` / `@supabase/ssr`).
- **FR-006**: Upon successful registration, the system MUST synchronize the user record into `public.users` (`id`, `email`, `name`, `subdomain`, `role = 'user'`, `status = 'active'`) and initialize the default storage quota (5GB / 50 assets) in `public.storage_quotas`.
- **FR-007**: The system MUST issue an authenticated session cookie (`fbup_session`) signed cryptographically and scoped to the root domain (`Domain=.fbuploadpro.com` in production, or omitted for `localhost`) with `HttpOnly = true`, `Secure = true` (in production), `SameSite = Lax`, and `Path = /`.
- **FR-008**: Upon successful authentication or registration, the system MUST redirect the user to their tenant workspace (`http(s)://{subdomain}.{rootDomain}`), or to the validated `returnUrl` parameter if supplied.
- **FR-009**: The system MUST block login for users whose account status is `suspended`, safely redirecting them to `/account-suspended`.
- **FR-010**: The login and registration interfaces MUST be built strictly using the Spec 008 reusable UI components (`Button`, `Input`, `Card`, `Alert`, `StatusDot`) and Binance Precision Dual-Theme tokens from `apps/web/src/lib/theme.ts`.
- **FR-011**: The system MUST provide a secure sign-out endpoint (`POST /api/auth/logout`) that invalidates the Supabase session, expires the root-domain session cookie (`Max-Age = 0`), and redirects to `/login`.
- **FR-012**: The system MUST sanitize all error responses, preventing any leakage of database connection details, Supabase service keys, or internal stack traces.

### Key Entities

- **User**: Represents the platform account. Key attributes: `id` (UUID from Supabase auth), `email` (string), `name` (string), `phone` (string, optional/meta), `subdomain` (string, unique), `role` (`user` | `seller` | `admin`), `status` (`active` | `suspended`), `created_at`, `updated_at`.
- **Derived Subdomain**: The tenant identifier computed from email. Formula: `sanitize(email.split('@')[0].replace(/\./g, '').split('+')[0])`.
- **Session Envelope (`fbup_session`)**: Cryptographically verified session token containing: `userId`, `email`, `name`, `subdomain`, `role`, `status`, `iat`, `exp`.
- **Registration DTO**: Input payload for signup: `{ name: string, phone: string, email: string, password: string }`.
- **Login DTO**: Input payload for login: `{ email: string, password: string, returnUrl?: string }`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of registrations with valid email, name, phone, and password successfully generate a valid tenant subdomain and redirect to their workspace within 1.5 seconds.
- **SC-002**: 100% of dots (`.`) and plus signs (`+`) are cleanly stripped from the derived subdomain slug (e.g. `john.doe+reels@gmail.com` reliably produces `johndoe`).
- **SC-003**: 100% of authentications set an `HttpOnly`, `SameSite=Lax` cookie scoped to the root domain, allowing immediate access to `{subdomain}.domain.com` without re-authenticating.
- **SC-004**: Zero ad-hoc CSS colors, custom border declarations, or capsule pill badges in the login and signup forms; 100% compliance with `apps/web/src/lib/theme.ts`.
- **SC-005**: 100% of unit and integration tests for authentication pass cleanly in the Turborepo test pipeline.
- **SC-006**: Suspended accounts are 100% blocked from logging in or receiving active session tokens.

---

## Assumptions

- Supabase project credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are configured or provided via environment variables.
- Subdomain routing continues to be handled seamlessly by the existing Next.js edge middleware (`apps/web/src/middleware.ts`).
- Storage quotas table (`public.storage_quotas`) from Spec 004 is initialized on user signup.
- In local development, the root domain is `localhost:3000` (or `localhost`), allowing subdomain access via `http://{subdomain}.localhost:3000`.
