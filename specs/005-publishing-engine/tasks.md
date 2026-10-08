# Task Breakdown: Automated Queue Slots Publishing Engine & Cloudflare Edge Dispatcher

**Branch**: `feat/005-publishing-engine-tasks` | **Spec**: [specs/005-publishing-engine/spec.md](spec.md) | **Plan**: [specs/005-publishing-engine/plan.md](plan.md)

This document decomposes Spec 005 into 33 atomic, dependency-ordered tasks (T114–T146) strictly following Spec-Driven Development (SDD) and the FBUploadPro Constitution.

---

## Phase 1: Setup & Dependencies

**Purpose**: Configure worker scheduled cron trigger and environment configurations.

- [X] T114 [P] Configure Cloudflare Worker scheduled cron trigger (`crons = ["* * * * *"]`) and environment bindings in `apps/worker/wrangler.toml` and `apps/worker/src/index.ts` (Issue: #189)

---

## Phase 2: Foundational (Contracts, Validation & Database Substrate)

**Purpose**: Core data models, Zod validation schemas, and database migration that block all user stories.

- [X] T115 [P] Define `PageQueueSlot` contracts and Zod boundary validation schemas in `packages/contracts/src/domain/queue.ts` (Issue: #190)
- [X] T116 [P] Define `QueueItem`, `EnqueueMediaRequest`, and status transition schemas in `packages/contracts/src/domain/queue.ts` (Issue: #191)
- [X] T117 [P] Define `ClaimedQueueItem`, `DispatchOutcome`, and `IPublishDispatcher` contracts in `packages/contracts/src/domain/dispatcher.ts` (Issue: #192)
- [X] T118 [P] Add contract unit tests for queue schemas and validation in `packages/contracts/tests/publishing-contracts.test.ts` (Issue: #193)
- [X] T119 Create forward DDL migration `0004_publishing_engine.sql` in `packages/database/migrations/0004_publishing_engine.sql` (Issue: #194)
- [X] T120 Write database schema and constraint tests for migration 0004 asserting compound uniqueness, foreign key cascades, and `FOR UPDATE SKIP LOCKED` query in `packages/database/tests/publishing-engine.test.ts` (Issue: #195)

**Checkpoint**: Foundation ready — Page slots and queue item implementation can begin.

---

## Phase 3: User Story 1 - Page-Specific Recurring Queue Slots (Priority: P1) 🎯 MVP

**Goal**: Content creators configure recurring daily publishing time slots per connected Facebook Page with compound uniqueness and timezone support.

**Independent Test**: Configure recurring daily slots (e.g. 09:30, 14:00) for a page, verify duplicate rejection, update active toggle, and delete unused slots.

### Tests for User Story 1 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T121 [P] [US1] Write route tests for Page Queue Slots CRUD (`GET`, `POST`, `PATCH`, `DELETE`) with tenant isolation in `apps/web/tests/api/queue-slots.test.ts` (Issue: #196)

### Implementation for User Story 1

- [X] T122 [US1] Implement `GET` and `POST` handlers for Page Queue Slots in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/slots/route.ts` (Issue: #197)
- [X] T123 [US1] Implement `PATCH` and `DELETE` handlers for Page Queue Slots in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]/route.ts` (Issue: #198)
- [X] T124 [US1] Implement next vacant slot calculator utility with timezone support in `apps/web/src/lib/slot-scheduler.ts` with unit tests in `apps/web/tests/unit/slot-scheduler.test.ts` (Issue: #199)

**Checkpoint**: User Story 1 complete — Page slots can be managed and next available slot times calculated.

---

## Phase 4: User Story 2 - Selective Asset Queueing with Captions & First Comment (Priority: P2)

**Goal**: Publishers select video or image assets from Media Library, assign captions, configure optional first comment, and enqueue them into upcoming page slots.

**Independent Test**: Enqueue media assets with captions and first comments, verify pre-flight token balance check, inspect upcoming queue order, update, reorder, or skip items.

### Tests for User Story 2 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T125 [P] [US2] Write route tests for Enqueue Media, Pre-flight Token Check, and Queue Item operations in `apps/web/tests/api/publishing-queue.test.ts` (Issue: #200)

### Implementation for User Story 2

- [X] T126 [US2] Implement Enqueue Media (`POST`) handler with pre-flight token balance check (`tokens_balance >= 1`) in `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/route.ts` (Issue: #201)
- [X] T127 [US2] Implement List Queue Items (`GET`) handler with filters by page and status in `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/route.ts` (Issue: #202)
- [X] T128 [US2] Implement Update Queue Item (`PATCH`), Delete (`DELETE`), and Skip handlers in `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/route.ts` (Issue: #203)
- [X] T129 [US2] Implement Manual "Publish Now" endpoint in `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/publish-now/route.ts` (Issue: #204)

**Checkpoint**: User Story 2 complete — Assets can be enqueued, organized into slots, and managed.

---

## Phase 5: User Story 3 - Edge Dispatcher & Facebook Graph API Streaming (Priority: P3)

**Goal**: Cloudflare Worker edge scheduler executes every minute, atomically claims due items with `FOR UPDATE SKIP LOCKED`, streams Reels and Photos to Graph API v26.0, and dispatches automated first comment.

**Independent Test**: Run worker dispatcher cycle on due queue items, assert atomic claim, verify Facebook Reels/Photos API requests, and confirm first comment post.

### Tests for User Story 3 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T130 [P] [US3] Implement `IFacebookPublishClient` abstraction and mock implementation in `apps/worker/src/fb-client.ts` (Issue: #205)
- [X] T131 [P] [US3] Write unit tests for Facebook Graph API v26.0 Reels 3-phase upload, Photos upload, and First Comment in `apps/worker/tests/fb-client.test.ts` (Issue: #206)

### Implementation for User Story 3

- [X] T132 [US3] Implement PostgreSQL `FOR UPDATE SKIP LOCKED` claim logic and status transitions in `apps/worker/src/dispatcher.ts` (Issue: #207)
- [X] T133 [US3] Implement token decryption (`decryptToken`) and media dispatching loop in `apps/worker/src/dispatcher.ts` (Issue: #208)
- [X] T134 [US3] Implement automated first comment execution and external post ID recording in `apps/worker/src/dispatcher.ts` (Issue: #209)
- [X] T135 [US3] Wire Cloudflare Worker `scheduled` event listener in `apps/worker/src/index.ts` to execute `runDispatchCycle` (Issue: #210)

**Checkpoint**: User Story 3 complete — Edge dispatcher streams media to Facebook and posts first comments.

---

## Phase 6: User Story 4 - Atomic Token Deduction, Failure Logging & Schedule UI (Priority: P4)

**Goal**: Atomically deduct exactly 1 token on successful publication, log errors on failure with zero token leakage, and deliver interactive UI.

**Independent Test**: Assert 1 token deducted and transaction created on success; 0 tokens deducted on failure with error log recorded; interactive queue UI loads and displays schedule.

### Tests for User Story 4 ⚠️
> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T136 [P] [US4] Write unit and integration tests for atomic 1-token deduction on success, 0 tokens on failure, and audit logging in `apps/worker/tests/token-settlement.test.ts` (Issue: #211)

### Implementation for User Story 4

- [X] T137 [US4] Implement atomic token settlement transaction and `publish_logs` insertion in `apps/worker/src/settlement.ts` (Issue: #212)
- [X] T138 [US4] Implement Publish Logs API route handler in `apps/web/src/app/api/tenant/[subdomain]/publishing/logs/route.ts` (Issue: #213)
- [X] T139 [P] Implement Recurring Queue Slots Manager component in `apps/web/src/components/publishing/slots-manager.tsx` (Issue: #214)
- [X] T140 [P] Implement Upcoming Schedule Visualizer and Queue Item Card in `apps/web/src/components/publishing/queue-timeline.tsx` (Issue: #215)
- [X] T141 [P] Implement Enqueue Asset Modal with caption and first-comment editor in `apps/web/src/components/publishing/enqueue-modal.tsx` (Issue: #216)
- [X] T142 [P] Implement Publish History & Audit Logs component in `apps/web/src/components/publishing/publish-logs-table.tsx` (Issue: #217)
- [X] T143 Assemble full Publishing Dashboard page at `apps/web/src/app/tenant/[subdomain]/publishing/page.tsx` (Issue: #218)

**Checkpoint**: User Story 4 complete — Financial settlement verified and interactive UI operational.

---

## Phase 7: Polish & Cross-Cutting Quality Gates

**Purpose**: Security audit asserting zero cross-user queue leakage and 100% clean Turborepo pipeline validation.

- [ ] T144 [P] Multi-tenant isolation audit asserting zero cross-user queue or slot access in `apps/web/tests/security/publishing-isolation.test.ts` (Issue: #219)
- [ ] T145 Execute quickstart validation scenarios defined in `specs/005-publishing-engine/quickstart.md` (Issue: #220)
- [ ] T146 Monorepo quality gate verification across all packages (`pnpm turbo run build lint typecheck test`) (Issue: #221)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational (Phase 2).
- **User Story 2 (Phase 4 - P2)**: Depends on User Story 1 (Phase 3).
- **User Story 3 (Phase 5 - P3)**: Depends on User Story 2 (Phase 4).
- **User Story 4 (Phase 6 - P4)**: Depends on User Story 3 (Phase 5).
- **Polish (Phase 7)**: Depends on Phase 6 completion.

### Parallel Opportunities
- Foundational contract tasks (T115, T116, T117, T118) can run in parallel.
- UI components (T139, T140, T141, T142) can be built in parallel.
- All tasks marked `[P]` touch isolated files and have no mutual blockers.
