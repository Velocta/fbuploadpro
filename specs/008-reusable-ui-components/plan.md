# Implementation Plan: Essential Reusable UI Components

**Branch**: `feat/reusable-ui-components` | **Date**: 2026-10-08 | **Spec**: [specs/008-reusable-ui-components/spec.md](spec.md)

**Input**: Feature specification from `/specs/008-reusable-ui-components/spec.md`

---

## Summary

Deliver a comprehensive suite of accessible, high-craft, lightweight React 19 UI component primitives for the web application (`apps/web/src/components/ui/`), styled strictly with the **Binance Precision Dual-Theme** (`apps/web/src/lib/theme.ts` and `apps/web/src/app/globals.css`). The components cover all universal web app interactions (Buttons, Inputs, Textareas, Checkboxes, Switches, Selects, Cards, Dialogs/Modals, Tabs, Tables, StatusDots, Tags, Skeletons, Alerts, Tooltips) and are tested with thorough unit and accessibility test suites.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode, zero unchecked `any`)  
**Primary Dependencies**: Next.js 16 (App Router), React 19, React-DOM 19  
**Storage**: N/A (Client UI component layer)  
**Testing**: Vitest (`apps/web/tests/components/`)  
**Target Platform**: Evergreen Web Browsers (Chromium, Firefox, Safari)  
**Project Type**: Reusable UI component library (`apps/web/src/components/ui/`)  
**Performance Goals**: 60fps animations, 0.00 Cumulative Layout Shift (CLS), instantaneous theme switching  
**Constraints**: Zero external heavyweight UI libraries (pure native React 19 + ARIA), WCAG AAA button contrast ($\ge 14:1$), 100% theme token compliance via `theme.ts` & `globals.css` (zero ad-hoc hex codes, zero capsule pill badges)  
**Scale/Scope**: 15 atomic UI components  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [X] **I. Spec-Driven Development (SDD)**: Spec approved under `specs/008-reusable-ui-components/spec.md`, TDD workflow planned.
- [X] **II. Modular Architecture & Service Isolation**: Pure UI components in `apps/web/src/components/ui/` with zero database or server runtime dependencies.
- [X] **III. Multi-Tenant Defense-in-Depth**: Pure presentational & interactive components agnostic of tenancy boundaries.
- [X] **IV. Zero-Trust Boundary Validation**: Strict TypeScript prop typing and HTML form constraints.
- [X] **V. Atomic PRs & Git Hygiene**: Tasks partitioned into small, atomic PR slices (<150–200 LoC).
- [X] **VIII. Theme Token Authority (`apps/web/src/lib/theme.ts`)**: 100% of styles derived from `theme.ts` and CSS variables in `globals.css`. Strict unboxed 6px luminous status dots with micro-halos; zero capsule pill badges; `DESIGN.md` remains strictly untouched.
- [X] **Pure Primitives**: Component primitives isolated with zero mock code in `apps/web`.
- [X] **Mandatory Human Approval Gate**: Direct merge to `main` requires explicit human approval.

---

## Project Structure

### Documentation (this feature)

```text
specs/008-reusable-ui-components/
├── spec.md              # Feature specification
├── plan.md              # Architectural blueprint
├── research.md          # Technical research & decisions
├── data-model.md        # Prop models & TypeScript interfaces
├── quickstart.md        # Test verification guide
├── checklists/
│   └── requirements.md  # Specification quality checklist
├── contracts/
│   └── ui-contracts.md  # Export interface contracts & accessibility specs
└── tasks.md             # Sequenced atomic tasks (Phase 6)
```

### Source Code Layout

```text
apps/web/src/components/ui/
├── index.ts             # Barrel export
├── button.tsx           # Button (primary, secondary, ghost, danger, link)
├── input.tsx            # Input (text, search, password, number)
├── textarea.tsx         # Textarea (multi-line, count)
├── checkbox.tsx         # Checkbox (4px rectilinear)
├── switch.tsx           # Switch toggle
├── select.tsx           # Select dropdown
├── card.tsx             # Card, CardHeader, CardTitle, CardContent, CardFooter
├── dialog.tsx           # Modal / Dialog overlay with focus trap
├── tabs.tsx             # Tabs, TabsList, TabsTrigger, TabsContent
├── table.tsx            # Table, TableHeader, TableRow, TableCell
├── status-dot.tsx       # Unboxed 6px luminous dot with micro-halo
├── tag.tsx              # Rectilinear 4px metadata tag
├── skeleton.tsx         # Shimmer pulse placeholder
├── alert.tsx            # Callout banner (info, success, warning, error)
└── tooltip.tsx          # Contextual floating popover

apps/web/tests/components/
├── button.test.tsx
├── input.test.tsx
├── dialog.test.tsx
├── tabs.test.tsx
├── status-dot.test.tsx
└── accessibility.test.tsx
```

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| None | All designs adhere strictly to React 19 standards and the project constitution. | N/A |
