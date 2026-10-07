# Feature Specification: Core Monorepo Foundation & Data Substrate

**Feature Branch**: `spec/001-monorepo-foundation-data-substrate`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Rebuild fbuploadpro starting with Phase 1: Core Monorepo Foundation & Data Substrate (Turborepo, domain contracts, multi-tenant DB schema, and edge/node clients)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Tenant Agency Registration & Workspace Isolation (Priority: P1)

An agency administrator signs up for FBUploadPro to manage social media automation and claims a unique agency identifier (subdomain). The system creates an isolated workspace where all subsequent data (users, social accounts, posting schedules, token balances) is partitioned strictly by tenant, ensuring that no agency can ever inspect, modify, or leak data belonging to another agency.

**Why this priority**: Multi-tenant data isolation is the non-negotiable bedrock of the entire SaaS platform. Every downstream feature (scraping, scheduling, publishing, billing) depends upon guaranteed tenant boundaries.

**Independent Test**: Can be fully tested by registering multiple agencies with distinct subdomains, attempting cross-tenant queries and mutations, and verifying that the system strictly isolates all tenant data and rejects duplicate or reserved identifiers.

**Acceptance Scenarios**:

1. **Given** a new agency registration payload with a valid name and unique subdomain, **When** the agency is created, **Then** an isolated workspace is established with an initial admin user, an initialized token ledger, and an active status.
2. **Given** an existing registered agency subdomain or a reserved system slug (e.g., `admin`, `api`, `app`), **When** an agency creation attempt provides this subdomain, **Then** the system rejects the registration with an unambiguous validation error.
3. **Given** records belonging to Agency A, **When** a user or service authenticated under Agency B attempts to read or mutate those records, **Then** the system enforces tenant isolation boundaries and prevents any unauthorized access or data exposure.

---

### User Story 2 - Social Account & Page Connectivity with Tenant Guardrails (Priority: P2)

An agency administrator connects their Facebook identity and manages Facebook Pages for automated short-form video publishing. The system records the Facebook account and associated pages with strict composite tenant linkage, guaranteeing that pages cannot be orphaned or cross-assigned to foreign agency accounts.

**Why this priority**: Facebook Pages are the core operational asset of FBUploadPro. Ensuring that accounts and pages are securely tethered to their owning agency prevents accidental cross-posting or credential misuse.

**Independent Test**: Can be tested by connecting Facebook accounts and pages under Agency A, verifying their associations, and attempting to link a foreign account or reassign an existing page to Agency B, which must be blocked.

**Acceptance Scenarios**:

1. **Given** an authenticated agency admin, **When** they register a Facebook account and associated Facebook Pages, **Then** the accounts and pages are stored with validated foreign keys tethered to both the agency and account, initialized in an active state.
2. **Given** a Facebook page registered under Agency A, **When** an operation attempts to link that page ID to Agency B's account, **Then** the multi-tenant compound constraints reject the operation.
3. **Given** an existing Facebook page record, **When** follower counts or page metadata are updated, **Then** the non-negative metric invariants are preserved and audit timestamps are refreshed.

---

### User Story 3 - Token Balance Ledger & Atomic Debit Invariants (Priority: P3)

Agencies consume prepaid platform tokens to execute scraping, downloading, and Facebook Reels publishing operations. When an operation requires tokens, the system must atomically deduct the required quantity from the agency's balance, guaranteeing that balances never drop below zero and that concurrent posting requests never produce race condition overdrafts.

**Why this priority**: Financial and resource accuracy is critical for agency operations. Overdrafts or lost balance deductions cause operational and financial discrepancies.

**Independent Test**: Can be tested by depositing tokens, initiating parallel deduction operations exceeding the balance, and verifying that only valid deductions succeed while excess requests fail with insufficient funds errors and a non-negative balance is preserved.

**Acceptance Scenarios**:

