# Feature Specification: Core Monorepo Foundation & Data Substrate

**Feature Branch**: `spec/001-monorepo-foundation-data-substrate`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Rebuild fbuploadpro with unified user model: remove agencies, users have their own subdomains and token balances directly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Registration & Subdomain Workspace Isolation (Priority: P1) 🎯 MVP

A user signs up for FBUploadPro to manage social media automation and claims their own unique subdomain (e.g. `clientname.fbuploadpro.com`). The system establishes an isolated workspace for that user where all social accounts, posting schedules, media buffers, and token balances belong directly to that user, ensuring that no user can ever inspect, modify, or leak data belonging to another user.

**Why this priority**: User and subdomain isolation is the fundamental foundation of the entire SaaS platform. Every downstream feature (scraping, scheduling, publishing, token accounting) is strictly partitioned by `user_id`.

**Independent Test**: Can be fully tested by registering multiple users with distinct subdomains, attempting cross-user queries and mutations, and verifying that the system strictly isolates all user data and rejects duplicate or reserved subdomain slugs.

**Acceptance Scenarios**:

1. **Given** a new user registration with a valid email and unique subdomain, **When** the user is created, **Then** an isolated user workspace is established with an initial token balance and active status.
2. **Given** an existing registered subdomain or a reserved system slug (e.g., `admin`, `api`, `app`, `auth`), **When** another registration attempts to claim that subdomain, **Then** the system rejects the registration with an unambiguous validation error.
3. **Given** records belonging to User A, **When** User B attempts to read or mutate those records, **Then** the system enforces tenant isolation boundaries and prevents any unauthorized access or data exposure.

---

### User Story 2 - Facebook Account & Page Connectivity with User Guardrails (Priority: P2)

A user connects their personal Facebook account and selects managed Facebook Pages for automated short-form video publishing. The system records the Facebook account and associated pages with strict composite linkage to the owning `user_id`, guaranteeing that pages cannot be orphaned or cross-assigned to foreign user accounts.

**Why this priority**: Facebook Pages are the core operational asset of FBUploadPro. Ensuring that accounts and pages are securely tethered to their owning user prevents cross-user leakage or credential misuse.

**Independent Test**: Can be tested by connecting Facebook accounts and pages under User A, verifying their associations, and attempting to link a foreign account or reassign an existing page to User B, which must be blocked.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they register a Facebook account and associated Facebook Pages, **Then** the accounts and pages are stored with validated foreign keys tethered to both the user and account, initialized in an active state.
2. **Given** a Facebook page registered under User A, **When** an operation attempts to link that page ID to User B's account, **Then** the composite user constraints reject the operation.
3. **Given** an existing Facebook page record, **When** follower counts or page metadata are updated, **Then** non-negative metric invariants are preserved and audit timestamps are refreshed.

---

### User Story 3 - Token Balance Ledger & Atomic Debit Invariants (Priority: P3)

Users consume prepaid platform tokens to execute scraping, downloading, and Facebook Reels publishing operations. When an operation requires tokens, the system must atomically deduct the required quantity from the user's balance, guaranteeing that balances never drop below zero and that concurrent posting requests never produce race condition overdrafts.

**Why this priority**: Financial and resource accuracy is critical for system automation. Overdrafts or lost balance deductions cause operational and billing discrepancies.

**Independent Test**: Can be tested by depositing tokens, initiating parallel deduction operations exceeding the balance, and verifying that only valid deductions succeed while excess requests fail with insufficient funds errors and a non-negative balance is preserved.

**Acceptance Scenarios**:

1. **Given** a user with an active token balance, **When** a valid operational debit is executed, **Then** the available balance is atomically decreased, the updated balance is returned, and an immutable transaction log record is stored.
2. **Given** a user with insufficient tokens for an operation, **When** a debit is attempted, **Then** the deduction is rejected immediately with an insufficient funds error, and the balance remains completely unchanged.
3. **Given** multiple concurrent deduction requests competing for the remaining tokens, **When** executed simultaneously, **Then** atomic row-level guarantees ensure only requests with sufficient remaining balance succeed, and the final balance strictly equals initial balance minus total approved debits.

---

### User Story 4 - High-Availability Infrastructure & Sanitized Health Probing (Priority: P4)

Platform operators and automated orchestrators need to monitor the operational status of both web applications and edge workers via dedicated health check endpoints. Diagnostic checks must run within a strict timeout budget and report health status without leaking internal connection strings, credentials, or error stack traces.

**Why this priority**: Observability and uptime assurance are essential for continuous deployment, automated failover, and operational confidence.

**Independent Test**: Can be tested by invoking the health route during normal operation (expecting HTTP 200 OK) and during simulated database outage or timeout (expecting HTTP 503 Service Unavailable with sanitized response payload).

