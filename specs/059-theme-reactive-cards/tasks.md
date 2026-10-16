# Tasks: Theme-Reactive Cards & Placeholder Surfaces

**Feature Branch**: `fix/059-theme-reactive-cards`

**Specification**: `specs/059-theme-reactive-cards/spec.md`
**Plan**: `specs/059-theme-reactive-cards/plan.md`

## Phase 1: Setup & CSS Foundations
- [x] Task 1.1: Add alias fallback CSS variables (`--bg-surface: var(--bg-panel);` and `--text-muted: var(--text-sub);`) to `apps/web/src/app/globals.css` in `:root`, `[data-theme="light"], .light`, and `[data-theme="dark"], .dark`.

## Phase 2: Component Surface Refactoring
- [x] Task 2.1: Refactor `apps/web/src/components/studio/fdola-studio-gate.tsx` to bind card background to `var(--bg-panel, ${THEME.default.surfaces.panel})`, elevation shadow to `var(--shadow-card, ${THEME.default.shadows.card})`, and text to `var(--text-sub, ${THEME.default.text.secondary})`.
- [x] Task 2.2: Refactor `apps/web/src/components/studio/fdola-studio-workspace.tsx` to bind card background to `var(--bg-panel, ${THEME.default.surfaces.panel})`, elevation shadow to `var(--shadow-card, ${THEME.default.shadows.card})`, and text to `var(--text-sub, ${THEME.default.text.secondary})`.
- [x] Task 2.3: Refactor `apps/web/src/components/workspace/platform-placeholder-accounts.tsx` to bind card background to `var(--bg-panel, ${THEME.default.surfaces.panel})`, elevation shadow to `var(--shadow-card, ${THEME.default.shadows.card})`, and text to `var(--text-sub, ${THEME.default.text.secondary})`.

## Phase 3: Automated Testing & Verification
- [x] Task 3.1: Update unit tests in `apps/web/tests/ui/fdola-studio.test.tsx` to assert theme CSS variable bindings.
- [x] Task 3.2: Create unit tests in `apps/web/tests/ui/platform-placeholder-accounts.test.tsx` asserting theme CSS variable bindings for platform accounts cards.

## Phase 4: Documentation Synchronization
- [x] Task 4.1: Update `docs/foundational-knowledge.md` to document the theme token reactivity standard for cards and placeholder surfaces.