1. **Given** an agency with an active token balance, **When** a valid operational debit is executed, **Then** the available balance is atomically decreased, the updated balance is returned, and an immutable transaction log record is stored.
2. **Given** an agency with insufficient tokens for an operation, **When** a debit is attempted, **Then** the deduction is rejected immediately with an insufficient funds error, and the balance remains completely unchanged.
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

- **FR-001**: System MUST validate and normalize agency subdomains according to standard DNS rules (alphanumeric, lowercase, hyphen-separated, 1–50 characters) and reject all reserved system slugs.
- **FR-002**: System MUST enforce multi-tenant isolation across all data entities using explicit agency ownership keys.
- **FR-003**: System MUST enforce composite foreign key relationships on social media accounts and pages such that pages cannot be linked across differing tenant agencies.
- **FR-004**: System MUST maintain an atomic token ledger per agency with non-negative constraints on both available balance and reserved tokens.
- **FR-005**: System MUST execute token debits using atomic decrement semantics that guarantee zero balance overdrafts under high concurrency.
- **FR-006**: System MUST record an immutable transaction record for every balance adjustment, tracking transaction type, magnitude, reference ID, and timestamp.
- **FR-007**: System MUST provide runtime boundary validation for 100% of domain entities and API payloads using centralized contract schemas.
- **FR-008**: System MUST provide dual database client access patterns: connection-pooled execution for Node.js server runtimes and transport-isolated execution for edge isolate runtimes.
- **FR-009**: System MUST provide sanitized diagnostic health routes that execute within a 2000ms timeout budget and suppress all sensitive credentials and stack traces.
- **FR-010**: System MUST enforce automated quality gates including TypeScript strict compilation, linting, and automated unit/integration test suites.

### Key Entities *(include if feature involves data)*

- **Agency**: Represents a tenant organization. Key attributes: unique identifier (UUID), display name, validated subdomain slug, status (`active`, `suspended`), creation and update timestamps.
- **User**: An authenticated member within an agency. Key attributes: unique identifier (UUID), owning agency identifier, email address, role (`agency_admin`, `member`), status (`active`, `invited`, `deactivated`).
- **Facebook Account**: A connected social media identity. Key attributes: unique identifier (UUID), owning agency identifier, platform account ID, account name, connection status.
- **Facebook Page**: A managed publishing page. Key attributes: unique identifier (UUID), owning agency identifier, parent Facebook account identifier, platform page ID, page title, follower count, publishing status.
- **Token Balance**: Represents an agency's prepaid balance. Key attributes: owning agency identifier, available balance (non-negative integer), reserved balance (non-negative integer), last updated timestamp.
- **Token Transaction**: Immutable ledger item. Key attributes: unique identifier (UUID), owning agency identifier, transaction type (`credit`, `debit`, `refund`, `adjustment`), amount (strictly positive integer), reference identifier, description, creation timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of multi-tenant isolation tests pass, proving zero data leakage across distinct tenant scopes.
- **SC-002**: 100% of concurrent debit operations enforce the non-negative balance invariant (`balance >= 0`), with zero race condition overdrafts.
- **SC-003**: 100% of reserved subdomain inputs and malformed payload values are rejected at runtime validation boundaries.
- **SC-004**: Health verification probes complete within the 2000ms timeout budget and reveal zero credentials or stack traces during failure modes.
- **SC-005**: Monorepo builds, type checks, and test suites across all workspaces achieve 100% pass rates with zero warnings and zero errors.

## Assumptions

- Agencies operate on a prepaid billing model where automation operations require positive token balances.
- Each agency has a dedicated primary administrator created during workspace initialization.
- Subdomain routing will route agency-specific web requests to the appropriate tenant context.
- Edge workers execute in standard V8 isolate environments without native Node.js TCP networking.
- Database storage is hosted on PostgreSQL with support for atomic conditional updates (`UPDATE ... WHERE balance >= :amount RETURNING balance`).
