# Implementation Tasks: Spec 060 - Page Schedule Timezone & Posting Times Cleanup

## Task List

- [x] **Task 1: Contracts & API Route Implementation**
  - [x] Add `UpdateQueueScheduleTimezoneRequestSchema` and `UpdateQueueScheduleTimezoneRequest` in `packages/contracts/src/domain/queue.ts`.
  - [x] Re-export if needed and update contract tests in `packages/contracts/tests/publishing-contracts.test.ts`.
  - [x] Implement `handleUpdateQueueScheduleTimezone` and `PATCH` in `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/slots/route.ts`.

- [x] **Task 2: Posting Times Component Refactor**
  - [x] Expand `COMMON_TIMEZONES` in `apps/web/src/components/pages/dedicated/tab-posting-times.tsx` with `Asia/Karachi`, `Asia/Dubai`, etc.
  - [x] Upgrade `PostingTimesHeader` with interactive schedule timezone selector with testid `schedule-timezone-select`.
  - [x] Remove timezone `<select>` input from `AddEditPostingTimeModal`.
  - [x] Add active timezone subtitle note in `AddEditPostingTimeModal`.
  - [x] Remove redundant bottom `+ Add another posting time` button from `PageTabPostingTimes`.
  - [x] Wire `onUpdateTimezone` callback in `PageTabPostingTimesProps`.

- [x] **Task 3: Page Container Integration**
  - [x] Implement `handleUpdateTimezone` in `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx`.
  - [x] Pass `onUpdateTimezone={handleUpdateTimezone}` to `PageTabCalendar` / `PageTabPostingTimes`.

- [x] **Task 4: Interactive HTML Preview Artifact Update**
  - [x] Update `posting_times_preview.html` to remove bottom button.
  - [x] Wire interactive schedule timezone dropdown in header with `Asia/Karachi`, `America/New_York`, etc.
  - [x] Simplify preview modal to only ask for Time of Day and Permitted Content Formats.

- [x] **Task 5: Test Suite Verification & Quality Gates**
  - [x] Update `apps/web/tests/ui/dedicated-page.test.tsx` to test schedule timezone selection, bottom button removal, and modal simplification.
  - [x] Update `packages/contracts/tests/publishing-contracts.test.ts`.
  - [x] Verify zero bullet point dots (`•`) and zero capsule pill badges.

- [x] **Task 6: Documentation & Synchronization**
  - [x] Update `docs/foundational-knowledge.md` Section 26 to document Spec 060.
