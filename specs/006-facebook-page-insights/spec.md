# Feature Specification: Dedicated Facebook Page Insights & Analytics Suite

**Feature Branch**: `feat/006-facebook-page-insights-spec`

**Created**: 2026-10-08

**Status**: Ready for Planning

**Input**: User description: "Dedicated Facebook Page Insights with time-series follower growth, video complete views, watch time, reactions breakdown, demographics, hybrid PostgreSQL snapshots, and server-side Graph API v26.0 proxy"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Server-Side Insights Proxy & Overview KPIs (Priority: P1)

As a content creator managing Facebook Pages, I want to view my connected Page's live follower count, fan count, and recent engagement KPIs securely through my workspace, so that I have immediate visibility into my Page's reach without exposing sensitive Facebook access tokens to the browser.

**Why this priority**: Foundational security and core metric substrate. Every analytics visualization depends on authenticated, tenant-isolated Graph API access that strictly complies with the zero-leakage security constitution.

**Independent Test**: Can be validated by issuing `GET /api/tenant/[subdomain]/pages/[pageId]/insights?range=28d` with valid tenant session cookie, asserting that the response returns sanitized Overview KPIs (`fanCount`, `followersCount`, cachedAt timestamp), decrypts the Page access token entirely on the server, never includes any access token or secret in payload headers or body, and rejects unauthorized cross-tenant requests.

**Acceptance Scenarios**:

1. **Given** an authenticated user on their workspace subdomain and an active connected Facebook Page, **When** they request Page Insights overview data, **Then** the server decrypts the Page access token via AES-256-GCM, queries Facebook Graph API v26.0 (`/{page-id}?fields=fan_count,followers_count`), and returns sanitized overview metrics with HTTP 200.
2. **Given** consecutive requests for the same Page's insights within the 15-minute cache window, **When** the client requests insights, **Then** the server serves cached metrics without making unnecessary external calls to Facebook Graph API, respecting Facebook rate limits.
3. **Given** a user in Workspace A, **When** they attempt to request insights for a Facebook Page belonging to Workspace B, **Then** the server rejects the request with HTTP 404/403 and returns zero metric data.
4. **Given** any error response from Facebook Graph API (e.g. token expired, 2FA required on Business Manager), **When** the proxy processes the error, **Then** it classifies the issue into a structured health status (`invalid_token`, `2fa_required_on_BM`, `rate_limited`) without leaking internal exception traces or token strings.

---

### User Story 2 - Time-Series Follower Growth & Video Performance Analytics (Priority: P2)

As a digital media creator, I want to inspect interactive time-series charts showing daily follower growth, unfollows, video views, 30-second complete views, and total watch time over 7, 14, 28, or 90 days, so that I can evaluate which content strategies drive sustained audience retention.

**Why this priority**: Core value proposition for video publishers. Video metrics (especially 30-second completions and watch minutes) are critical indicators of algorithm distribution on Facebook Reels.

**Independent Test**: Can be validated by querying the Insights API with different date ranges (`7d`, `14d`, `28d`, `90d`), asserting that daily time-series buckets are returned with zero missing date gaps, and verifying that video views (`page_video_views`, `page_video_complete_views_30s`, `page_video_view_time`) are correctly mapped to their respective calendar days.

**Acceptance Scenarios**:

1. **Given** an active Facebook Page with publishing history, **When** the user selects the "28 Days" range filter, **Then** the API retrieves time-series metrics (`page_follows`, `page_daily_follows_unique`, `page_daily_unfollows_unique`, `page_media_view`, `page_total_media_view_unique`, `page_video_views`, `page_video_complete_views_30s`, `page_video_view_time`), fills missing dates with zeros, and formats each data point with standardized ISO dates (`YYYY-MM-DD`).
2. **Given** a newly connected Page with limited historical posting activity, **When** the time-series endpoint is queried, **Then** the API returns an empty or sparse series gracefully without throwing null pointer or arithmetic exceptions.
3. **Given** the user toggling between 7-day, 14-day, and 28-day intervals, **When** the query parameter changes, **Then** the API computes the correct `since` and `until` UNIX epoch bounds and returns matching chronological records.

---

### User Story 3 - Granular Audience Reactions & Demographic Distributions (Priority: P3)

As a content marketing operator, I want to see detailed reaction sentiment breakdowns (Likes, Love, Wow, Haha, Sorry, Anger) and audience demographics (top countries and top cities), so that I know who my audience is and where my content resonates internationally.

**Why this priority**: Actionable audience intelligence. High-growth creators tailor localized content and monetization based on geographical distribution and emotional resonance.

