# Implementation Tasks: Spec 058 Facebook Page Posting Times Redesign

**Branch**: `feat/058-posting-times-redesign` | **Spec**: [spec.md](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/pull_latest_main/specs/058-posting-times-redesign/spec.md) | **Plan**: [plan.md](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/pull_latest_main/specs/058-posting-times-redesign/plan.md)

---

## Tasks

### Phase 1: Core Component Implementation (P1 & P3 User Stories)
- [x] **T001**: Implement `apps/web/src/components/pages/dedicated/tab-posting-times.tsx` following Minimalist Editorial Ledger:
  - Header with title "Posting Times", human subtitle, and timezone indicator.
  - Times ledger with unboxed 6px luminous status dot, tabular time typography, AM/PM label, 24h tag, tactile active/pause switch, and quiet hover remove action.
  - Full Permitted Content Format Selection (`allowedFormats`: Reels, Photos, Videos, Stories, Text Updates) per row with dedicated "Edit Formats" button.
  - Add/Edit Posting Time modal with clean 24h time input, timezone selection, interactive multi-select format buttons with "Select All" shortcut.
  - Serene empty state with 1-click initial time setup.
  - Modular helper functions ensuring function cognitive complexity $\le 15$.
  - Strictly zero bullet point dots (`•`) and zero capsule pill badges.

### Phase 2: Integration & Aliasing (P2 User Story)
- [x] **T002**: Refactor `apps/web/src/components/pages/dedicated/tab-calendar.tsx` to wrap/re-export `PageTabPostingTimes` as `PageTabCalendar` with identical props interface for backwards compatibility.
- [x] **T003**: Update `apps/web/src/components/pages/dedicated/index.ts` to export `PageTabPostingTimes` and `PageTabCalendar`.
- [x] **T004**: Update tab label in `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx` from `'Calendar & Slots'` to `'Posting Times'`.
- [x] **T005**: Update `apps/web/src/components/pages/dedicated/tab-dashboard.tsx` "Recurring Schedule" section copy to reference "Posting Times".

### Phase 3: Testing & Verification (P3 User Story)
- [x] **T006**: Update `apps/web/tests/ui/dedicated-page.test.tsx` to test `PageTabPostingTimes` and backwards-compatible `PageTabCalendar`, verifying all testids, format tags, edit format buttons, toggle interactions, delete flow, and strict absence of bullet dots (`•`).
- [x] **T007**: Verification ready for CI/CD quality gate inspection.

### Phase 4: Documentation Synchronization
- [x] **T008**: Update `docs/foundational-knowledge.md` to document Spec 058 Facebook Page Posting Times Redesign in the roadmap and Section 24.
