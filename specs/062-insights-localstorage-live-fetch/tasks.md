# Implementation Tasks: Live Facebook Insights with 15-Minute LocalStorage Caching

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Branch**: `feat/062-insights-localstorage-live-fetch`

---

## Phase 1: Setup

- [x] T001 Verify project structure and ensure `specs/062-insights-localstorage-live-fetch` artifacts are complete.

---

## Phase 2: Foundational Data & Contract Updates

- [x] T002 [P] Create forward migration in `supabase/migrations/20261021000000_drop_page_insights_daily_snapshots.sql` to drop `page_insights_daily_snapshots` table and related indexes.
- [x] T003 [P] Remove `page_insights_daily_snapshots` definition from `packages/contracts/src/domain/database.ts` and clean up `PageInsightsDailySnapshot` from `packages/contracts/src/domain/insights.ts`.

---

## Phase 3: User Story 1 - Client-Side 15-Minute LocalStorage Caching & Instant View Resumption (Priority: P1)

**Goal**: Store insights responses in `localStorage` for 15 minutes, rendering instantly upon page load/refresh without skeleton loaders or network calls.

- [x] T004 [US1] Create local storage utility helper functions (`getCachedInsights`, `setCachedInsights`) in `apps/web/src/components/pages/dedicated/tab-insights.tsx` (or `apps/web/src/lib/insights/client-cache.ts`) with 15-minute expiration (`900000ms`) and safe error trapping for private browsing.
- [x] T005 [US1] Update `PageTabInsights` in `apps/web/src/components/pages/dedicated/tab-insights.tsx` to read from `localStorage` on initial mount and range switches; if unexpired cache exists, initialize state directly from cache with `isLoading = false` so no loading skeleton is rendered.
- [x] T006 [US1] On successful network response, write the payload to `localStorage` with `expiresAt = Date.now() + 15 * 60 * 1000`.
- [x] T007 [US1] Add unit tests in `apps/web/tests/ui/tab-insights.test.tsx` verifying instant `localStorage` cache read, zero network calls when cache is unexpired, and private browsing error tolerance.

---

## Phase 4: User Story 2 - Manual Live Sync Bypass & Real-Time Graph API Fetch (Priority: P2)

**Goal**: Allow users to click the "Sync" button to bypass `localStorage`, query live Facebook Graph API v26.0, update the UI, and reset the 15-minute timer.

- [x] T008 [US2] Update `handleManualRefresh` in `apps/web/src/components/pages/dedicated/tab-insights.tsx` to explicitly bypass `localStorage`, set spinning `isRefreshing` state, call API with `refresh=true`, and write fresh data into `localStorage` resetting `expiresAt`.
- [x] T009 [US2] Add unit tests in `apps/web/tests/ui/tab-insights.test.tsx` asserting that clicking Sync calls the API, shows the spinning indicator, updates the UI, and updates `localStorage`.

---

## Phase 5: User Story 3 - Direct Server-Side Facebook Graph API Proxy & Upstash Redis Removal (Priority: P3)

**Goal**: Streamline `/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts` to be a direct, secure Facebook Graph API v26.0 proxy with zero token leakage, eliminating Upstash Redis and snapshot queries.

- [x] T010 [US3] Remove Upstash Redis cache checks, sets, and imports from `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`.
- [x] T011 [US3] Remove snapshot queries, `assembleInsightsFromSnapshots`, and database fallback logic from `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`.
- [x] T012 [US3] Ensure `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts` directly decrypts the Facebook Page token, calls Facebook Graph API v26.0 (`getPageOverview`, `getPageTimeSeriesInsights`, `getPageReactionsAndDemographics`), and returns the sanitized `PageInsightsResponse` with `Cache-Control: private, no-cache`.
- [x] T013 [US3] Update API unit and security tests in `apps/web/tests/api/page-insights-overview.test.ts`, `apps/web/tests/api/page-insights-timeseries.test.ts`, and `apps/web/tests/security/insights-token-leakage.test.ts` to test the pure live proxy without Redis or database snapshots.

---

## Phase 6: User Story 4 - Complete Removal of Worker Insights Cron & Cleanups (Priority: P4)

**Goal**: Completely remove insights sync code and cron triggers from `apps/worker`.

- [x] T014 [US4] Remove `insights-sync.ts` exports, imports, and scheduled cron execution from `apps/worker/src/index.ts`.
- [x] T015 [US4] Delete `apps/worker/src/insights-sync.ts` and `apps/worker/tests/insights-sync.test.ts`.

---

## Phase 7: Polish & Monorepo Consistency

- [x] T016 Deprecate or remove unused `InsightsCache` methods from `apps/web/src/lib/insights/insights-cache.ts` and update `apps/web/tests/lib/insights-cache.test.ts` if needed.
- [x] T017 Audit all files for TypeScript type safety and ensure zero lingering references to `page_insights_daily_snapshots` or Upstash Redis insights caching.
