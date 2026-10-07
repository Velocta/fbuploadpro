# Feature Specification: Authentication & Multi-Tenant Subdomain Routing Isolation

**Feature Branch**: `spec/002-auth-subdomain-routing`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Authentication & Multi-Tenant Subdomain Routing Isolation: Next.js edge middleware rewriting {subdomain}.domain.com to tenant workspaces, tenant subdomain ownership verification and RBAC for roles: user, seller, admin, and dashboard shell displaying user workspace, subdomain, and token balance."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Subdomain Detection & Workspace Edge Routing (Priority: P1) 🎯 MVP

When a visitor or registered user navigates to a customer-specific web address (such as `acme.fbuploadpro.com`), the edge network immediately detects the subdomain slug, distinguishes it from main platform marketing pages or system utilities, and maps the request to the dedicated customer workspace without exposing internal route rewrites in the browser address bar. If a user visits the root domain (such as `fbuploadpro.com` or `www.fbuploadpro.com`), the system routes them to the public landing page.

**Why this priority**: Subdomain-based routing is the primary entry point for multi-tenant isolation. Without automated edge routing, users cannot access their isolated workspaces or receive tenant-specific context.

**Independent Test**: Can be independently tested by sending HTTP requests with various host headers (root domain, reserved subdomains, valid tenant subdomains, and invalid or non-existent subdomains) and verifying that the edge router routes each request to the correct internal workspace route or error page.

**Acceptance Scenarios**:

1. **Given** an incoming request with a valid tenant host (e.g. `client.example.com/dashboard`), **When** evaluated at the routing boundary, **Then** the request is internally routed to the tenant workspace for `client` while preserving the URL path in the user's browser.
2. **Given** an incoming request to the root domain (e.g. `example.com` or `www.example.com`), **When** processed by the edge router, **Then** it serves the main platform public home page without tenant workspace rewriting.
3. **Given** a request with a reserved system identifier (e.g. `api`, `admin`, `billing`, `auth`), **When** received at the routing boundary, **Then** it is processed as a platform utility rather than being rewritten to a tenant workspace.
4. **Given** a request targeting a non-existent or unregistered subdomain slug, **When** looked up by the system, **Then** it returns an unambiguous Tenant Not Found status.

---

### User Story 2 - Tenant Subdomain Ownership Verification & Authentication Guard (Priority: P2)

When a user attempts to access a protected workspace under a specific subdomain (e.g. `acme.fbuploadpro.com/dashboard`), the system validates their authentication session and verifies that their authenticated identity owns or belongs to the target subdomain. If an authenticated user belonging to `tenant-a` attempts to access `tenant-b.fbuploadpro.com`, the system rejects the cross-tenant request and safely redirects them to their own authorized workspace.

**Why this priority**: Subdomain routing alone does not prevent unauthorized access; strict ownership verification ensures that authenticated users cannot access or view other tenants' workspaces.

**Independent Test**: Can be tested by creating two distinct user sessions (User A for `alpha` and User B for `beta`), asserting that User A can access `alpha.example.com` but receives an access denied or redirection when accessing `beta.example.com`, and asserting that unauthenticated sessions are redirected to sign-in.

**Acceptance Scenarios**:

1. **Given** an authenticated user whose registered subdomain matches the requested host, **When** accessing protected workspace routes, **Then** access is granted and the workspace is rendered.
2. **Given** an unauthenticated visitor accessing a protected workspace route, **When** evaluated by the access control guard, **Then** the request is redirected to the authentication login view with the target destination preserved.
3. **Given** an authenticated user belonging to Subdomain A, **When** they attempt to access protected workspace routes on Subdomain B, **Then** the system rejects access with an authorization error and redirects the user to their own valid workspace.
4. **Given** an authenticated user whose account status is marked suspended, **When** attempting to access their workspace, **Then** access is blocked with an account suspension notification.

---

### User Story 3 - Role-Based Access Control (RBAC) across Tenant Roles (Priority: P3)

The platform supports three distinct user roles: `user` (standard publishing operator), `seller` (service provider managing client campaigns or templates), and `admin` (platform superuser). Within an authorized workspace or administration interface, the system enforces access controls based on the active user's assigned role, granting administrative privileges only to verified admins, seller capabilities to sellers and admins, and general operations to standard users.

**Why this priority**: Different tenant users require different privilege levels. Clear RBAC ensures that administrative settings and seller capabilities cannot be accessed by standard users.

**Independent Test**: Can be tested by creating test sessions for `user`, `seller`, and `admin` roles, attempting to access role-restricted routes or operations, and verifying that higher-tier routes return 403 Forbidden for unauthorized roles while succeeding for authorized roles.

**Acceptance Scenarios**:

1. **Given** an authenticated user with role `user`, **When** accessing standard workspace dashboard features, **Then** access is allowed; **When** attempting to access administrative management endpoints, **Then** access is denied with a 403 Forbidden error.
2. **Given** an authenticated user with role `seller`, **When** accessing seller-tier features, **Then** access is granted; **When** attempting to access platform-wide admin controls, **Then** access is denied.
3. **Given** an authenticated user with role `admin`, **When** accessing any tenant workspace or platform-wide administration route, **Then** privileged access is granted.

---

### User Story 4 - Multi-Tenant Workspace Dashboard Shell (Priority: P4)

Once authenticated and authorized, a user sees the workspace dashboard shell. The shell displays key tenant context including the active workspace subdomain badge, user display name, current user role, and live prepaid token balance. The dashboard shell provides persistent navigation across social account connections, posting schedules, and billing without leaking sensitive credentials or internal configuration.

