# Architecture & Technical Plan: Spec 060 - Page Schedule Timezone & Posting Times Cleanup

## 1. Overview & Architecture Strategy
This plan details the technical decoupling of timezone selection from individual posting slots to a unified page-level schedule setting, the removal of the redundant bottom add button, and the simplification of the posting time modal.

---

## 2. Component & API Architecture

```mermaid
flowchart TD
    subgraph UI ["Frontend (apps/web)"]
        H["PostingTimesHeader\n(Interactive Schedule Timezone Selector)"]
        Grid["Daily Posting Times Ledger\n(Cleaned - No Bottom Add Button)"]
        M["AddEditPostingTimeModal\n(Time of Day + Formats Only - No Timezone Dropdown)"]
        Page["TenantDedicatedPageView\n(/tenant/[subdomain]/pages/[pageId])"]
    end

    subgraph API ["Backend API (apps/web)"]
        SlotsRoute["PATCH /api/tenant/[subdomain]/pages/[pageId]/slots\n(Bulk Update Page Schedule Timezone)"]
        SlotIdRoute["PATCH /api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]\n(Slot Time & Formats Update)"]
    end

    subgraph DB ["PostgreSQL / Supabase"]
        SlotsTable["page_queue_slots\n(slot_time preserved, timezone updated)"]
    end

    H -->|"1. User changes timezone (e.g. Asia/Karachi)"| Page
    Page -->|"2. PATCH { timezone: 'Asia/Karachi' }"| SlotsRoute
    SlotsRoute -->|"3. UPDATE page_queue_slots SET timezone = $1"| SlotsTable
    M -->|"4. Saves slot using page active timezone"| Page
    Page -->|"5. Reloads or updates local slot state"| Grid
```

---

## 3. Detailed Changes by Package

### 3.1 `@fbuploadpro/contracts`
- **File**: `packages/contracts/src/domain/queue.ts`
- **Schema**: Add `UpdateQueueScheduleTimezoneRequestSchema = z.object({ timezone: TimezoneSchema })`.
- Export `UpdateQueueScheduleTimezoneRequest`.

### 3.2 Backend Route (`apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/slots/route.ts`)
- Add `handleUpdateQueueScheduleTimezone` function:
  - Validates session and checks tenant permission (`canAccessTenant`).
  - Validates `{ timezone }` against `UpdateQueueScheduleTimezoneRequestSchema`.
  - Resolves workspace and validates page ownership.
  - Executes atomic update across all slots for the page and user:
    - Postgres: `UPDATE page_queue_slots SET timezone = $1, updated_at = now() WHERE fb_page_id = $2 AND user_id = $3 RETURNING ...`
    - Supabase: `.from('page_queue_slots').update({ timezone, updated_at }).eq('fb_page_id', pageId).eq('user_id', session.userId)`.
  - Returns `NextResponse.json({ success: true, timezone, updatedCount })`.
- Export `PATCH` route handler calling `handleUpdateQueueScheduleTimezone`.

### 3.3 UI Component (`apps/web/src/components/pages/dedicated/tab-posting-times.tsx`)
- Update `PageTabPostingTimesProps`:
  - Add `onUpdateTimezone?: (newTimezone: string) => Promise<void>`.
- Expand `COMMON_TIMEZONES`:
  - Include `Asia/Karachi`, `Asia/Dubai`, `Asia/Kolkata` along with existing UTC, US, and European timezones.
- Update `PostingTimesHeader`:
  - Add `onUpdateTimezone?: (newTimezone: string) => Promise<void>` prop.
  - Replace static timezone badge with an interactive schedule timezone selector containing a styled `<select>` element.
  - When user selects a new timezone, call `onUpdateTimezone(selectedTimezone)`.
- Update `AddEditPostingTimeModal`:
  - Remove `Timezone` label and `<select>` dropdown.
  - Display informative context: "Active schedule timezone: {activeTimezone}".
  - Retain `Time of Day (24-Hour)` input and `Permitted Content Formats` multi-select chips.
  - On submit, automatically package `timezone: activeTimezone`.
- Remove redundant bottom button:
  - Remove lines 1122-1164 (`+ Add another posting time` button block) from `PageTabPostingTimes`.

### 3.4 Page Container (`apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx`)
- Add `handleUpdateTimezone(newTimezone: string)`:
  - Calls `PATCH /api/tenant/${subdomain}/pages/${pageId}/slots` with `{ timezone: newTimezone }`.
  - Optimistically updates all items in `slots` state with the new timezone.
  - Triggers a non-blocking `fetchSlots()` refresh.
  - Displays a toast notification: `Schedule timezone updated to ${newTimezone}.`
- Pass `onUpdateTimezone={handleUpdateTimezone}` to `PageTabCalendar` / `PageTabPostingTimes`.

### 3.5 Artifact & Documentation
- Update `posting_times_preview.html`:
  - Reflect removal of bottom button.
  - Include interactive schedule timezone selector in header.
  - Update modal to show only Time and Formats.
- Update `docs/foundational-knowledge.md`:
  - Document Spec 060 architectural decisions under Section 26.
