# Tasks: Essential Reusable UI Components

**Feature**: Essential Reusable UI Components  
**Branch**: `feat/reusable-ui-components`  
**Ratified**: 2026-10-08  
**Constitution**: 2.1.0  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create UI component directory structure and setup base export scaffolding

- [X] T001 Create directory structure for reusable UI components at `apps/web/src/components/ui/` and test directory at `apps/web/tests/components/`
- [X] T002 [P] Create base root barrel file exporting UI component declarations at `apps/web/src/components/ui/index.ts`

---

## Phase 2: Foundational (Design Token & Accessibility Harness)

**Purpose**: Validate theme token bindings and setup base component testing configuration

**⚠️ CRITICAL**: Must complete before component implementations begin

- [X] T003 Verify CSS custom properties and theme tokens in `apps/web/src/app/globals.css` and `apps/web/src/lib/theme.ts` for dual-theme color mapping and focus halo styles
- [X] T004 [P] Configure Vitest DOM testing environment and setup helpers in `apps/web/tests/components/setup.ts`

**Checkpoint**: Foundation ready - component implementations can begin

---

## Phase 3: User Story 1 - Essential Form & Action Controls (Priority: P1) 🎯 MVP

**Goal**: Implement accessible, high-craft form inputs and action buttons adhering to WCAG AAA contrast and Binance theme tokens.

**Independent Test**: Render each control in `apps/web/tests/components/`, simulate user input, toggle, focus, disabled, and loading states.

### Tests for User Story 1

- [X] T005 [P] [US1] Unit and accessibility tests for Button variants, loading state, and contrast in `apps/web/tests/components/button.test.tsx`
- [X] T006 [P] [US1] Unit and accessibility tests for Input, Textarea, and password visibility toggle in `apps/web/tests/components/input.test.tsx`
- [X] T007 [P] [US1] Unit and keyboard navigation tests for Checkbox, Switch, and Select in `apps/web/tests/components/form-controls.test.tsx`

### Implementation for User Story 1

- [X] T008 [P] [US1] Implement `Button` component with variants (`primary`, `secondary`, `ghost`, `danger`, `link`), sizes (`sm`, `md`, `lg`), loading spinner, and icon slots in `apps/web/src/components/ui/button.tsx`
- [X] T009 [P] [US1] Implement `Input` component with label, error text, helper text, leading/trailing icons, and password toggle in `apps/web/src/components/ui/input.tsx`
- [X] T010 [P] [US1] Implement `Textarea` component with auto-expand, character count, label, and error display in `apps/web/src/components/ui/textarea.tsx`
- [X] T011 [P] [US1] Implement rectilinear 4px `Checkbox` and accessible `Switch` toggle components in `apps/web/src/components/ui/checkbox.tsx` and `apps/web/src/components/ui/switch.tsx`
- [X] T012 [P] [US1] Implement `Select` dropdown component with custom chevron and accessible keyboard selection in `apps/web/src/components/ui/select.tsx`

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Structural Containers & Modal Dialogs (Priority: P1)

**Goal**: Deliver 1px hairline bordered card containers and focus-trapped modal dialog overlays.

**Independent Test**: Render cards with modular slots and open modal dialogs verifying backdrop blur, focus trapping, and Escape-key closing.

### Tests for User Story 2

- [X] T013 [P] [US2] Unit tests for Card modular subcomponents in `apps/web/tests/components/card.test.tsx`
- [X] T014 [P] [US2] Unit and focus-trap accessibility tests for Dialog modal in `apps/web/tests/components/dialog.test.tsx`

### Implementation for User Story 2

- [X] T015 [P] [US2] Implement `Card` container and modular subcomponents (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) with 1px hairline borders in `apps/web/src/components/ui/card.tsx`
- [X] T016 [US2] Implement accessible `Dialog` modal component with backdrop overlay, focus trap, Escape key handling, and body scroll locking in `apps/web/src/components/ui/dialog.tsx`

**Checkpoint**: User Stories 1 and 2 are fully functional and integrated.

---

## Phase 5: User Story 3 - Navigation & Tabular Data Presentation (Priority: P2)

**Goal**: Deliver WAI-ARIA compliant tabbed section switching and dense data tables with sub-pixel hairlines.

**Independent Test**: Navigate tabs with arrow keys and inspect table row rendering and monospace tabular figures.

### Tests for User Story 3

- [X] T017 [P] [US3] Unit and keyboard navigation tests for Tabs in `apps/web/tests/components/tabs.test.tsx`
- [X] T018 [P] [US3] Unit tests for Table modular subcomponents in `apps/web/tests/components/table.test.tsx`

