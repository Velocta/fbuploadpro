# Implementation Plan: Spec 058 Facebook Page Posting Times Redesign

**Branch**: `feat/058-posting-times-redesign` | **Date**: 2026-10-16 | **Spec**: [spec.md](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/pull_latest_main/specs/058-posting-times-redesign/spec.md)

---

## 1. Summary
Refactor and redesign the publishing schedule view in the dedicated Facebook Page view (`/tenant/[subdomain]/pages/[pageId]`). Replace the legacy "Calendar & Slots" view with a serene, typography-forward **Posting Times** section adhering to Option A: Minimalist Editorial Ledger. Maintain full backwards compatibility with existing API endpoints (`/api/tenant/[subdomain]/pages/[pageId]/slots`), types, and test assertions while eliminating visual clutter, box-in-a-box frames, redundant "None" labels, and bullet dots (`•`).

---

## 2. Technical Context
- **Target Platform**: Next.js 16 (App Router), React 19 (`apps/web`).
- **Styling Authority**: Strict adherence to `@/lib/theme` design tokens and `DESIGN.md` (no hex invention, no ad-hoc classes, zero pill badges, immutable `DESIGN.md`).
- **State & Data**:
  - `PageSlotSummary` from `@/components/pages/dedicated`: `id`, `slotTime`, `timezone`, `isActive`, `allowedFormats`.
  - API Routes: `GET/POST /api/tenant/[subdomain]/pages/[pageId]/slots`, `PATCH/DELETE /api/tenant/[subdomain]/pages/[pageId]/slots/[slotId]`.
  - Scheduling engine: `apps/web/src/lib/slot-scheduler.ts` (unchanged backend logic).
- **Test Suite**: `apps/web/tests/ui/dedicated-page.test.tsx` verifying accessibility, interactions, rendering, and zero bullet dots.

---

## 3. Architecture & File Structure

```text
apps/web/src/
├── app/tenant/[subdomain]/pages/[pageId]/
│   └── page.tsx                         # Update tab label from 'Calendar & Slots' to 'Posting Times'
├── components/pages/dedicated/
│   ├── tab-posting-times.tsx             # NEW: Pure Minimalist Editorial Ledger implementation
│   ├── tab-calendar.tsx                 # Re-exports / backwards-compatibility wrapper for legacy imports
│   ├── tab-dashboard.tsx                # Update "Manage slots →" link copy to "Manage posting times →"
│   └── index.ts                         # Export PageTabPostingTimes & PageTabCalendar
└── tests/ui/
    └── dedicated-page.test.tsx          # Updated unit & UI integration test suite
```

---

## 4. Component Architecture: `PageTabPostingTimes`
1. **Header Zone**:
   - Title: `Posting Times` (`data-testid="posting-times-header"`).
   - Subtitle: `Queued posts are automatically published into your recurring daily schedule.`
   - Timezone Indicator: Clean whisper badge showing active timezone (e.g. `Timezone: America/New_York (EST)`).
2. **Cadence Summary Strip**:
   - Subtle hairline or quiet card displaying active daily windows count and estimated weekly post capacity.
   - Live operational status indicator (`Operational` with luminous dot).
3. **Daily Times Ledger**:
   - Tabular time display (`09:00` with `AM` / `PM` label).
   - Contextual subtitle (`Morning window · Every day`).
   - Tactile switch component to pause / resume (`data-testid="toggle-slot-btn-{id}"`).
   - Quiet hover affordance to remove (`data-testid="delete-slot-btn-{id}"`).
4. **Quick Presets & Add Affordance**:
   - `+ Add Posting Time` trigger (`data-testid="add-slot-button"`).
   - 1-click popular presets: `+ 11:30 AM (Noon)`, `+ 05:00 PM (Commute)` (`data-testid="preset-add-btn-{time}"`).
5. **Clean Add Modal**:
   - Focused, uncluttered time selection without dense configuration checkboxes.

---

## 5. Verification Plan
1. Local contracts build: `pnpm --filter @fbuploadpro/contracts build`.
2. UI tests execution: `pnpm --filter web test apps/web/tests/ui/dedicated-page.test.tsx`.
3. Typecheck verification: `pnpm --filter web typecheck`.
4. Quality gate: Zero bullet dots (`•`), zero capsule badges, 100% theme token compliance.