**Why this priority**: The dashboard shell is the central user interface where all operational management happens, giving the user immediate situational awareness of their identity, tenant workspace, and remaining operational tokens.

**Independent Test**: Can be tested by rendering the dashboard shell for a verified session and verifying that display name, subdomain badge, role badge, and token balance accurately reflect the session's data, with responsive layout elements.

**Acceptance Scenarios**:

1. **Given** an authorized workspace session, **When** the dashboard shell renders, **Then** it clearly displays the workspace subdomain, current user name, assigned role, and current token balance.
2. **Given** a user with a zero or positive token balance, **When** inspecting the dashboard header, **Then** the token balance is presented as an exact non-negative integer with quick navigation to token top-up.
3. **Given** any error in downstream data retrieval during shell rendering, **When** an error occurs, **Then** the shell presents a graceful degraded state without exposing internal server stack traces or database connection strings.

---

### Edge Cases

- **Root Domain vs Tenant Subdomain Ambiguity**: Requests to `example.com`, `localhost:3000`, `127.0.0.1`, and `www.example.com` must never be parsed as tenant subdomains.
- **Port Numbers and IP Addresses**: Requests originating with ports (e.g. `localhost:3000` or `acme.localhost:3000`) must strip the port before subdomain extraction.
- **Malformed or Nested Subdomains**: Subdomains with invalid characters or multiple levels (e.g. `foo.bar.example.com`) must be handled safely, extracting only the valid tenant slug or rejecting malformed patterns.
- **Reserved Subdomain Requests**: Requests to `admin.example.com` or `api.example.com` must route to their dedicated handlers and never be rewritten to standard customer workspace paths.
- **Session Expiration & Tampering**: Expired, malformed, or cryptographically invalid session tokens must be immediately revoked, clearing the session cookie and prompting re-authentication.
- **Cross-Tenant Session Injection**: Manipulating session cookies or headers to claim a different tenant subdomain must fail cryptographic signature verification.
- **Zero Token Balance**: Users with 0 tokens can still access their dashboard shell and view status, but actionable automated operations will require token purchase.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect host headers at the edge routing layer, parse the tenant subdomain slug, and ignore root domain aliases (`www`, root apex, and IP addresses).
- **FR-002**: The system MUST internally rewrite valid tenant subdomain requests (`{subdomain}.domain.com/*`) to the dedicated workspace route structure (`/tenant/[subdomain]/*`) without changing the browser's displayed URL.
- **FR-003**: The system MUST bypass subdomain workspace rewriting for reserved platform subdomains and system paths (`/api/*`, `/_next/*`, `/favicon.ico`, static assets).
- **FR-004**: The system MUST return an unambiguous Tenant Not Found response when a requested subdomain does not correspond to an existing tenant.
- **FR-005**: The system MUST verify cryptographically signed authentication sessions containing user identity, assigned role, and authorized tenant subdomain.
- **FR-006**: The system MUST enforce tenant ownership by asserting that the authenticated user's assigned subdomain strictly matches the requested subdomain host, denying access with an authorization error on mismatch.
- **FR-007**: The system MUST redirect unauthenticated requests targeting protected tenant workspace routes to the login flow.
- **FR-008**: The system MUST enforce Role-Based Access Control (RBAC) across `user`, `seller`, and `admin` roles, guarding privileged routes and capabilities.
- **FR-009**: The system MUST reject access for users with suspended account status, redirecting them to an account status notice.
- **FR-010**: The system MUST provide a multi-tenant dashboard shell displaying the user workspace name, subdomain slug badge, user role badge, and current non-negative token balance.
- **FR-011**: The system MUST sanitize all user-facing session envelopes and error responses to ensure zero database credentials, connection strings, or internal infrastructure topologies are leaked.

### Key Entities *(include if feature involves data)*

- **Session Context**: The authenticated identity envelope. Key attributes: user identifier (UUID), user email, display name, assigned subdomain slug, user role (`user`, `seller`, `admin`), account status (`active`, `suspended`), session expiration timestamp.
- **Tenant Workspace Context**: The resolved tenant route context. Key attributes: subdomain slug, tenant status, owner user identifier, workspace display settings.
- **Role Permission Matrix**: The access control mapping that defines permissible actions and viewable routes per role (`user`, `seller`, `admin`).
- **Dashboard State**: The tenant operational summary. Key attributes: tenant subdomain, display name, role, token balance, connected accounts summary count.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid subdomain requests route to the appropriate tenant workspace routes without client-visible URL redirect loops.
- **SC-002**: 100% of cross-tenant access attempts by authenticated users are blocked and safely redirected to their own authorized workspace.
- **SC-003**: 100% of unauthenticated requests to protected workspace routes are redirected to login.
- **SC-004**: Role permissions are strictly enforced with 0 unauthorized role privilege escalations.
- **SC-005**: Dashboard shell accurately renders workspace identity and live token balance within 200ms on server rendering.
- **SC-006**: Monorepo builds, typechecks, lints, and test suites across all packages and apps maintain a 100% pass rate.

## Assumptions

- Multi-tenant routing is served by Next.js App Router with edge middleware handling hostname inspection and path rewriting.
- Local development utilizes subdomains on localhost (e.g. `test.localhost:3000` or header-based subdomain emulation).
- Authentication tokens are stored in secure HTTP-only cookies or verified via standard Bearer tokens.
- User accounts and their associated subdomain assignments are stored in the existing PostgreSQL `users` table established in Spec 001.
- Each user is bound to a single primary subdomain workspace in this version.
