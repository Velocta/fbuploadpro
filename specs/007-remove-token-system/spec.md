# Feature Specification: Complete Removal of Prepaid Token System & Unlimited Publishing Authorization

**Feature Branch**: `refactor/remove-token-system`

**Created**: 2026-10-08

**Status**: Ready for Planning

**Input**: User description: "Abolish the prepaid token system and enable unrestricted publishing authorization for active accounts. Complete clean purge of token balance, transaction ledgers, token deduction metrics, pre-flight payment checks, and UI token indicators, while strictly preserving Facebook OAuth credentials and session authentication."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Core Data Model & Schema Token Abolition (Priority: P1)

As a platform administrator and system architect, I want the platform data models, storage definitions, and shared interface contracts to be completely stripped of all prepaid token fields, balance constraints, and financial transaction tables, so that the platform operates on a streamlined, entitlement-free foundation where users are governed purely by account standing and identity.

**Why this priority**: Foundational data architecture. All queue scheduling endpoints, background dispatch workers, and client interfaces depend on the core domain models and storage schemas. Purging token constraints at the root model layer eliminates financial transaction overhead and establishes a clean substrate for all downstream systems.

**Independent Test**: Can be validated by creating and initializing user records, inspecting domain entities, and executing schema definitions—confirming that user entities no longer track token balances, transaction ledger tables are absent, publication logs no longer track deducted tokens, and domain contracts omit token properties, while user creation, session authentication, and Facebook OAuth credential management remain fully operational.

**Acceptance Scenarios**:

1. **Given** a new user account being created, **When** the user record is initialized in the system, **Then** the account record contains no token balance attributes or ledger linkages, and defaults to standard active status.
2. **Given** the system storage schemas and migration definitions, **When** the database schema is initialized or verified, **Then** no token balance column exists on the users table, no token transaction ledger table exists in the schema, and no token deduction column exists on publication logs.
3. **Given** shared domain contracts and schemas, **When** user models, publication outcome payloads, and audit log records are validated, **Then** any token-related fields (such as token balance, tokens deducted, or transaction types) are completely absent from validation rules, while account identifiers, subdomains, roles, and status remain strictly validated.
4. **Given** external Facebook OAuth access tokens and user session security tokens, **When** OAuth accounts or session tokens are created, refreshed, or verified, **Then** encryption, storage, and cryptographic verification of Facebook credentials and session authentication operate with zero interference from the prepaid token removal.

---

### User Story 2 - Unrestricted Publishing Queueing & Worker Settlement (Priority: P2)

As an active content creator with connected Facebook Pages, I want to queue and publish unlimited posts, reels, and photos without encountering credit checks, balance deductions, or payment-required rejections, and I want the background dispatch engine to settle publication jobs without executing token debit operations or ledger records.

**Why this priority**: Core platform functionality. Publishing is the primary value proposition of the system. Removing artificial prepaid token barriers enables uninterrupted content scheduling and eliminates debit overhead and database row-locking contention during high-throughput dispatch.

**Independent Test**: Can be validated by an active user queueing multiple posts to a connected Facebook Page, confirming that the queue endpoint immediately accepts the request without performing token balance checks (no payment-required responses), and verifying that when the background engine dispatches and publishes the posts, publication logs record execution status and timestamps, the post status updates to published, and zero token deduction or ledger records are generated.

**Acceptance Scenarios**:

1. **Given** an authenticated user with active account status and at least one connected Facebook Page, **When** the user schedules a single or batch queue item, **Then** the system enqueues the item immediately without evaluating user credit balances or returning payment-required rejections.
2. **Given** a user whose account was previously at zero balance, **When** they submit posts to the publishing queue, **Then** the queue operation succeeds without warning, restriction, or payment prompts.
3. **Given** a claimed queue item ready for dispatch, **When** the background publishing engine dispatches the item to the Facebook platform and receives a successful response, **Then** the system marks the queue item as published, records a success audit entry with response codes, and executes zero balance decrement operations or ledger transactions.
4. **Given** a claimed queue item that fails during dispatch, **When** the background publishing engine records the failure or schedules a retry, **Then** the system updates the queue item status and retry counter and logs error details with zero token calculations.
5. **Given** a user with suspended account status, **When** they attempt to enqueue posts, **Then** the system rejects the request based strictly on account status authorization, completely independent of any financial or token concepts.

---

### User Story 3 - UI & Client Experience Cleanup (Priority: P3)

As a workspace tenant user navigating the platform dashboard, media library, and publishing views, I want a clean, unencumbered user interface that displays my connected pages, media library, and publishing schedules without misleading token balances, coin icons, or top-up badges, so that my experience reflects an unrestricted, professional tool.

**Why this priority**: User-facing trust and visual clarity. Lingering token counters, balance badges, or purchasing prompts create confusion, misrepresent the platform's commercial model, and clutter workspace navigation.

**Independent Test**: Can be validated by navigating through the tenant workspace layout, publishing queue views, and post activity logs, asserting that no token balance counters, credit badges, or token deduction columns appear in navigation headers or log tables, while all navigation, Page selectors, and publication logs function cleanly.

**Acceptance Scenarios**:

1. **Given** an authenticated tenant user loading their workspace header, **When** the workspace layout renders, **Then** the user profile and workspace switchers are displayed without any token balance badges, token count counters, or wallet icons.
2. **Given** a user reviewing publication activity logs, **When** the log list is rendered, **Then** the logs display publication timestamp, target Page name, status (success, retry, failed), and external post links, with no token deduction column or debit metric.
3. **Given** a user scheduling posts from the Media Library or Queue screen, **When** the submission interface loads, **Then** no pre-flight token balance warning, token deduction estimate, or "Buy Tokens" call-to-action is rendered anywhere in the workflow.

