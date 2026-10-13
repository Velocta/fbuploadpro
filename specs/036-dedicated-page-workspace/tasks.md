# Tasks: Spec 036 — Dedicated Facebook Page Workspace

**Specification**: [`specs/036-dedicated-page-workspace/spec.md`](./spec.md)  
**Plan**: [`specs/036-dedicated-page-workspace/plan.md`](./plan.md)  
**Status**: Implementation Complete  

---

## Task List

### Phase 1: API Route Enhancement
- [x] **T001**: Implement `GET` and `PATCH` methods on `/api/tenant/[subdomain]/pages/[pageId]/route.ts` to support single-page details and automation state updates (`apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/route.ts`)

### Phase 2: Page Header & Core Actions
- [x] **T002**: Build `DedicatedPageHeader` component with avatar, name, account, unboxed status dot, live link, Pause/Resume toggle, and Add to Queue button (`apps/web/src/components/pages/dedicated/page-header.tsx`)

### Phase 3: Dashboard & Queue Tabs
- [x] **T003**: Build `PageTabDashboard` component with overview metrics, next post countdown, upcoming queue snapshot, and active slots (`apps/web/src/components/pages/dedicated/tab-dashboard.tsx`)
- [x] **T004**: Build `PageTabQueue` component with queue list, media thumbnail, caption/first-comment preview, immediate "Publish Now" trigger, inline edit modal, and delete action (`apps/web/src/components/pages/dedicated/tab-queue.tsx`)

### Phase 4: Calendar, Insights & Settings Tabs
- [x] **T005**: Build `PageTabCalendar` component with recurring slot list, active toggles, and Add/Delete slot modal (`apps/web/src/components/pages/dedicated/tab-calendar.tsx`)
- [x] **T006**: Build `PageTabInsights` component with follower growth chart (Recharts), video metrics, reaction breakdowns, and range switcher (`apps/web/src/components/pages/dedicated/tab-insights.tsx`)
- [x] **T007**: Build `PageTabSettings` component with automation master switch, token health, and safe disconnect dialog (`apps/web/src/components/pages/dedicated/tab-settings.tsx`)

### Phase 5: Assembly, Page Integration & Testing
- [x] **T008**: Assemble all tabs into `TenantDedicatedPageView` at `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx`
- [x] **T009**: Author comprehensive unit and integration tests in `apps/web/tests/ui/dedicated-page.test.tsx`
- [x] **T010**: Synchronize `docs/foundational-knowledge.md` with Spec 036 implementation details
