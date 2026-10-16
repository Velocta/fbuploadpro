# Implementation Tasks: Spec 062 - Two-Step Professional Schedule Timezone Modal

## Task List

- [x] **Task 1: Timezone Registry & Search Utilities (`apps/web/src/lib/timezones.ts`)**
  - [x] Create a comprehensive registry of global timezones grouped by region (Americas, Europe, Asia, Australia/Pacific, Africa, UTC) with city, country, UTC offset, and search keywords.
  - [x] Add unit tests in `apps/web/tests/unit/timezones.test.ts` for filtering, formatting, and offset resolution.

- [x] **Task 2: Build `ScheduleTimezoneModal` Component (`apps/web/src/components/pages/dedicated/schedule-timezone-modal.tsx`)**
  - [x] Implement Step 1: Searchable grouped timezone list, current timezone indicator, and selection state.
  - [x] Implement Step 2: Impact review showing Current vs Proposed timezone, clock-time preservation guarantee, slot count, and queue shift count.
  - [x] Implement smooth step navigation (Continue, Back, Cancel, Confirm) and loading/error states conforming to `@web/lib/theme`.

- [x] **Task 3: Integrate with Posting Times Header (`apps/web/src/components/pages/dedicated/tab-posting-times.tsx`)**
  - [x] Replace raw native `<select>` with a professional unboxed timezone indicator button ("Change Timezone").
  - [x] Connect modal state (`isTimezoneModalOpen`), passing active timezone, slot count, and pending queue count.
  - [x] Wire up timezone update callback and trigger queue refresh.

- [x] **Task 4: Component Tests & Verification**
  - [x] Add component tests in `apps/web/tests/unit/schedule-timezone-modal.test.ts` verifying Step 1 selection, Step 2 impact review, back navigation, and submission.
  - [x] Verify zero SonarQube code smells and full test coverage (>80%).

- [x] **Task 5: Documentation & Knowledge Base Synchronization**
  - [x] Update `docs/foundational-knowledge.md` under Section 26.6 documenting the Two-Step Schedule Timezone Modal.