**Acceptance Scenarios**:

1. **Given** a running web service and healthy database connectivity, **When** a monitoring probe requests the health check endpoint, **Then** the service returns an HTTP 200 OK response with a sanitized status payload within 2000ms.
2. **Given** an unreachable database or network latency exceeding 2000ms, **When** a monitoring probe requests the health check endpoint, **Then** the request aborts within the timeout budget and returns an HTTP 503 response indicating unhealthy state without exposing internal credentials or error traces.
3. **Given** an edge worker environment, **When** monitoring probes query its health handler, **Then** the edge isolate responds with valid identification without requiring Node.js TCP socket dependencies.

---

### Edge Cases

- **Subdomain collisions & reserved names**: Registration with uppercase letters, special symbols, or reserved prefixes (`www`, `app`, `admin`, `api`, `auth`, `billing`) must be normalized or rejected deterministically.
- **Zero or negative transaction amounts**: Balance modifications with non-positive values (`amount <= 0`) must be rejected at the boundary.
- **Rapid concurrent balance updates**: Simultaneous debits against low balances must never allow negative balance state.
- **Edge isolate runtime compatibility**: Background workers running on edge runtimes must communicate with storage via edge-safe protocols without relying on native Node.js TCP drivers.
- **Database downtime during health probe**: Health probes must never hang indefinitely; strict timeout aborts must release connections cleanly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST validate and normalize user subdomains according to standard DNS rules (alphanumeric, lowercase, hyphen-separated, 1–50 characters) and reject all reserved system slugs.
- **FR-002**: System MUST enforce user-level multi-tenant isolation across all data entities using explicit `user_id` ownership keys.
- **FR-003**: System MUST enforce composite foreign key relationships on social media accounts and pages such that pages cannot be linked across differing user accounts.
- **FR-004**: System MUST maintain an atomic token ledger per user with non-negative constraints on balances (`balance >= 0`).
- **FR-005**: System MUST execute token debits using atomic decrement semantics that guarantee zero balance overdrafts under high concurrency.
- **FR-006**: System MUST record an immutable transaction record for every balance adjustment, tracking transaction type, magnitude, reference ID, and timestamp linked to `user_id`.
- **FR-007**: System MUST provide runtime boundary validation for 100% of domain entities and API payloads using centralized contract schemas.
- **FR-008**: System MUST provide dual database client access patterns: connection-pooled execution for Node.js server runtimes and transport-isolated execution for edge isolate runtimes.
- **FR-009**: System MUST provide sanitized diagnostic health routes that execute within a 2000ms timeout budget and suppress all sensitive credentials and stack traces.
- **FR-010**: System MUST enforce automated quality gates including TypeScript strict compilation, linting, and automated unit/integration test suites.

### Key Entities *(include if feature involves data)*

- **User**: The root tenant and operator. Key attributes: unique identifier (UUID), display name, email, validated subdomain slug, role (`agency`, `super_admin`), token balance (non-negative integer), status (`active`, `suspended`), creation and update timestamps.
- **Facebook Account**: A connected social media identity. Key attributes: unique identifier (UUID), owning user identifier (`user_id`), platform account ID, display name, connection status.
- **Facebook Page**: A managed publishing page. Key attributes: unique identifier (UUID), owning user identifier (`user_id`), parent Facebook account identifier, platform page ID, page title, follower count, publishing status.
- **Token Transaction**: Immutable ledger item. Key attributes: unique identifier (UUID), owning user identifier (`user_id`), transaction type (`credit`, `debit`, `refund`, `adjustment`), amount (strictly positive integer), reference identifier, description, creation timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user isolation tests pass, proving zero data leakage across distinct user scopes.
- **SC-002**: 100% of concurrent debit operations enforce the non-negative balance invariant (`balance >= 0`), with zero race condition overdrafts.
- **SC-003**: 100% of reserved subdomain inputs and malformed payload values are rejected at runtime validation boundaries.
- **SC-004**: Health verification probes complete within the 2000ms timeout budget and reveal zero credentials or stack traces during failure modes.
- **SC-005**: Monorepo builds, type checks, and test suites across all workspaces achieve 100% pass rates with zero warnings and zero errors.

## Assumptions

- Each user has their own dedicated subdomain slug for workspace access.
- Users operate on a prepaid token billing model where operations are metered by tokens.
- Facebook Graph API interactions use OAuth access tokens managed per account and page.
- Subdomain routing maps incoming traffic to the appropriate user tenant context.
- Edge workers execute in standard V8 isolate environments without native Node.js TCP networking.
- Database storage is hosted on PostgreSQL with support for atomic conditional updates.
