# Implementation Tasks: Spec 061 - Queued Items Timezone Realignment

## Task List

- [x] **Task 1: Timezone Realignment Core Helper (`apps/web/src/lib/slot-scheduler.ts`)**
  - [x] Implement `recomputeSlotScheduledTime` supporting timezone offset translation, slot time formatting, and past-time protection (`> now()`).
  - [x] Add unit tests in `apps/web/tests/lib/slot-scheduler.test.ts` (or equivalent) for timezone translation.

- [x] **Task 2: API Route Realignment Integration (`apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/slots/route.ts`)**
  - [x] Update `updateScheduleTimezonePostgres` to fetch pending recurring queue items and update `queue_items.scheduled_time`.
  - [x] Update `updateScheduleTimezoneSupabase` to perform equivalent realignment using Supabase client.
  - [x] Return `realignedQueueCount` in the `PATCH` response payload.

- [x] **Task 3: Page Container UI Synchronization (`apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx`)**
  - [x] Update `handleUpdateTimezone` to call `fetchQueue()` alongside `fetchSlots()`.
  - [x] Update toast notification to report realigned queued posts count.

- [x] **Task 4: Test Suite & Multi-Tenant Verification**
  - [x] Update `apps/web/tests/api/queue-slots.test.ts` to test queue item realignment on schedule timezone update.
  - [x] Verify `realignedQueueCount` and past-time protection.
  - [x] Verify security isolation in `apps/web/tests/security/publishing-isolation.test.ts`.

- [x] **Task 5: Documentation & Knowledge Base Synchronization**
  - [x] Update `docs/foundational-knowledge.md` to document queue timezone realignment logic under Section 26.5.