---

### Edge Cases

- **Suspended or Inactive Account Access**: When a user whose account status is `suspended` attempts to schedule or publish posts, the system rejects the request with an authorization forbidden error, confirming that access control is governed strictly by account status rather than payment or credit availability.
- **Disconnected or Invalid Facebook Page**: When an active user attempts to queue posts to a disconnected or invalid Facebook Page, the system rejects the queue request with a domain validation error indicating invalid Page connection, without any reference to token balance.
- **High-Concurrency Queue Submissions**: When an active user submits dozens of simultaneous post scheduling requests, all valid requests succeed concurrently and are assigned available schedule slots without concurrency contention or deadlocks on user balance counters.
- **High-Throughput Background Dispatch Settlement**: When multiple worker dispatchers concurrently settle successful post publications for the same user, each worker atomically updates only the specific queue item and appends the publication audit log, eliminating previous database row-locking contention on the user record.
- **Historical Audit Log Presentation**: When users or administrators review historical publication logs, the system presents consistent audit metadata (status, timestamp, external post ID, error diagnostics) without requiring or displaying legacy token debit values.
- **Nomenclature Distinction (OAuth vs Billing)**: To prevent confusion, all external platform OAuth access tokens (`encrypted_access_token`) and user session authentication tokens are explicitly isolated in naming, schemas, and security boundaries, remaining fully intact while platform billing tokens are completely purged.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST NOT store, track, or validate any prepaid credit or token balance on user account records.
- **FR-002**: System MUST NOT maintain, query, or accept writes to any token transaction ledger or billing transaction table.
- **FR-003**: System MUST authorize content scheduling and queue operations for any authenticated user with an active account status (`status = 'active'`) and connected destination pages without credit or token checks.
- **FR-004**: System MUST NOT return payment-required responses (HTTP 402) or enforce pre-flight balance prerequisites on content queueing endpoints.
- **FR-005**: System MUST process background publication settlement by transitioning queue item states and recording execution audit logs without debiting user balances.
- **FR-006**: System MUST NOT record, calculate, or expose token deduction counts in publication audit log records.
- **FR-007**: System MUST NOT display token balances, token badges, or credit counters within workspace navigation headers, sidebars, or layouts.
- **FR-008**: System MUST NOT display token deduction values, debit metrics, or top-up prompts within publication activity logs, queue management screens, or asset scheduling interfaces.
- **FR-009**: System MUST preserve and maintain secure cryptographic storage, rotation, and transmission of external platform OAuth credentials (e.g., Facebook access tokens) completely independent of platform billing removal.
- **FR-010**: System MUST preserve and maintain cryptographic signing and verification of user session authentication tokens completely independent of platform billing removal.
- **FR-011**: System MUST enforce account suspension solely through account status attributes (`status = 'active' | 'suspended'`), denying scheduling operations to suspended accounts regardless of historical activity.
- **FR-012**: System MUST maintain compound tenant isolation (`user_id`) across all scheduling, publishing, and audit log queries without relying on balance ledger joins or checks.

### Key Entities

- **User Account**: Represents an individual tenant in the platform. Core attributes include unique identifier, email, tenant subdomain, role (user, seller, admin), and account status (active, suspended). Does NOT include token balance or billing wallet attributes.
- **Facebook Destination Page**: Represents a connected Facebook Page managed by a user. Attributes include account linkage, external page identifier, page name, connection status, and encrypted external access credentials.
- **Queue Item**: Represents a scheduled publication unit containing media reference, caption, optional first comment, target slot timestamp, retry counters, external published identifiers, and scheduling status (queued, published, failed).
- **Publication Audit Log**: Represents an immutable historical record of a publication attempt. Attributes include queue item reference, target page reference, attempt number, status outcome (success, retry, failure), external response codes, error diagnostics, and creation timestamp. Does NOT include token deduction attributes.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of post queueing requests from active accounts with connected pages succeed without encountering credit or balance errors.
- **SC-002**: Zero (0) token-related fields (balance, transactions, deductions) are present across platform database schemas and shared contract models.
- **SC-003**: Zero (0) payment-required rejections (HTTP 402) are emitted across all content queueing and scheduling endpoints.
- **SC-004**: Background worker publication settlement executes with zero balance decrement queries, eliminating database row-locking contention on user records during concurrent dispatch.
- **SC-005**: Zero (0) token counters, credit badges, or purchasing calls-to-action appear across all tenant workspace user interfaces.
- **SC-006**: 100% of external platform OAuth credentials and session authentication tokens remain securely encrypted and operational with zero regression.

---

## Assumptions

- **Account Status Authorization**: Account status `status = 'active'` is the sole gating condition for scheduling and publishing functionality.
- **Future Commercialization**: Future monetization, subscription tiers, or usage limits will be specified independently under a future feature and do not impact this specification.
- **Schema Rewrite Strategy**: Database migration approach uses a clean schema DDL rewrite for database environments, completely dropping legacy token tables and columns.
- **Historical Data Compatibility**: Existing test and development records do not require backward-compatibility ledger migration or preservation of legacy token transaction history.
- **Terminology Separation**: External OAuth access tokens (`encrypted_access_token`) and session JWT tokens are strictly isolated in naming, schemas, and security boundaries from the abolished prepaid platform tokens.