**Independent Test**: Can be validated by querying demographic and reaction metrics, verifying that sentiment counts are correctly categorized by reaction type, and asserting that raw country/city dictionaries from Facebook Graph API are transformed into sorted top-7 lists with both raw counts and percentage proportions.

**Acceptance Scenarios**:

1. **Given** a Page with active audience engagement, **When** the user views the Reactions module, **Then** the system presents aggregated totals and distributions for Like, Love, Wow, Haha, Sorry, and Anger reactions.
2. **Given** Facebook Graph API returning raw key-value objects for `page_follows_country` (e.g. `{"US": 1500, "GB": 800, "PK": 600}`), **When** the system parses the data, **Then** it transforms the object into an ordered array sorted by count descending, truncates to top 7, and calculates proportional percentages summing to 100% of the parsed subset.
3. **Given** Facebook Graph API returning `page_follows_city` (e.g. `{"London, England": 400, "New York, NY": 350}`), **When** the system parses the data, **Then** it presents top cities with clean geographic labels and relative distribution bars.

---

### User Story 4 - Dedicated High-Craft Insights Dashboard Page (Priority: P4)

As a user navigating my personal workspace, I want a dedicated, beautifully crafted Page Insights view at `/tenant/[subdomain]/pages/[pageId]/insights`, featuring quick date range selectors, KPI delta scorecards, interactive Recharts visualizations, and clear health status banners, so that I have a fast, enjoyable, and responsive analytical command center.

**Why this priority**: User experience floor. Adheres to *Taste Skill* and *Impeccable* standards—avoiding clunky AI templates in favor of crisp typography, responsive layout, seamless loading skeletons, and fluid micro-interactions.

**Independent Test**: Can be validated by navigating to `/tenant/[subdomain]/pages/[pageId]/insights` in the web application, verifying breadcrumb linkage back to Pages list, asserting that KPI cards, charts (AreaChart, ComposedChart, BarChart), and demographic bars render without hydration errors, and verifying that clicking "Refresh Data" triggers a background refetch with a spinning indicator.

**Acceptance Scenarios**:

1. **Given** an authenticated user on the Pages dashboard, **When** they click "View Insights" on a connected Facebook Page card/row, **Then** they are smoothly navigated to `/tenant/[subdomain]/pages/[pageId]/insights` with Page title and avatar in the header.
2. **Given** the Insights page loading state, **When** data is being fetched, **Then** the page displays structured skeleton cards that match the exact final layout to prevent layout shift (CLS = 0).
3. **Given** an expired or invalid Facebook Page access token, **When** the Insights page loads, **Then** instead of a blank screen or raw error message, it presents an actionable amber banner informing the user that reconnection is required with a direct 1-click reconnect button.
4. **Given** the responsive desktop and mobile viewports, **When** the user resizes or navigates on a mobile device, **Then** charts and metric grids adapt cleanly to stacked layouts without horizontal overflow.

---

### User Story 5 - Daily Metric Snapshots & Background Edge Sync (Priority: P5)

As a platform administrator and user, I want the system's background worker to periodically capture daily metric snapshots in PostgreSQL (`page_insights_daily_snapshots`), so that users retain historical insights beyond Facebook's native rolling retention windows and benefit from instant cached dashboard loads.

**Why this priority**: Long-term data durability and performance optimization. Enables fast dashboard cold starts from database storage while archiving historical performance for future year-over-year reporting.

**Independent Test**: Can be validated by executing the background snapshot sync routine in Cloudflare Worker for an active Page, asserting that a row is upserted into `page_insights_daily_snapshots` under `(user_id, fb_page_id, snapshot_date)`, and confirming that subsequent web dashboard queries read directly from snapshots when Graph API is unreachable or rate-limited.

**Acceptance Scenarios**:

1. **Given** active connected Facebook Pages across workspaces, **When** the background sync cron executes, **Then** it iterates through eligible Pages with active tokens, fetches daily metric totals, and upserts them into `page_insights_daily_snapshots`.
2. **Given** existing snapshot rows for a given day, **When** the sync runs again on the same day, **Then** the upsert updates the record without creating duplicate entries (`ON CONFLICT (user_id, fb_page_id, snapshot_date) DO UPDATE`).
3. **Given** Facebook Graph API rate limit headers or temporary 5xx gateway errors during background sync, **When** the worker encounters errors, **Then** it records the error in logs, skips cleanly without crashing the isolate, and resumes on the next scheduled run.

---

## Technical & Architectural Requirements

