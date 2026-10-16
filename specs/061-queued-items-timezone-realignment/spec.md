# Feature Specification: Spec 061 - Queued Items Timezone Realignment

**Feature Branch**: `feat/061-queued-items-timezone-realignment`  
**Created**: 2026-10-16  
**Status**: Specified  
**Input**: User description: "If you have posts already waiting in the queue, would you like the system to also automatically shift all existing pending queue items to 10:00 AM in the new American timezone whenever you change the page timezone? yes implement it using SDD"

---

## 1. Executive Summary
In FBUploadPro, recurring publishing slots (e.g., `10:00 AM`, `12:00 PM`) are normalized at the page level. When an operator updates a page's schedule timezone (e.g., switching from `Asia/Karachi` to `America/New_York`), future posts queued thereafter are scheduled in the new timezone. However, posts that were already queued *prior* to the timezone change retained their previously calculated absolute UTC timestamp (e.g., `10:00 AM PKT = 05:00 UTC`), causing a discrepancy where existing queued posts would publish at 10:00 AM in the old timezone rather than 10:00 AM in the newly selected timezone.

This specification introduces automatic, atomic **Queue Timezone Realignment**: whenever a page's schedule timezone is updated, all pending queued items (`status = 'queued'`) tied to recurring slots (`slot_id IS NOT NULL`) for that page are recalculated and shifted to the corresponding clock time in the new timezone, with past-time protection ensuring no item is shifted into the past.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1 (P1): Automatic Queue Realignment on Schedule Timezone Change
**As a** social media manager managing page publishing schedules,  
**I want** all existing pending posts in my queue to automatically shift to their slot times in the new timezone when I change the page schedule timezone,  
**So that** my queued content dispatches at the exact intended local wall-clock hours in the new region without manual post-by-post rescheduling.

- **Acceptance Criteria 1.1**: When `PATCH /api/tenant/[subdomain]/pages/[pageId]/slots` is called with `{ timezone: newTimezone }`, all pending items in `public.queue_items` with `status = 'queued'` and `slot_id IS NOT NULL` belonging to the page and user are selected for realignment.
- **Acceptance Criteria 1.2**: For each candidate queued item, its target calendar date and time are evaluated against the associated `slot_time` in the `newTimezone`.
- **Acceptance Criteria 1.3**: The item's `scheduled_time` is updated to the new UTC timestamp corresponding to that slot time in `newTimezone`.
- **Acceptance Criteria 1.4**: One-off custom posts scheduled without a recurring slot (`slot_id IS NULL`) retain their explicit scheduled time and are not mutated.

---

### User Story 2 (P1): Past-Time Protection & Chronological Preservation
**As an** automated publishing engine,  
**I want** realigned queue items to never be shifted into the past relative to the current moment,  
**So that** posts are not immediately triggered unexpectedly or marked as stale when a timezone shift crosses the current hour.

- **Acceptance Criteria 2.1**: If shifting a queued item to today's slot time in the new timezone produces a timestamp `<= now()`, the scheduler advances that item to the next vacant recurring slot date strictly in the future (`> now()`).
- **Acceptance Criteria 2.2**: The relative chronological order of queued posts is preserved.
- **Acceptance Criteria 2.3**: Uniqueness is preserved such that two realigned posts do not occupy the exact same slot timestamp.

---

### User Story 3 (P2): Realignment Observability & UI Synchronization
**As an** operator,  
**I want** immediate feedback showing how many pending posts were realigned when I update the timezone,  
**So that** I have full transparency into the schedule changes.

- **Acceptance Criteria 3.1**: The API response from `PATCH /api/tenant/[subdomain]/pages/[pageId]/slots` includes `{ success: true, timezone, updatedCount, realignedQueueCount }`.
- **Acceptance Criteria 3.2**: The dedicated page view refreshes both the slots and the publishing queue state upon timezone update.
- **Acceptance Criteria 3.3**: The success notification informs the user of the new timezone and the number of realigned queue items (e.g., `Schedule timezone updated to America/New_York (3 queued posts realigned).`).

---

## 3. Strict Domain & Quality Constraints
- **Multi-Tenant Compound Isolation**: Every query and mutation on `facebook_pages` and `queue_items` MUST filter on `user_id = session.userId` and `fb_page_id = pageId`.
- **Zero Local Checks**: Local quality checks are offloaded to remote CI.
- **Anti-Slop Design Tokens**: Strict enforcement of `@/lib/theme`, zero capsule pill badges, zero bullet point dots (`•`).
- **Zero Nested Ternaries & Strict SonarQube Compliance**: Cyclomatic and cognitive complexity kept strictly below threshold.

---

## 4. Edge Cases
- **Page Has Zero Slots**: Timezone updates successfully on `facebook_pages`, `realignedQueueCount` is 0.
- **Page Has Zero Pending Queued Posts**: Timezone updates successfully on `facebook_pages`, `realignedQueueCount` is 0.
- **Timezone Shift Moves Today's Slot Into the Past**: If it's currently 2:00 PM in New York, and an item was at 10:00 AM PKT today, shifting to 10:00 AM NY today would be in the past; it must advance to tomorrow 10:00 AM NY.
- **Database Client Dual Support**: Implementation must support both direct PostgreSQL `DatabaseClient` (pg) and Supabase client (`SupabaseClient`).
