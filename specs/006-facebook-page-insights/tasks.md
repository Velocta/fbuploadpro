# Implementation Tasks: Dedicated Facebook Page Insights & Analytics Suite

**Branch**: `feat/006-facebook-page-insights-tasks` | **Spec**: [specs/006-facebook-page-insights/spec.md](spec.md) | **Plan**: [specs/006-facebook-page-insights/plan.md](plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, baseline directory structure, and shared contract foundations.

- [ ] T147 Initialize Spec 006 tracking and domain contracts directory in `packages/contracts/src/domain/insights.ts`

---

## Phase 2: Foundational (Data Substrate & Contracts)

**Purpose**: Core data models, Zod validation schemas, and database migration prerequisite for all user stories.

**⚠️ CRITICAL**: Must be completed before User Story implementation begins.

- [ ] T148 [P] Define Zod schemas and TypeScript types for `PageInsightsOverview`, `PageInsightsTimeSeriesPoint`, `PageInsightsReactions`, `PageInsightsDemographics`, `PageInsightsResponse` in `packages/contracts/src/domain/insights.ts`
- [ ] T149 [P] Write contract unit tests asserting valid schema parsing and rejection of invalid data in `packages/contracts/tests/insights-contracts.test.ts`
- [ ] T150 [P] Export insights schemas from `@fbuploadpro/contracts` barrel index `packages/contracts/src/index.ts`
- [ ] T151 [P] Create forward PostgreSQL DDL migration `0005_page_insights.sql` defining `page_insights_daily_snapshots` table with compound uniqueness `(user_id, fb_page_id, snapshot_date)` in `packages/database/migrations/0005_page_insights.sql`
- [ ] T152 [P] Define Drizzle ORM schema for `page_insights_daily_snapshots` in `packages/database/src/schema/page-insights.ts` and export from `@fbuploadpro/database`
- [ ] T153 Write database integration test for `page_insights_daily_snapshots` asserting compound tenant isolation and upsert conflict resolution in `packages/database/tests/page-insights.test.ts`

**Checkpoint**: Foundational schemas, database migrations, and contracts are verified.

---

## Phase 3: User Story 1 - Secure Server-Side Insights Proxy & Overview KPIs (Priority: P1) 🎯 MVP

**Goal**: Authenticated server-side proxy route `/api/tenant/[subdomain]/pages/[pageId]/insights` that decrypts Facebook tokens server-side via AES-256-GCM, queries Graph API v26.0 for overview KPIs, enforces 15-minute caching, and guarantees zero token leakage.

**Independent Test**: Can be validated by sending authenticated `GET` requests to the endpoint, asserting overview stats are returned with HTTP 200, verifying 15m server cache behavior, asserting cross-tenant queries return 404/403, and verifying zero token leakage.

### Tests for User Story 1
- [ ] T154 [P] [US1] Write failing integration tests for `GET /api/tenant/[subdomain]/pages/[pageId]/insights` asserting 200 response for overview metrics, 15m server cache, 404/403 cross-tenant isolation, and zero token leakage in `apps/web/tests/api/page-insights-overview.test.ts`

### Implementation for User Story 1
- [ ] T155 [US1] Implement server-side Facebook Graph API v26.0 overview client (`getPageOverview`) in `apps/web/src/lib/insights/facebook-insights-client.ts` with AES-256-GCM token decryption
- [ ] T156 [US1] Implement in-memory TTL cache with 15-minute expiration in `apps/web/src/lib/insights/insights-cache.ts`
- [ ] T157 [US1] Implement route handler `GET /api/tenant/[subdomain]/pages/[pageId]/insights` in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts` validating session, decrypting token, calling Graph API client, caching, and returning Overview KPIs
- [ ] T158 [US1] Verify all US1 tests pass in `apps/web/tests/api/page-insights-overview.test.ts`

**Checkpoint**: User Story 1 MVP complete and independently functional.

---

## Phase 4: User Story 2 - Time-Series Follower Growth & Video Performance Analytics (Priority: P2)

**Goal**: Dynamic multi-day time-series retrieval (`7d`, `14d`, `28d`, `90d`) for daily follows, unfollows, video views, 30s complete views, and watch time with automated date gap filling.

**Independent Test**: Can be validated by querying endpoint with `range=7d|14d|28d|90d` and asserting continuous chronological daily data points with mapped video metrics.

### Tests for User Story 2
- [ ] T159 [P] [US2] Write failing tests for time-series extraction and date range normalization (`7d`, `14d`, `28d`, `90d`) in `apps/web/tests/api/page-insights-timeseries.test.ts`

### Implementation for User Story 2
- [ ] T160 [US2] Implement `getPageTimeSeriesInsights` in `apps/web/src/lib/insights/facebook-insights-client.ts` querying Graph API v26.0 metrics and normalizing missing date gaps
- [ ] T161 [US2] Integrate time-series data into the route handler response in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`
- [ ] T162 [US2] Verify all US2 tests pass in `apps/web/tests/api/page-insights-timeseries.test.ts`

**Checkpoint**: User Story 2 complete and independently verifiable.

---

## Phase 5: User Story 3 - Granular Audience Reactions & Demographic Distributions (Priority: P3)

**Goal**: Parse and aggregate reaction sentiments (Like, Love, Wow, Haha, Sorry, Anger) and audience demographics (top 7 countries and cities with percentage calculations).

**Independent Test**: Can be validated by querying demographic and reaction endpoints and asserting valid sentiment counts and sorted geographic distribution lists with correct percentages.

### Tests for User Story 3
- [ ] T163 [P] [US3] Write failing tests for reaction sentiments and demographics parsing in `apps/web/tests/api/page-insights-demographics.test.ts`

### Implementation for User Story 3
- [ ] T164 [US3] Implement `getPageReactionsAndDemographics` in `apps/web/src/lib/insights/facebook-insights-client.ts` parsing sentiment counts and country/city dictionaries
- [ ] T165 [US3] Integrate reactions and demographics payloads into route handler in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`
- [ ] T166 [US3] Verify all US3 tests pass in `apps/web/tests/api/page-insights-demographics.test.ts`

**Checkpoint**: User Story 3 complete.

---

## Phase 6: User Story 4 - Dedicated High-Craft Insights Dashboard Page (Priority: P4)

**Goal**: Full-page analytical dashboard at `/tenant/[subdomain]/pages/[pageId]/insights` featuring date range selector, KPI scorecards, interactive Recharts visualizations, health banners, zero CLS skeletons, and navigation link from Accounts/Pages.

**Independent Test**: Can be validated by rendering the dashboard, verifying chart interactions and responsiveness, and checking error and empty state handling.

### Tests for User Story 4
- [ ] T167 [P] [US4] Write failing UI component tests for insights dashboard rendering, KPI cards, date range picker, and health banner in `apps/web/tests/components/insights-dashboard.test.tsx`

### Implementation for User Story 4
- [ ] T168 [P] [US4] Implement `OverviewKpiCards` in `apps/web/src/components/insights/kpi-scorecards.tsx`
- [ ] T169 [P] [US4] Implement `GrowthChart` in `apps/web/src/components/insights/growth-chart.tsx` using Recharts AreaChart
- [ ] T170 [P] [US4] Implement `VideoMetricsChart` in `apps/web/src/components/insights/video-metrics-chart.tsx` using Recharts ComposedChart
- [ ] T171 [P] [US4] Implement `ReactionsDistributionCard` in `apps/web/src/components/insights/reactions-chart.tsx` and `DemographicsCard` in `apps/web/src/components/insights/demographics-bars.tsx`
- [ ] T172 [P] [US4] Implement `InsightsHeader` and `InsightsAlerts` in `apps/web/src/components/insights/insights-header.tsx` and `apps/web/src/components/insights/insights-alerts.tsx`
- [ ] T173 [US4] Implement page route `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/insights/page.tsx` with zero-CLS skeleton in `loading.tsx` and connect "View Insights" link from Accounts/Pages list
- [ ] T174 [US4] Verify all US4 UI tests pass in `apps/web/tests/components/insights-dashboard.test.tsx`

**Checkpoint**: User Story 4 complete — High-craft analytical UI operational.

---

## Phase 7: User Story 5 - Daily Metric Snapshots & Background Edge Sync (Priority: P5)

**Goal**: Background worker scheduled sync storing daily historical metric snapshots into PostgreSQL `page_insights_daily_snapshots`.

**Independent Test**: Can be validated by triggering worker snapshot sync and verifying upserted rows in PostgreSQL with conflict resolution.

### Tests for User Story 5
- [ ] T175 [P] [US5] Write failing tests for worker daily snapshot sync routine in `apps/worker/tests/insights-sync.test.ts`

### Implementation for User Story 5
- [ ] T176 [US5] Implement `syncDailyPageInsights` in `apps/worker/src/insights-sync.ts` querying eligible pages and upserting into `page_insights_daily_snapshots`
- [ ] T177 [US5] Register daily snapshot scheduled cron job in `apps/worker/src/index.ts`
- [ ] T178 [US5] Verify all US5 tests pass in `apps/worker/tests/insights-sync.test.ts`

**Checkpoint**: User Story 5 complete — Background snapshot engine active.

---

## Phase 8: Polish & Cross-Cutting Quality Gates

**Purpose**: Security audit asserting zero cross-user insights leakage and 100% clean Turborepo pipeline validation.

- [ ] T179 [P] Security audit asserting zero token leakage in responses or logs in `apps/web/tests/security/insights-token-leakage.test.ts`
- [ ] T180 Execute quickstart validation scenarios defined in `specs/006-facebook-page-insights/quickstart.md`
- [ ] T181 Monorepo quality gate verification across all packages (`pnpm turbo run build lint typecheck test`)

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
