# Research: Live Facebook Insights & Client LocalStorage Caching

**Feature**: [spec.md](./spec.md)
**Date**: 2026-10-16

---

## Decision 1: Client-Side Caching Strategy (Browser `localStorage`)

- **Decision**: Store insights responses in browser `localStorage` under keys `insights:${pageId}:${range}` with payload format `{ data: PageInsightsResponse, cachedAt: number, expiresAt: number }`.
- **Rationale**:
  - `localStorage` is synchronous, persistent across page refreshes, tab closures, and navigation between workspace routes.
  - Typical insights payload size is 5–15 KB, negligible against the standard ~5 MB browser origin quota.
  - Expiration check is a trivial comparison: `Date.now() < cached.expiresAt` (where `expiresAt = cachedAt + 15 * 60 * 1000`).
  - Guarantees immediate zero-delay render on refresh or returning to the tab.
- **Alternatives Considered**:
  - `sessionStorage`: Cleared when closing tab or browser session, forcing fresh Graph API calls on every session.
  - `IndexedDB`: Asynchronous and introduces unnecessary async plumbing/boilerplate for simple 10 KB JSON snapshots.
  - In-memory React state: Completely wiped on browser refresh or route transitions.

---

## Decision 2: Upstash Redis Removal for Insights

- **Decision**: Remove Upstash Redis REST calls from `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts` and deprecate `InsightsCache` for insights fetching.
- **Rationale**:
  - The client itself caches the response in `localStorage` for 15 minutes.
  - When the client does request fresh data (after 15 minutes or via Sync button), it explicitly wants live metrics from Facebook Graph API v26.0.
  - Eliminates serverless Redis roundtrips, config dependencies (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`), and potential Redis rate limit / failure modes for insights.
- **Alternatives Considered**:
  - Retaining Redis as a secondary cache: Defeats the user's explicit directive to fetch live data from Facebook and cache in `localStorage`.

---

## Decision 3: Database Snapshots Table Dropping (`page_insights_daily_snapshots`)

- **Decision**: Create forward migration `supabase/migrations/20261021000000_drop_page_insights_daily_snapshots.sql` to drop `page_insights_daily_snapshots`. Remove all DB queries and assemblies from the API route.
- **Rationale**:
  - The user explicitly requested removing snapshots entirely.
  - Removing the table stops unnecessary write amplification, disk storage consumption, and obsolete fallback logic.
  - Simplifies the API route handler into a clean, direct Graph API proxy.
- **Alternatives Considered**:
  - Keeping the table as write-only archive: Unnecessary database bloat since neither the UI nor the worker will consume or populate it.

---

## Decision 4: Cloudflare Worker Insights Sync Removal

- **Decision**: Remove `apps/worker/src/insights-sync.ts`, the cron handler checks in `handleScheduled`, and worker export references.
- **Rationale**:
  - Saves Cloudflare Worker CPU execution time, subrequests, and eliminates risk of worker failures from Facebook Graph API rate-limiting during background sweeps.
  - Keeps the worker focused strictly on its primary mission: publishing dispatch and media downloading.
- **Alternatives Considered**:
  - Retaining the worker sync without saving to DB: Pointless without a storage destination.
