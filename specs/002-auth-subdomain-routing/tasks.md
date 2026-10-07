# Tasks: Authentication & Multi-Tenant Subdomain Routing Isolation

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Branch**: `spec/002-auth-subdomain-routing`

This document decomposes the implementation plan into dependency-ordered, atomic tasks (<150–200 LoC each) adhering strictly to Spec-Driven Development, TDD, and the unified User model.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment configuration and test setup for subdomain routing and edge authentication.

- [X] T029 Configure environment variables template and test fixtures for multi-tenant routing and session signing in apps/web/.env.example and packages/contracts/tests/fixtures/session.ts (Issue: #56)

---

## Phase 2: Foundational (Session & Routing Contracts)

**Purpose**: Core cryptographic session, subdomain extraction, and RBAC contracts that MUST be complete before middleware and web layouts can be built.

**⚠️ CRITICAL**: No user story work can begin until this foundational phase is complete.

### Tests for Foundational Contracts (TDD) ⚠️
- [X] T030 [P] Write unit tests for SessionPayloadSchema and Web Crypto session signing/verification in packages/contracts/tests/session.test.ts (Issue: #57)
- [X] T031 [P] Write unit tests for subdomain extraction and path rewriting in packages/contracts/tests/routing.test.ts (Issue: #58)
- [X] T032 [P] Write unit tests for Role-Based Access Control hierarchy and tenant access guard in packages/contracts/tests/rbac.test.ts (Issue: #59)

### Implementation of Foundational Contracts
- [X] T033 [P] Implement SessionPayloadSchema, signSessionToken, and verifySessionToken using Web Crypto API in packages/contracts/src/domain/session.ts (Issue: #60)
- [X] T034 [P] Implement extractSubdomain and getTenantRewriteUrl handling apex, ports, and reserved slugs in packages/contracts/src/domain/routing.ts (Issue: #61)
- [X] T035 [P] Implement ROLE_HIERARCHY, hasRole, and canAccessTenant in packages/contracts/src/domain/rbac.ts (Issue: #62)
- [X] T036 Export new session, routing, and RBAC contracts in packages/contracts/src/index.ts (Issue: #63)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Subdomain Detection & Workspace Edge Routing (Priority: P1) 🎯 MVP

**Goal**: Deliver Next.js Edge Middleware that parses incoming host headers, ignores apex/reserved domains, and internally rewrites tenant subdomains to `/tenant/[subdomain]/*`.

**Independent Test**: Can be validated using Vitest by sending mock requests with various Host headers (`localhost:3000`, `www.fbuploadpro.com`, `admin.fbuploadpro.com`, `client.fbuploadpro.com`) and verifying correct internal path rewriting.

### Tests for User Story 1 (TDD) ⚠️
- [X] T037 [P] [US1] Write unit and integration tests for Next.js Edge Middleware subdomain rewriting and header injection in apps/web/tests/middleware-routing.test.ts (Issue: #64)

### Implementation for User Story 1
- [X] T038 [US1] Implement Next.js Edge Middleware for hostname inspection, subdomain extraction, and internal path rewriting in apps/web/src/middleware.ts (Issue: #65)
- [X] T039 [US1] Implement public marketing root page and reserved slug routes in apps/web/src/app/page.tsx and apps/web/src/app/login/page.tsx (Issue: #66)

**Checkpoint**: At this point, User Story 1 is functional and testable independently.

---

## Phase 4: User Story 2 - Tenant Subdomain Ownership Verification & Auth Guard (Priority: P2)

**Goal**: Protect tenant workspace routes with session authentication, verifying tenant subdomain ownership and blocking cross-tenant access.

**Independent Test**: Can be validated by executing middleware tests with valid, missing, mismatched, and suspended user session tokens.

### Tests for User Story 2 (TDD) ⚠️
- [X] T040 [P] [US2] Write unit and integration tests for session extraction and tenant ownership verification guard in apps/web/tests/middleware-auth.test.ts (Issue: #67)

### Implementation for User Story 2
- [X] T041 [US2] Integrate session authentication guard and tenant ownership checks into Next.js Edge Middleware in apps/web/src/middleware.ts (Issue: #68)
- [X] T042 [US2] Implement server-side session extraction helper in apps/web/src/lib/auth.ts and account suspended notice page in apps/web/src/app/account-suspended/page.tsx (Issue: #69)

**Checkpoint**: At this point, User Stories 1 and 2 work independently.

---

## Phase 5: User Story 3 - Role-Based Access Control (RBAC) across Tenant Roles (Priority: P3)

**Goal**: Enforce role privilege checks (`user`, `seller`, `admin`) across tenant routes and features.

**Independent Test**: Can be validated by testing role-guarded endpoints, asserting standard user cannot access seller or admin features, seller can access seller features, and admin has superuser access.

### Tests for User Story 3 (TDD) ⚠️
- [X] T043 [P] [US3] Write integration tests for RBAC route protection in apps/web/tests/rbac-routes.test.ts (Issue: #70)

### Implementation for User Story 3
- [X] T044 [US3] Implement RBAC route helper and seller route guard in apps/web/src/lib/rbac.ts and apps/web/src/app/tenant/[subdomain]/seller/page.tsx (Issue: #71)

**Checkpoint**: At this point, User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 - Multi-Tenant Workspace Dashboard Shell (Priority: P4)

**Goal**: Deliver Next.js App Router workspace shell displaying tenant subdomain badge, user role badge, and live tokens balance from PostgreSQL.

**Independent Test**: Can be validated by testing server component rendering of dashboard shell, verifying correct tenant subdomain badge, role badge, and token balance without leaking credentials.

### Tests for User Story 4 (TDD) ⚠️
- [ ] T045 [P] [US4] Write tests for dashboard shell component and tenant layout in apps/web/tests/dashboard.test.ts (Issue: #72)

### Implementation for User Story 4
- [ ] T046 [US4] Implement tenant workspace layout with navigation header, subdomain badge, role badge, and token balance in apps/web/src/app/tenant/[subdomain]/layout.tsx (Issue: #73)
- [ ] T047 [US4] Implement tenant workspace dashboard page and default redirect in apps/web/src/app/tenant/[subdomain]/page.tsx and apps/web/src/app/tenant/[subdomain]/dashboard/page.tsx (Issue: #74)

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification and full CI quality gate validation.

- [ ] T048 [P] Execute end-to-end quickstart validation for Spec 002 in specs/002-auth-subdomain-routing/quickstart.md (Issue: #75)
- [ ] T049 Verify all quality gates pass across Turborepo pipeline with pnpm turbo run build lint typecheck test (Issue: #76)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 — MVP.
- **User Story 2 (Phase 4)**: Depends on Phase 3 (extends middleware).
- **User Story 3 (Phase 5)**: Depends on Phase 4.
- **User Story 4 (Phase 6)**: Depends on Phase 4 & Phase 5.
- **Polish (Phase 7)**: Depends on all user stories complete.

### Parallel Opportunities
- Foundational tests (T030, T031, T032) can run in parallel.
- Foundational domain models (T033, T034, T035) can run in parallel.
- Tests within each user story can be written before implementation.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (T029)
2. Complete Phase 2: Foundational (T030-T036)
3. Complete Phase 3: User Story 1 (T037-T039)
4. Validate User Story 1 independently with edge rewrite tests.

### Incremental Delivery
1. Add User Story 2 (T040-T042) ➔ Session authentication & tenant isolation guard.
2. Add User Story 3 (T043-T044) ➔ RBAC permissions.
3. Add User Story 4 (T045-T047) ➔ Dashboard shell with live token balance.
4. Polish & Quality Gates (T048-T049) ➔ Turborepo 100% clean.