### Implementation for User Story 3

- [X] T019 [P] [US3] Implement `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` components with active Peru indicator and arrow navigation in `apps/web/src/components/ui/tabs.tsx`
- [X] T020 [P] [US3] Implement `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, and `TableCell` with 1px hairline dividers and `tabular-nums` in `apps/web/src/components/ui/table.tsx`

**Checkpoint**: User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 - Status Signals, Feedback & Loading States (Priority: P2)

**Goal**: Deliver strict unboxed 6px luminous status dots, rectilinear tags, zero-CLS skeleton shimmers, callout alerts, and tooltips.

**Independent Test**: Verify status dots across all four states, render skeleton placeholders, and display alerts and tooltips.

### Tests for User Story 4

- [X] T021 [P] [US4] Unit tests for StatusDot unboxed rendering and Tag variants in `apps/web/tests/components/status-dot.test.tsx`
- [X] T022 [P] [US4] Unit tests for Skeleton shimmer, Alert callout, and Tooltip in `apps/web/tests/components/feedback.test.tsx`

### Implementation for User Story 4

- [X] T023 [P] [US4] Implement `StatusDot` (strictly unboxed 6px luminous dot with micro-halo per `STATUS_SIGNALS`) and rectilinear 4px `Tag` in `apps/web/src/components/ui/status-dot.tsx` and `apps/web/src/components/ui/tag.tsx`
- [X] T024 [P] [US4] Implement `Skeleton` placeholder component with shimmer animation in `apps/web/src/components/ui/skeleton.tsx`
- [X] T025 [P] [US4] Implement `Alert` callout banner component for info, success, warning, and error severities in `apps/web/src/components/ui/alert.tsx`
- [X] T026 [P] [US4] Implement lightweight floating `Tooltip` component with hover/focus trigger in `apps/web/src/components/ui/tooltip.tsx`

**Checkpoint**: All component primitives are functional and exported from `apps/web/src/components/ui/index.ts`.

---

## Phase 7: User Story 5 - Showroom Showcase & Interactive Verification (Priority: P3)

**Goal**: Build isolated interactive testbenches in `apps/showroom` on port 3001 with Dark/Light theme switching and state testing.

**Independent Test**: Launch showroom app and verify all components across all states and viewports.

- [X] T027 [P] [US5] Build interactive form controls showcase harness in `apps/showroom/src/app/components/form-controls-showcase.tsx`
- [X] T028 [P] [US5] Build surfaces, dialogs, and navigation showcase harness in `apps/showroom/src/app/components/surfaces-showcase.tsx`
- [X] T029 [P] [US5] Build feedback, status signals, and loading states showcase harness in `apps/showroom/src/app/components/feedback-showcase.tsx`
- [X] T030 [US5] Integrate component suite showcase dashboard and theme switcher in `apps/showroom/src/app/page.tsx`

---

## Phase 8: Polish & Cross-Cutting Quality Gates

**Purpose**: Validate monorepo builds, typecheck, linting, and accessibility compliance.

- [X] T031 [Polish] Verify complete barrel export integrity in `apps/web/src/components/ui/index.ts`
- [X] T032 [Polish] Run full monorepo quality gate check: `pnpm turbo run build lint typecheck test` and verify 0 errors
- [X] T033 [Polish] Update project documentation in `docs/foundational-knowledge.md` to reflect the completed UI primitives component suite

---

## Dependencies & Execution Order

### Phase Dependencies
1. **Setup (Phase 1)**: No dependencies.
2. **Foundational (Phase 2)**: Depends on Setup. Blocks user stories.
3. **User Stories (Phases 3–7)**: Depend on Foundational.
   - User Story 1 (P1): Forms & Actions (MVP).
   - User Story 2 (P1): Surfaces & Dialogs.
   - User Story 3 (P2): Navigation & Tabulation.
   - User Story 4 (P2): Status Signals & Feedback.
   - User Story 5 (P3): Showroom Harnesses.
4. **Polish (Phase 8)**: Depends on all user stories completing.

### Parallel Opportunities
- In Phase 3: `T008`, `T009`, `T010`, `T011`, `T012` can be implemented in parallel.
- In Phase 4: `T015` and `T016` can be implemented in parallel.
- In Phase 5: `T019` and `T020` can be implemented in parallel.
- In Phase 6: `T023`, `T024`, `T025`, `T026` can be implemented in parallel.
- In Phase 7: `T027`, `T028`, `T029` can be implemented in parallel.
