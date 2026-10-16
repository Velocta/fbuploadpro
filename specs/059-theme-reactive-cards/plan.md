# Implementation Plan: Theme-Reactive Cards & Placeholder Surfaces

**Feature Branch**: `fix/059-theme-reactive-cards`

**Specification**: `specs/059-theme-reactive-cards/spec.md`

## 1. Architectural Strategy

1. **Root Cause Analysis**:
   - `fdola-studio-gate.tsx`, `fdola-studio-workspace.tsx`, and `platform-placeholder-accounts.tsx` styled their inner card container with:
     - `backgroundColor: var(--bg-surface, ${THEME.default.surfaces.panel})`
     - `boxShadow: THEME.default.shadows.card`
     - `color: var(--text-muted, ${THEME.default.text.secondary})`
   - In `apps/web/src/app/globals.css`, `--bg-surface` and `--text-muted` were never defined in `:root` or `[data-theme="light"]`.
   - Consequently, when the user switched to Light Mode (`data-theme="light"` on `<html>`), the browser could not resolve `--bg-surface` and fell back to the hardcoded JS dark token `${THEME.default.surfaces.panel}` (`#0c0d10`).
   - The card elevation shadow was passed as a literal JS string from `THEME.default.shadows.card` (`0 2px 8px rgba(0, 0, 0, 0.60)`) rather than the CSS variable `var(--shadow-card)`.
   - The secondary text also fell back to dark mode secondary color `#9ca3af` rather than `--text-sub` (`#474d57` in light mode).

2. **Remediation Plan**:
   - **Component-Level Refactoring**:
     - Replace `var(--bg-surface, ...)` with `var(--bg-panel, ${THEME.default.surfaces.panel})` across:
       - `apps/web/src/components/studio/fdola-studio-gate.tsx`
       - `apps/web/src/components/studio/fdola-studio-workspace.tsx`
       - `apps/web/src/components/workspace/platform-placeholder-accounts.tsx`
     - Replace `boxShadow: THEME.default.shadows.card` with `boxShadow: var(--shadow-card, ${THEME.default.shadows.card})`.
     - Replace `var(--text-muted, ...)` with `var(--text-sub, ${THEME.default.text.secondary})`.
   - **Global CSS Fallback Resilience**:
     - In `apps/web/src/app/globals.css`, add explicit alias variables `--bg-surface: var(--bg-panel);` and `--text-muted: var(--text-sub);` in `:root`, `[data-theme="light"], .light`, and `[data-theme="dark"], .dark`. This prevents any future or third-party component using either variable from remaining stuck in dark mode.
   - **Verification**:
     - Update unit tests in `apps/web/tests/ui/fdola-studio.test.tsx` and create/update tests for `platform-placeholder-accounts.tsx` to assert theme CSS variable bindings.
     - Verify documentation in `docs/foundational-knowledge.md`.

## 2. File Modification Boundaries

| File | Change Type | Responsibility |
| :--- | :--- | :--- |
| `apps/web/src/app/globals.css` | Update | Add `--bg-surface` and `--text-muted` aliases to `:root`, light, and dark definitions |
| `apps/web/src/components/studio/fdola-studio-gate.tsx` | Update | Use `var(--bg-panel)`, `var(--shadow-card)`, and `var(--text-sub)` |
| `apps/web/src/components/studio/fdola-studio-workspace.tsx` | Update | Use `var(--bg-panel)`, `var(--shadow-card)`, and `var(--text-sub)` |
| `apps/web/src/components/workspace/platform-placeholder-accounts.tsx` | Update | Use `var(--bg-panel)`, `var(--shadow-card)`, and `var(--text-sub)` |
| `apps/web/tests/ui/fdola-studio.test.tsx` | Update | Assert theme-reactive variables |
| `apps/web/tests/ui/platform-placeholder-accounts.test.tsx` | Create/Update | Assert placeholder accounts theme-reactive variables |
| `docs/foundational-knowledge.md` | Update | Document theme token reactivity standard for cards and placeholder surfaces |
