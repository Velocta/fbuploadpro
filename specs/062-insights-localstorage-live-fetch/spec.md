# Feature Specification: Live Facebook Insights with 15-Minute LocalStorage Caching

**Feature Branch**: `feat/062-insights-localstorage-live-fetch`

**Created**: 2026-10-16

**Status**: Ready for Review

**Input**: User description: "i want to remove the snapshort and upstash redis entirely and make it fetch from live facebook and save it in local storage for 15 min so user gets cached data when refreshed and only get fresh data after 15 min or when clicked sync for the cloudflare worker i want to remove it entirely for insights"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Client-Side 15-Minute LocalStorage Caching & Instant View Resumption (Priority: P1)

As a creator or social media manager viewing my Page's performance, I want the insights data to be saved in my browser's local storage for 15 minutes, so that when I refresh the page or return to the Insights tab, the charts and metrics load instantly without any loading skeleton or unnecessary network requests.

**Why this priority**: Core user experience requirement. Providing instant loads from client storage eliminates loading delays on frequent workspace navigation while drastically saving Facebook API quota.

**Independent Test**: Can be validated by opening the Insights tab, verifying data is cached in `localStorage` under `insights:${pageId}:${range}`, refreshing the browser tab within 15 minutes, and asserting that the UI displays immediately from `localStorage` without triggering a network fetch to `/api/tenant/[subdomain]/pages/[pageId]/insights`.

**Acceptance Scenarios**:

1. **Given** a user navigates to the Page Insights tab for range `28d`, **When** the network call completes successfully, **Then** the response is saved in `localStorage` with a timestamp and a 15-minute expiration (`expiresAt = Date.now() + 15 * 60 * 1000`).
2. **Given** cached data exists in `localStorage` and `Date.now() < item.expiresAt`, **When** the user refreshes the page or switches tabs back to Insights, **Then** the cached data is loaded directly into the UI with zero network requests and zero loading skeleton delay.
3. **Given** cached data in `localStorage` has exceeded 15 minutes (`Date.now() >= item.expiresAt`), **When** the user visits the Insights tab, **Then** the system automatically triggers a background network request to fetch fresh metrics from Facebook and updates the `localStorage` cache.
4. **Given** a user switches between date ranges (`7d`, `14d`, `28d`, `90d`), **When** an unexpired cache entry exists for that specific range, **Then** it loads instantly from `localStorage`; if missing or expired, it initiates a fetch for that specific range and caches it independently.

---

### User Story 2 - Manual Live Sync Bypass & Real-Time Graph API Fetch (Priority: P2)

As a creator who just published new videos or launched an engagement campaign, I want to click the "Sync" button to bypass the 15-minute local cache, so that I can immediately pull fresh, live metrics directly from Facebook.

**Why this priority**: Essential operator control. When users want immediate verification of current metrics, they need an explicit override mechanism to bypass local caching.

**Independent Test**: Can be validated by clicking the "Sync" button while an unexpired `localStorage` cache exists, asserting that a live request is made with `?refresh=true`, verifying the button transitions to a spinning "Syncing..." state, and confirming that `localStorage` is overwritten with the fresh data and a new 15-minute expiration window.

**Acceptance Scenarios**:

1. **Given** an unexpired cache in `localStorage`, **When** the user clicks the "Sync" button, **Then** the application bypasses the local cache, shows the spinning sync indicator, and issues a live fetch to the server endpoint with `refresh=true`.
2. **Given** a successful live sync response, **When** the fresh data arrives, **Then** the UI updates immediately with the new numbers, updates the `localStorage` entry, and resets the 15-minute expiration timer from the current moment.
3. **Given** a network or upstream Facebook error during manual sync, **When** the fetch fails, **Then** an error banner is displayed with a Retry option, and the existing valid cached data remains preserved in `localStorage`.

---

### User Story 3 - Direct Server-Side Facebook Graph API Proxy & Upstash Redis Removal (Priority: P3)

As a platform engineer and security operator, I want the insights API route to fetch live from Facebook Graph API v26.0 through a direct server-side proxy without Upstash Redis caching, so that access tokens remain securely isolated on the server while eliminating external Redis infrastructure dependencies for insights.

**Why this priority**: Simplifies the backend runtime while maintaining the monorepo's strict zero-token-leakage security posture.

**Independent Test**: Can be validated by issuing `GET /api/tenant/[subdomain]/pages/[pageId]/insights?range=28d`, asserting that it decrypts the Facebook Page token server-side, queries Facebook Graph API v26.0 directly, returns sanitized analytics without Upstash Redis dependency, and never exposes access tokens to the browser.

**Acceptance Scenarios**:

1. **Given** an authenticated tenant request for Page insights, **When** the route handler executes, **Then** it decrypts the Page's access token server-side via AES-256-GCM and directly queries Graph API v26.0 for overview, time series, reactions, and demographics.
2. **Given** production environments without Upstash Redis configured for insights, **When** the insights route is called, **Then** the server does not require or attempt to connect to Upstash Redis for insights data.
3. **Given** any upstream Graph API error (e.g. invalid token, checkpoint), **When** Facebook returns an error response, **Then** the proxy formats a typed error or health status (`invalid_token`, `rate_limited`) without crashing or exposing raw stack traces.

