# Research: Core Monorepo Foundation & Data Substrate

This document details the architectural decisions, trade-offs, and design rationale for the foundational monorepo and data substrate of FBUploadPro.

---

## 1. Monorepo Architecture & Workspace Tooling

### Decision
Adopt **pnpm workspaces** orchestrated with **Turborepo** (`turbo.json`) and root TypeScript configurations (`tsconfig.base.json`).

### Rationale
- **Strict Dependency Isolation**: `pnpm` uses a content-addressable hard-link store and non-flat `node_modules` layout, strictly preventing phantom dependency bugs where packages import unlisted transitive dependencies.
- **Deterministic Pipeline Execution**: Turborepo provides topological build and test caching across `apps/*` and `packages/*` (`build`, `lint`, `typecheck`, `test`).
- **Shared Code Without Publishing**: The `workspace:*` protocol allows `apps/web` and `apps/worker` to consume `@fbuploadpro/contracts` and `@fbuploadpro/database` with zero packaging or publishing overhead.

### Alternatives Considered
- **Nx**: Powerful but adds significant configuration ceremony, generator plugins, and vendor lock-in for a lean TypeScript monorepo.
- **Lerna**: Legacy tooling with heavier overhead compared to Turborepo's lightweight pipeline caching.
- **Independent Repositories (Polyrepo)**: Rejected because multi-repo introduces contract drift, version synchronization lag, and multiple CI pipelines for shared domain entities.

---

## 2. Dual Database Client Architecture (Node.js vs. Edge V8 Isolates)

### Decision
Implement a dual client strategy in `@fbuploadpro/database`:
1. **Node Client (`src/client.ts`)**: Standard connection pooling using `pg.Pool` for server runtimes (`apps/web`).
2. **Edge Client (`src/edge.ts`)**: Transport-isolated client interface decoupled from Node.js native TCP sockets (`net`, `tls`) for Cloudflare Workers (`apps/worker`).

### Rationale
- **V8 Isolate Compatibility**: Cloudflare Workers execute in lightweight V8 isolate runtimes where native Node TCP drivers fail without polyfills. Decoupling the edge client ensures that worker bundles remain lean and free of unsupported runtime primitives.
- **SQL Parameterization**: Both clients execute parameterized queries with zero string interpolation, preventing SQL injection vulnerabilities.
- **Atomic Operations**: Both clients provide typed helpers for atomic token deductions (`atomicDecrementTokens`).

### Alternatives Considered
- **Prisma ORM**: Adds large query engine binaries that are challenging to bundle into Cloudflare Worker isolate size limits and adds unnecessary generation steps.
- **Single Universal Node Client**: Fails directly at build/runtime in Cloudflare Workers due to missing Node standard library sockets (`pg` requires `net`).

---

## 3. Multi-Tenant Relational Isolation & Composite Foreign Keys

### Decision
Enforce tenant boundaries in PostgreSQL DDL using **composite foreign keys** and **compound unique constraints**:
- `facebook_accounts` uses `(agency_id, id)`.
- `facebook_pages` references `(agency_id, facebook_account_id)` via composite foreign key `fk_fb_pages_agency_account`.
- Unique constraint `uq_fb_pages_agency_page` on `(agency_id, fb_page_id)`.

### Rationale
- **Kernel-Level Multi-Tenancy**: Moving tenant enforcement into relational constraints guarantees that a page owned by Agency A can never be linked to a Facebook account owned by Agency B, even if application logic suffers an IDOR bug.
- **Cascade Safety**: Deleting an agency cascades strictly across all tenant-owned entities without leaving orphan records.

### Alternatives Considered
- **Application-Layer Filtering Only (`WHERE agency_id = ?`)**: Highly susceptible to developer omission or regression bugs leading to cross-tenant data leakage.
- **Row-Level Security (RLS) Only**: Viable in Supabase but adds latency and complexity when services connect via administrative pool credentials. Relational composite keys provide defense-in-depth regardless of connection role.

---

## 4. Token Ledger Concurrency & Non-Negative Invariants

### Decision
Combine PostgreSQL check constraints with atomic conditional SQL decrements:
```sql
CONSTRAINT chk_token_balance_non_negative CHECK (balance >= 0)
CONSTRAINT chk_token_reserved_non_negative CHECK (reserved >= 0)
```
```sql
UPDATE token_balances
SET balance = balance - :amount, updated_at = now()
WHERE agency_id = :agencyId AND balance >= :amount
RETURNING balance;
```
If 0 rows are returned, the client helper throws a typed `InsufficientFundsError` (HTTP 402, `INSUFFICIENT_FUNDS`).

### Rationale
- **Zero Race Conditions**: Single-statement conditional updates execute atomically within PostgreSQL row locks, preventing concurrent posting tasks from overdrafting.
- **Check Constraint Guarantee**: The database physically prevents balances from dropping below 0 under any circumstance.
- **Immutable Transaction Audit**: Every balance mutation writes an entry to `token_transactions` with `transaction_type IN ('credit', 'debit', 'refund', 'adjustment')` and `amount > 0`.

### Alternatives Considered
- **Read-Calculate-Write Application Flow**: Prone to classic race conditions where two simultaneous tasks read balance=10, both approve a 10-token spend, and deduct, leading to overdraft or lost updates.
- **Distributed Locks (Redis/Redlock)**: Adds operational complexity, latency, and single-point-of-failure risk when native PostgreSQL row locking is already available and ACID-compliant.

---

## 5. Sanitized Health Check & Diagnostic Observability

### Decision
Implement `/api/health` (`apps/web`) and `/health` (`apps/worker`) with a **2000ms `AbortController` timeout budget** returning standard sanitized envelopes:
- **Success (HTTP 200)**: `{ status: "ok", timestamp: "<ISO>", database: "connected" }`
- **Degraded/Timeout (HTTP 503)**: `{ status: "unhealthy", timestamp: "<ISO>", database: "disconnected" }`
- Internal database error traces, connection strings, hostnames, and credentials are completely suppressed from HTTP responses.

### Rationale
- **OWASP Compliance**: Prevents information disclosure (stack traces, internal IP addresses, database versions).
- **Proactive Fail-Fast**: Strict 2000ms timeout prevents hung database connections from piling up during database outages, allowing load balancers and orchestrators to immediately route traffic to healthy instances.

### Alternatives Considered
- **Static Health Route (No DB check)**: Fails to detect database connectivity failures, masking broken instances.
- **Unsanitized Error Response**: Leaking `error.message` exposes internal infrastructure details to public probes.
