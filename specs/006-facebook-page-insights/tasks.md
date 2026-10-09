# Implementation Tasks: Dedicated Facebook Page Insights & Analytics Suite

**Branch**: `feat/006-facebook-page-insights-tasks` | **Spec**: [specs/006-facebook-page-insights/spec.md](spec.md) | **Plan**: [specs/006-facebook-page-insights/plan.md](plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, baseline directory structure, and shared contract foundations.

- [X] T147 Initialize Spec 006 tracking and domain contracts directory in `packages/contracts/src/domain/insights.ts` (Issue: #248)

---

## Phase 2: Foundational (Data Substrate & Contracts)

**Purpose**: Core data models, Zod validation schemas, and database migration prerequisite for all user stories.

**⚠️ CRITICAL**: Must be completed before User Story implementation begins.

- [X] T148 [P] Define Zod schemas and TypeScript types for `PageInsightsOverview`, `PageInsightsTimeSeriesPoint`, `PageInsightsReactions`, `PageInsightsDemographics`, `PageInsightsResponse` in `packages/contracts/src/domain/insights.ts` (Issue: #249)
- [X] T149 [P] Write contract unit tests asserting valid schema parsing and rejection of invalid data in `packages/contracts/tests/insights-contracts.test.ts` (Issue: #250)
- [X] T150 [P] Export insights schemas from `@fbuploadpro/contracts` barrel index `packages/contracts/src/index.ts` (Issue: #251)
- [X] T151 [P] Create forward PostgreSQL DDL migration `0005_page_insights.sql` defining `page_insights_daily_snapshots` table with compound uniqueness `(user_id, fb_page_id, snapshot_date)` in `packages/database/migrations/0005_page_insights.sql` (Issue: #252)
- [X] T152 [P] Define Drizzle ORM schema for `page_insights_daily_snapshots` in `packages/database/src/schema/page-insights.ts` and export from `@fbuploadpro/database` (Issue: #253)
- [X] T153 Write database integration test for `page_insights_daily_snapshots` asserting compound tenant isolation and upsert conflict resolution in `packages/database/tests/page-insights.test.ts` (Issue: #254)

**Checkpoint**: Foundational schemas, database migrations, and contracts are verified.

---

## Phase 3: User Story 1 - Secure Server-Side Insights Proxy & Overview KPIs (Priority: P1) 🎯 MVP

**Goal**: Authenticated server-side proxy route `/api/tenant/[subdomain]/pages/[pageId]/insights` that decrypts Facebook tokens server-side via AES-256-GCM, queries Graph API v26.0 for overview KPIs, enforces 15-minute caching, and guarantees zero token leakage.

**Independent Test**: Can be validated by sending authenticated `GET` requests to the endpoint, asserting overview stats are returned with HTTP 200, verifying 15m server cache behavior, asserting cross-tenant queries return 404/403, and verifying zero token leakage.

### Tests for User Story 1
- [X] T154 [P] [US1] Write failing integration tests for `GET /api/tenant/[subdomain]/pages/[pageId]/insights` asserting 200 response for overview metrics, 15m server cache, 404/403 cross-tenant isolation, and zero token leakage in `apps/web/tests/api/page-insights-overview.test.ts` (Issue: #255)

### Implementation for User Story 1
- [X] T155 [US1] Implement server-side Facebook Graph API v26.0 overview client (`getPageOverview`) in `apps/web/src/lib/insights/facebook-insights-client.ts` with AES-256-GCM token decryption (Issue: #256)
- [X] T156 [US1] Implement in-memory TTL cache with 15-minute expiration in `apps/web/src/lib/insights/insights-cache.ts` (Issue: #257)
- [X] T157 [US1] Implement route handler `GET /api/tenant/[subdomain]/pages/[pageId]/insights` in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts` validating session, decrypting token, calling Graph API client, caching, and returning Overview KPIs (Issue: #258)
- [X] T158 [US1] Verify all US1 tests pass in `apps/web/tests/api/page-insights-overview.test.ts` (Issue: #259)

**Checkpoint**: User Story 1 MVP complete and independently functional.

---

## Phase 4: User Story 2 - Time-Series Follower Growth & Video Performance Analytics (Priority: P2)

**Goal**: Dynamic multi-day time-series retrieval (`7d`, `14d`, `28d`, `90d`) for daily follows, unfollows, video views, 30s complete views, and watch time with automated date gap filling.

**Independent Test**: Can be validated by querying endpoint with `range=7d|14d|28d|90d` and asserting continuous chronological daily data points with mapped video metrics.

### Tests for User Story 2
- [X] T159 [P] [US2] Write failing tests for time-series extraction and date range normalization (`7d`, `14d`, `28d`, `90d`) in `apps/web/tests/api/page-insights-timeseries.test.ts` (Issue: #260)

### Implementation for User Story 2
- [X] T160 [US2] Implement `getPageTimeSeriesInsights` in `apps/web/src/lib/insights/facebook-insights-client.ts` querying Graph API v26.0 metrics and normalizing missing date gaps (Issue: #261)
- [X] T161 [US2] Integrate time-series data into the route handler response in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts` (Issue: #262)
- [X] T162 [US2] Verify all US2 tests pass in `apps/web/tests/api/page-insights-timeseries.test.ts` (Issue: #263)

**Checkpoint**: User Story 2 complete and independently verifiable.

---

## Phase 5: User Story 3 - Granular Audience Reactions & Demographic Distributions (Priority: P3)

**Goal**: Parse and aggregate reaction sentiments (Like, Love, Wow, Haha, Sorry, Anger) and audience demographics (top 7 countries and cities with percentage calculations).

**Independent Test**: Can be validated by querying demographic and reaction endpoints and asserting valid sentiment counts and sorted geographic distribution lists with correct percentages.

### Tests for User Story 3
- [X] T163 [P] [US3] Write failing tests for reaction sentiments and demographics parsing in `apps/web/tests/api/page-insights-demographics.test.ts` (Issue: #264)

### Implementation for User Story 3
- [X] T164 [US3] Implement `getPageReactionsAndDemographics` in `apps/web/src/lib/insights/facebook-insights-client.ts` parsing sentiment counts and country/city dictionaries (Issue: #265)
- [X] T165 [US3] Integrate reactions and demographics payloads into route handler in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts` (Issue: #266)
- [X] T166 [US3] Verify all US3 tests pass in `apps/web/tests/api/page-insights-demographics.test.ts` (Issue: #267)

**Checkpoint**: User Story 3 complete.

---

## Phase 6: User Story 4 - Analytics Contracts & API Integration (Priority: P4)

> [!NOTE]
> Backend Graph API proxy, TTL cache, and worker daily snapshot sync remain fully operational.

**Goal**: Dedicated insights analytical API and contract verification.

**Independent Test**: Can be validated by executing Graph API proxy calls, verifying response shapes match contracts, and checking error and cache handling.

### Implementation for User Story 4
- [X] T167 [US4] Verify response contract schemas and error transformations in `apps/web/tests/api/page-insights-timeseries.test.ts` and `apps/web/tests/api/page-insights-demographics.test.ts` (Issue: #268)

**Checkpoint**: Backend proxy, contracts, and sync complete.

---

## Phase 7: User Story 5 - Daily Metric Snapshots & Background Edge Sync (Priority: P5)

**Goal**: Background worker scheduled sync storing daily historical metric snapshots into PostgreSQL `page_insights_daily_snapshots`.

**Independent Test**: Can be validated by triggering worker snapshot sync and verifying upserted rows in PostgreSQL with conflict resolution.

### Tests for User Story 5
- [X] T175 [P] [US5] Write failing tests for worker daily snapshot sync routine in `apps/worker/tests/insights-sync.test.ts` (Issue: #276)

### Implementation for User Story 5
- [X] T176 [US5] Implement `syncDailyPageInsights` in `apps/worker/src/insights-sync.ts` querying eligible pages and upserting into `page_insights_daily_snapshots` (Issue: #277)
- [X] T177 [US5] Register daily snapshot scheduled cron job in `apps/worker/src/index.ts` (Issue: #278)
- [X] T178 [US5] Verify all US5 tests pass in `apps/worker/tests/insights-sync.test.ts` (Issue: #279)

**Checkpoint**: User Story 5 complete — Background snapshot engine active.

---

## Phase 8: Polish & Cross-Cutting Quality Gates

**Purpose**: Security audit asserting zero cross-user insights leakage and 100% clean Turborepo pipeline validation.

- [X] T179 [P] Security audit asserting zero token leakage in responses or logs in `apps/web/tests/security/insights-token-leakage.test.ts` (Issue: #280)
- [X] T180 Execute quickstart validation scenarios defined in `specs/006-facebook-page-insights/quickstart.md` (Issue: #281)
- [X] T181 Monorepo quality gate verification across all packages (`pnpm turbo run build lint typecheck test`) (Issue: #282)

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories.
- **User Story 1 (Phase 3 - P1)**: Depends on Foundational (Phase 2).
- **User Story 2 (Phase 4 - P2)**: Depends on User Story 1 (Phase 3).
- **User Story 3 (Phase 5 - P3)**: Depends on User Story 2 (Phase 4).
- **User Story 4 (Phase 6 - P4)**: Depends on User Story 3 (Phase 5).
- **User Story 5 (Phase 7 - P5)**: Can run in parallel with or after User Story 4.
- **Polish (Phase 8)**: Depends on all prior phases being complete.

### Parallel Opportunities
- Foundational contract tasks (T148, T149, T150, T151, T152) can run in parallel.
- UI components (T168, T169, T170, T171, T172) can be built in parallel.
- All tasks marked `[P]` touch isolated files and have no mutual blockers.
