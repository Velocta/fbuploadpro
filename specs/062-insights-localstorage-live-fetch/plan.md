# Implementation Plan: Live Facebook Insights with 15-Minute LocalStorage Caching

**Branch**: `feat/062-insights-localstorage-live-fetch` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/062-insights-localstorage-live-fetch/spec.md`

## Summary

This feature transitions the Facebook Page Insights architecture from a server-side Upstash Redis / database snapshot hybrid to a client-driven live fetch model backed by browser `localStorage`.
- **Client**: `PageTabInsights` (`tab-insights.tsx`) inspects `localStorage` for `insights:${pageId}:${range}`. If an unexpired entry (< 15 minutes) exists and manual sync is not clicked, the UI renders immediately from `localStorage` without skeleton loaders or network calls. Clicking "Sync" or expiration (> 15 min) triggers a fresh network call and resets the 15-minute expiration window.
- **Server**: `/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts` is streamlined into a direct, secure Facebook Graph API v26.0 proxy (decrypting the page access token server-side with zero token leakage). All Upstash Redis and snapshot query logic is removed.
- **Database**: Forward migration drops `public.page_insights_daily_snapshots`.
- **Worker**: `apps/worker` excises `insights-sync.ts` and insights-related cron scheduling.

---

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16 App Router  
**Primary Dependencies**: `@fbuploadpro/contracts` (Zod), `recharts`, `lucide-react`, `@supabase/supabase-js`  
**Storage**: Browser `window.localStorage` (15-min TTL client-side cache); Supabase PostgreSQL (dropping `page_insights_daily_snapshots`)  
**Testing**: Vitest (`apps/web/tests/`, `apps/worker/tests/`)  
**Target Platform**: Vercel (Next.js 16 Webapp), Cloudflare Workers (Edge publishing/downloader runtime)  
**Project Type**: Monorepo Web Application & Edge Services  
**Performance Goals**: `< 50ms` instant client-side cache render; fresh live Graph API fetch `< 1.5s`; zero token leakage  
**Constraints**: Zero client token exposure; private browsing localStorage fallback resilience; no local build/lint execution prior to PR creation  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (SDD & TDD)**: Fully specified in `spec.md`, planned in `plan.md`, testable via automated unit tests.
- [x] **Principle II (Service Isolation)**: Next.js web application and Cloudflare Worker boundaries maintained.
- [x] **Principle III (Tenant Isolation)**: API route verifies tenant ownership via session cookie and workspace ID.
- [x] **Principle IV (Zero Token Leakage)**: Access tokens decrypted exclusively on server; never sent to browser or stored in `localStorage`.
- [x] **Principle 30 (Spec 062 Live Insights & 15-Min LocalStorage Caching)**: Complies with newly codified governance removing Redis insights caching and DB snapshots in favor of live fetches and 15-minute client caching.
- [x] **Elimination of Local Builds**: All builds offloaded to remote GitHub Actions CI.

---

## Project Structure

### Documentation (this feature)

```text
specs/062-insights-localstorage-live-fetch/
├── plan.md              # This file
├── research.md          # Research decisions
├── data-model.md        # Data models & schemas
├── quickstart.md        # Validation scenarios
├── contracts/           # Client & API contracts
└── tasks.md             # Implementation tasks
```

### Source Code Impact

```text
apps/web/
├── src/
│   ├── app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts  # Direct live Graph API proxy (no Redis, no snapshots)
│   ├── components/pages/dedicated/tab-insights.tsx                 # 15-minute localStorage caching & instant render
│   └── lib/insights/insights-cache.ts                              # Deprecate / cleanup insights cache
└── tests/
    ├── api/page-insights-overview.test.ts                          # Updated without DB snapshots / Redis
    ├── api/page-insights-timeseries.test.ts                        # Updated for direct Graph API proxy
    ├── security/insights-token-leakage.test.ts                     # Verify zero token leakage
    └── ui/tab-insights.test.tsx                                    # Test localStorage 15-min cache & sync button

apps/worker/
├── src/
│   ├── index.ts                                                   # Remove insights-sync exports & scheduled cron
│   └── insights-sync.ts                                           # DELETED
└── tests/
    └── insights-sync.test.ts                                      # DELETED / Cleaned up

packages/contracts/
├── src/domain/
│   ├── database.ts                                                # Remove page_insights_daily_snapshots
│   └── insights.ts                                                # Clean up snapshot interfaces
└── tests/
    └── insights-contracts.test.ts                                 # Contract schema validation

supabase/migrations/
└── 20261021000000_drop_page_insights_daily_snapshots.sql         # Forward migration dropping snapshot table
```

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| None | N/A | N/A |