---

### User Story 4 - Complete Removal of Database Snapshots & Cloudflare Worker Insights Cron (Priority: P4)

As a system maintainer, I want to completely remove the `page_insights_daily_snapshots` database table, database fallback queries, and the Cloudflare Worker insights sync cron, so that background compute cycles and database storage are streamlined.

**Why this priority**: Eliminates dead code, scheduled worker load, and database storage bloat that is no longer part of the live insights architecture.

**Independent Test**: Can be validated by checking that the database migration drops `page_insights_daily_snapshots`, verifying that `apps/worker` contains zero references or scheduled crons for `syncDailyPageInsights`, and confirming that all worker dispatch cycles execute solely for publishing and downloader tasks.

**Acceptance Scenarios**:

1. **Given** the database schema, **When** forward migration executes, **Then** the table `page_insights_daily_snapshots` is safely dropped.
2. **Given** the Cloudflare Worker scheduled execution, **When** cron ticks occur, **Then** the worker executes queue recovery and publishing dispatch without any insights sync routines.
3. **Given** `apps/worker/src/index.ts`, **When** inspected, **Then** all exports, imports, and options relating to `insights-sync` are cleanly removed.

---

## Edge Cases

- **Private Browsing / LocalStorage Blocked**: If `localStorage` is disabled, throws a QuotaExceededError, or is unavailable in the browser environment, the client component must gracefully fall back to in-memory component state without crashing.
- **Corrupted LocalStorage Data**: If `localStorage` contains invalid JSON or schema-violating data, the client must catch the parse error, clear the corrupted key, and fetch fresh data from the server.
- **Multiple Pages in Workspace**: Cache keys must be scoped uniquely per page ID and range (e.g., `fbup_insights_${pageId}_${range}`) so data for Page A never displays for Page B.
- **User Signs Out / Workspace Switch**: Cache keys should be easily invalidated or scoped such that switching accounts or workspaces does not display stale insights from previous sessions.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store fetched insights responses in browser `localStorage` keyed by page ID and date range (`insights:${pageId}:${range}`).
- **FR-002**: System MUST store an expiration timestamp (`expiresAt = Date.now() + 15 * 60 * 1000`) alongside the cached insights payload in `localStorage`.
- **FR-003**: System MUST check `localStorage` upon mounting the Insights tab; if an unexpired entry exists for the selected range, it MUST render the cached data immediately without displaying a loading skeleton or issuing a network fetch.
- **FR-004**: System MUST automatically trigger a network fetch to refresh data if the `localStorage` entry is missing or has expired (`Date.now() >= expiresAt`).
- **FR-005**: System MUST bypass `localStorage` and force a live network request to `/api/tenant/[subdomain]/pages/[pageId]/insights?range=${range}&refresh=true` whenever the user clicks the "Sync" button.
- **FR-006**: System MUST update `localStorage` and reset the 15-minute expiration timer upon receiving any successful insights response (initial load, expiration refresh, or manual sync).
- **FR-007**: Server route handler (`/api/tenant/[subdomain]/pages/[pageId]/insights`) MUST query Facebook Graph API v26.0 directly using server-side decrypted access tokens, maintaining 100% zero-token-leakage to the client.
- **FR-008**: Server route handler MUST NOT require or invoke Upstash Redis for insights caching.
- **FR-009**: Server route handler MUST NOT query or assemble metrics from `page_insights_daily_snapshots`.
- **FR-010**: System MUST drop the `page_insights_daily_snapshots` database table via a versioned forward SQL migration in `supabase/migrations/`.
- **FR-011**: Cloudflare Worker runtime (`apps/worker`) MUST completely remove `insights-sync.ts`, the `syncDailyPageInsights` invocation, and any insights-related cron triggers.
- **FR-012**: Domain contracts in `@fbuploadpro/contracts` MUST remove `PageInsightsDailySnapshot` and remove references to snapshots while keeping all live analytical response types (`PageInsightsResponse`, `PageInsightsOverview`, `PageInsightsTimeSeriesPoint`, `PageInsightsReactions`, `PageInsightsDemographics`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of repeat page visits or browser refreshes within 15 minutes display insights data in under 50 milliseconds directly from `localStorage` with zero network requests.
- **SC-002**: Clicking "Sync" forces a fresh Graph API call and refreshes both the UI and the 15-minute `localStorage` expiration timestamp.
- **SC-003**: 0 server requests for insights interact with Upstash Redis or PostgreSQL snapshot tables.
- **SC-004**: Cloudflare Worker bundle and execution time are reduced by excising all insights sync code and cron jobs.
- **SC-005**: 100% zero client-side token exposure is preserved across all insights requests.

---

## Assumptions

- Browser `localStorage` has ample capacity (typical insights payload is ~5–15 KB, well below the standard 5 MB browser limit).
- The 15-minute TTL matches the user's explicit specification for freshness and rate-limit conservation.
- Upstash Redis may still be used elsewhere in the application for authentication rate limiting (`rate-limiter.ts`), but is completely removed from insights.