### 1. Data Contracts & Contracts Package (`@fbuploadpro/contracts`)
- Define strict Zod schemas for:
  - `PageInsightsOverview`: `fanCount`, `followersCount`, `pageName`, `pageImage`, `cachedAt`.
  - `PageInsightsTimeSeriesPoint`: `date`, `pageFollows`, `dailyFollowsUnique`, `dailyUnfollowsUnique`, `mediaViews`, `videoViews`, `videoCompleteViews30s`, `videoViewTimeMinutes`.
  - `PageInsightsReactions`: `like`, `love`, `wow`, `haha`, `sorry`, `anger`, `total`.
  - `PageInsightsDemographics`: `topCountries: Array<{ code: string, count: number, percentage: number }>`, `topCities: Array<{ name: string, count: number, percentage: number }>`.
  - `PageInsightsResponse`: Envelope containing overview, timeSeries, reactions, demographics, and meta (`dateRange`, `cacheStatus`).

### 2. Database Schema & Migration (`packages/database`)
- Create new migration `0006_page_insights_snapshots.sql`:
  - Table `page_insights_daily_snapshots`:
    - `id`: UUID PRIMARY KEY DEFAULT gen_random_uuid()
    - `user_id`: UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
    - `fb_page_id`: VARCHAR(64) NOT NULL
    - `snapshot_date`: DATE NOT NULL
    - `fan_count`: BIGINT NOT NULL DEFAULT 0
    - `followers_count`: BIGINT NOT NULL DEFAULT 0
    - `daily_follows`: INT NOT NULL DEFAULT 0
    - `daily_unfollows`: INT NOT NULL DEFAULT 0
    - `media_views`: INT NOT NULL DEFAULT 0
    - `video_views`: INT NOT NULL DEFAULT 0
    - `video_complete_views_30s`: INT NOT NULL DEFAULT 0
    - `video_view_time_seconds`: BIGINT NOT NULL DEFAULT 0
    - `reactions_summary`: JSONB NOT NULL DEFAULT '{}'::jsonb
    - `demographics_summary`: JSONB NOT NULL DEFAULT '{}'::jsonb
    - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
    - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT now()
    - UNIQUE constraint: `(user_id, fb_page_id, snapshot_date)`
    - Index on `(user_id, fb_page_id, snapshot_date DESC)`

### 3. Server API Routes (`apps/web`)
- `GET /api/tenant/[subdomain]/pages/[pageId]/insights`:
  - Authenticated via session cookie & subdomain tenant ownership.
  - Query parameters: `range` (`7d` | `14d` | `28d` | `90d`, default `28d`), `refresh` (boolean, optional).
  - Fetches Page record, decrypts `fb_page_access_token` using server-side AES-256-GCM.
  - Queries Facebook Graph API v26.0 endpoints.
  - Returns structured, validated JSON response matching contract schema.

### 4. Edge Worker Background Sync (`apps/worker`)
- Cron trigger running daily / hourly to refresh fan counts and store daily metric snapshots into PostgreSQL via `@fbuploadpro/database/edge`.

### 5. Frontend UI Components (`apps/web`)
- Page route: `src/app/tenant/[subdomain]/pages/[pageId]/insights/page.tsx`
- Components:
  - `InsightsHeader`: Page metadata, back link, date range selector, refresh button.
  - `OverviewKpiCards`: Follower count, Fan count, Total Video Views, Engagement Rate.
  - `GrowthChartCard`: Area chart showing followers vs unfollows.
  - `VideoPerformanceCard`: Composed chart showing 30s completions and total watch time.
  - `ReactionsDistributionCard`: Sentiment breakdown bar chart.
  - `DemographicsCard`: Top countries and cities progress bars.
  - `InsightsEmptyState` & `InsightsErrorState`: Reconnection prompts and error handling.

---

## Edge Cases & Non-Functional Guardrails

1. **Zero Token Leakage**:
   - Access tokens must NEVER be passed to client components or included in JSON API responses.
   - All Graph API calls originate strictly from server route handlers or Cloudflare Worker edge isolates.
2. **Graph API Rate Limiting**:
   - Cache results in memory / database for at least 15 minutes to prevent hitting Graph API call count caps.
   - Respect `X-App-Usage` and `X-Page-Usage` headers returned by Facebook.
3. **Invalid or Revoked Permissions**:
   - If Facebook returns error code 190 (access token expired) or permission errors, map status cleanly to `invalid_token` and present a non-blocking re-authentication CTA.
4. **Timezone Alignment**:
   - Date ranges and daily buckets must be computed in UTC or the Page's configured timezone to prevent off-by-one calendar bucket errors.
5. **Quality Gates**:
   - 100% test pass rate across unit, integration, and security isolation tests.
   - Strict TypeScript compilation with 0 errors.
   - Adherence to Next.js 16 App Router (zero `set-state-in-effect`).
