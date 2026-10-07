# Tasks: Core Monorepo Foundation & Data Substrate

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Branch**: `spec/001-monorepo-foundation-data-substrate`

This document decomposes the implementation plan into dependency-ordered, atomic tasks (<150–200 LoC each) adhering strictly to Spec-Driven Development, TDD, and the unified User model.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, monorepo workspace tooling, and shared linting/typechecking configuration.

- [ ] T001 Configure root monorepo workspace tooling in package.json, pnpm-workspace.yaml, and turbo.json with pipeline tasks (build, lint, typecheck, test) (Issue: #16)
- [ ] T002 [P] Configure strict root TypeScript compiler base in tsconfig.base.json (strict: true, noImplicitAny: true, exactOptionalPropertyTypes: true) (Issue: #17)
- [ ] T003 [P] Configure root ESLint 9 flat configuration in eslint.config.mjs enforcing zero warnings across all workspaces (Issue: #18)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared packages scaffolding and domain error infrastructure that MUST be completed before domain entities can be defined.

**⚠️ CRITICAL**: No user story work can begin until this foundational phase is complete.

- [X] T004 Scaffold packages/contracts workspace configuration in packages/contracts/package.json and packages/contracts/tsconfig.json (Issue: #19)
- [X] T005 [P] Implement domain error taxonomy and HTTP status code mappings (VALIDATION_FAILED: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT_STATE: 409, INSUFFICIENT_FUNDS: 402, INTERNAL_ERROR: 500) in packages/contracts/src/errors/domain-error.ts (Issue: #20)
- [X] T006 Scaffold packages/database workspace configuration in packages/database/package.json and packages/database/tsconfig.json (Issue: #21)
- [X] T007 Implement base package exports in packages/contracts/src/index.ts and packages/database/src/index.ts (Issue: #22)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - User Registration & Subdomain Workspace Isolation (Priority: P1) 🎯 MVP

**Goal**: Deliver validated domain schemas and relational database tables for users with unique subdomains, token balance, and workspace isolation.

**Independent Test**: Can be validated with Vitest by asserting that SubdomainSchema rejects invalid patterns and reserved slugs, UserSchema validates UUIDs, email, subdomain, and tokensBalance >= 0, and DDL creates users table with primary keys, unique constraints, and check constraints.

### Tests for User Story 1 (TDD) ⚠️
- [X] T008 [P] [US1] Write unit tests for SubdomainSchema, reserved slugs, and UserSchema in packages/contracts/tests/user.test.ts (Issue: #23)

### Implementation for User Story 1
- [X] T009 [P] [US1] Implement SubdomainSchema (regex /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/, rejecting RESERVED_SUBDOMAINS: admin, api, app, auth, billing, dashboard, internal, mail, status, system, test, webhook, www), UserRoleSchema (user, seller, admin), UserStatusSchema (active, suspended), and UserSchema (with tokensBalance >= 0) in packages/contracts/src/domain/user.ts (Issue: #24)
- [X] T010 [US1] Write DDL migration for users table (id UUID PK, email VARCHAR(255) UNIQUE, name VARCHAR(100), subdomain VARCHAR(50) UNIQUE, role VARCHAR(20) CHECK IN ('user', 'seller', 'admin'), tokens_balance BIGINT CHECK >= 0, status VARCHAR(20) CHECK IN ('active', 'suspended')) in packages/database/migrations/0001_initial_schema.sql (Issue: #25)

**Checkpoint**: At this point, User Story 1 is functional and testable independently.

---

## Phase 4: User Story 2 - Facebook Account & Page Connectivity with User Guardrails (Priority: P2)

**Goal**: Enforce social account and Facebook page contracts with composite foreign key (user_id, facebook_account_id) preventing cross-user leakage.

**Independent Test**: Can be validated by executing Vitest tests against Facebook schemas, and asserting that SQL DDL defines composite foreign keys fk_fb_pages_user_account and compound unique constraints uq_fb_pages_user_page.

### Tests for User Story 2 (TDD) ⚠️
- [X] T011 [P] [US2] Write unit tests for FacebookAccountSchema, FacebookPageSchema, and composite user constraints in packages/contracts/tests/facebook.test.ts (Issue: #26)

### Implementation for User Story 2
- [X] T012 [P] [US2] Implement FacebookAccountStatusSchema (active, disconnected, expired), FacebookAccountSchema, FacebookPageStatusSchema (active, fb_rate_limited, invalid_token, disconnected), and FacebookPageSchema (with followersCount >= 0) referencing userId in packages/contracts/src/domain/facebook.ts (Issue: #27)
- [X] T013 [US2] Append DDL definitions for facebook_accounts (with unique constraints uq_fb_accounts_user_account and uq_fb_accounts_user_id) and facebook_pages (with composite FK fk_fb_pages_user_account referencing facebook_accounts(user_id, id) ON DELETE CASCADE and unique uq_fb_pages_user_page) to packages/database/migrations/0001_initial_schema.sql (Issue: #28)

**Checkpoint**: At this point, User Stories 1 and 2 work independently.

---

## Phase 5: User Story 3 - Token Balance Ledger & Atomic Debit Invariants (Priority: P3)

**Goal**: Implement token transaction schemas, database constraints (tokens_balance >= 0 on users, amount > 0 on transactions), and atomic token decrement client helpers.

**Independent Test**: Can be validated by executing unit tests against TokenTransactionSchema, and database client tests verifying atomic decrement succeeds on sufficient balance and throws InsufficientFundsError on insufficient funds.

### Tests for User Story 3 (TDD) ⚠️
- [ ] T014 [P] [US3] Write unit tests for TokenTransactionSchema and positive amount validation in packages/contracts/tests/billing.test.ts (Issue: #29)
- [ ] T015 [P] [US3] Write database client integration tests verifying DDL constraints, parameterized queries, and atomic token decrement in packages/database/tests/database.test.ts (Issue: #30)

### Implementation for User Story 3
- [ ] T016 [P] [US3] Implement TokenTransactionTypeSchema (credit, debit, refund, adjustment) and TokenTransactionSchema (amount > 0) referencing userId in packages/contracts/src/domain/billing.ts (Issue: #31)
- [ ] T017 [US3] Append DDL definitions for token_transactions (user_id UUID FK, amount BIGINT CHECK > 0, transaction_type IN ('credit', 'debit', 'refund', 'adjustment')) to packages/database/migrations/0001_initial_schema.sql (Issue: #32)
- [ ] T018 [US3] Implement Node.js connection pool client (pg.Pool) with parameterized query helpers (query, queryOne, withTransaction) and atomicDecrementTokens(userId, amount) in packages/database/src/client.ts (Issue: #33)
- [ ] T019 [US3] Implement Edge isolate client interface and atomicDecrementTokens(userId, amount) helper decoupled from Node socket drivers in packages/database/src/edge.ts (Issue: #34)

**Checkpoint**: At this point, User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 - High-Availability Infrastructure & Sanitized Health Probing (Priority: P4)

**Goal**: Scaffold web application and edge worker shells with sanitized diagnostic health routes enforcing a 2000ms timeout budget.

**Independent Test**: Can be validated by testing /api/health in apps/web (expecting 200 OK on healthy DB, 503 on drop/timeout with zero leaked credentials) and /health in apps/worker (expecting 200 OK with worker identification).

### Tests for User Story 4 (TDD) ⚠️
- [ ] T020 [P] [US4] Write health route tests in apps/web/tests/health.test.ts asserting 200 OK, 503 degraded states, credential sanitization, and 2000ms timeout budget (Issue: #35)
- [ ] T021 [P] [US4] Write edge worker unit tests in apps/worker/tests/worker.test.ts verifying GET /health and 404 fallback (Issue: #36)

### Implementation for User Story 4
- [ ] T022 [P] [US4] Scaffold Next.js 16 App Router application shell in apps/web/package.json, apps/web/tsconfig.json, and apps/web/next.config.ts (Issue: #37)
- [ ] T023 [P] [US4] Implement minimal application layout and root page in apps/web/src/app/layout.tsx and apps/web/src/app/page.tsx (Issue: #38)
- [ ] T024 [US4] Implement sanitized health check route with 2000ms AbortController timeout budget suppressing credentials in apps/web/src/app/api/health/route.ts (Issue: #39)
- [ ] T025 [P] [US4] Scaffold Cloudflare Worker shell in apps/worker/package.json, apps/worker/tsconfig.json, and apps/worker/wrangler.toml (Issue: #40)
- [ ] T026 [US4] Implement edge fetch handler responding to GET /health with { status: "ok", worker: "fbuploadpro-worker" } in apps/worker/src/index.ts (Issue: #41)

**Checkpoint**: All user stories are functional and testable independently.

---

## Phase 7: Polish & CI Quality Gates

**Purpose**: Automated continuous integration quality gates and end-to-end verification.

- [ ] T027 Implement GitHub Actions CI workflow for push and pull_request to main in .github/workflows/ci.yml running pnpm turbo run build lint typecheck test (Issue: #42)
- [ ] T028 [P] Execute end-to-end quickstart validation, typecheck, lint, and test suites across all monorepo packages per specs/001-monorepo-foundation-data-substrate/quickstart.md (Issue: #43)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion (T001–T003) — BLOCKS all user stories.
- **User Stories (Phase 3–6)**:
  - User Story 1 (P1): Depends on Foundational (Phase 2).
  - User Story 2 (P2): Depends on User Story 1 contracts and DDL.
  - User Story 3 (P3): Depends on User Story 1 & 2 contracts and DDL.
  - User Story 4 (P4): Depends on Foundational & Database clients.
- **Polish (Phase 7)**: Depends on all user story implementations being complete.

### Parallel Opportunities
- In Setup: T002 and T003 can run in parallel.
- In Foundational: T005 can run in parallel with T004/T006.
- In User Story 1: T008 (tests) and T009 (user contract) can run in parallel.
- In User Story 2: T011 (tests) and T012 (facebook contracts) can run in parallel.
- In User Story 3: T014 (tests), T015 (database tests), and T016 (billing contracts) can run in parallel.
- In User Story 4: T020, T021, T022, T023, and T025 can run in parallel across web and worker shells.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (T001–T003).
2. Complete Phase 2: Foundational (T004–T007).
3. Complete Phase 3: User Story 1 (T008–T010).
4. **STOP and VALIDATE**: Test User Story 1 independently with `pnpm --filter @fbuploadpro/contracts test`.

### Incremental Delivery
1. Foundation + US1 (User & Subdomain isolation) ➔ Verify MVP.
2. US2 (Facebook Account & Page composite FKs) ➔ Verify user-level cascade safety.
3. US3 (Token Balances & Atomic Decrement) ➔ Verify ledger invariants under concurrency.
4. US4 (Web & Worker shells + Sanitized Health Probes) ➔ Verify runtime isolation and monitoring.
5. Phase 7 (CI workflow) ➔ Verify full repository automated quality gates.
