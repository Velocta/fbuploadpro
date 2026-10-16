# Feature Specification: Pitch Black Dark Mode Standardization & Initial Load Synchronization (Spec 055)

**Branch**: `feat/055-pitch-black-dark-mode-standardization`  
**Status**: Ready for Implementation  
**Category**: Frontend Architecture & Design Craft  
**Scope**: 
- `apps/web/src/lib/theme.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/workspace/workspace-studio-footer.tsx`
- `apps/web/tests/ui/pages.test.tsx`
- `docs/foundational-knowledge.md`

---

## 1. Problem Statement & Motivation

1. **Dark Mode Inconsistency Between Login and Toggled State**:
   - In Spec 051, `:root` default tokens in `apps/web/src/app/globals.css` and `DARK_THEME` in `apps/web/src/lib/theme.ts` were set to Midnight Slate (`--bg-canvas: #0a0c10`, `--bg-panel: #12151c`, `--border-subtle: #222735`), introducing an unintentional blue/slate tint.
   - However, the explicit selector `[data-theme="dark"], .dark` in `apps/web/src/app/globals.css` remained defined as Pure Pitch Black (`--bg-canvas: #000000`, `--bg-panel: #0c0d10`, `--border-subtle: #1f242d`).
   - Consequently, upon fresh login or page load without an explicit `data-theme` attribute, the browser renders the blue-tinted Midnight Slate (`#0a0c10`).
   - When the user toggles from Dark to Light and then back to Dark mode, `document.documentElement.dataset.theme = 'dark'` is attached, triggering `[data-theme="dark"]` and abruptly switching to the pure Pitch Black (`#000000`) theme.

2. **Unsynchronized Theme State on Initial Render & Missing Cookie Sync**:
   - `apps/web/src/app/layout.tsx` renders `<html lang="en">` without an inline theme evaluation script or initial `data-theme` attribute, leaving the document element uninitialized until client-side hydration.
   - `WorkspaceStudioFooter` initializes `isThemeDark` locally from storage but fails to write `data-theme` to `document.documentElement` on mount, and omits setting the `fbup_theme` cookie upon theme toggles (violating the workspace shell theming rule in `.specify/memory/constitution.md`).

3. **Alignment with Immutable Design Specification (`DESIGN.md`)**:
   - `DESIGN.md` Section 1.1 & 2.2 permanently specifies Pitch Black (`#000000`) as the canonical dark mode surface canvas and `#0c0d10` as panel surfaces with `#1f242d` borders.
   - Restoring Pure Pitch Black across all dark mode definitions eliminates the discrepancy, satisfies user preference, and re-aligns the codebase with `DESIGN.md`.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Standardize Pure Pitch Black Tokens Everywhere (P1)
**As an** operator navigating the platform in dark mode,  
**I want** dark mode to use consistent Pure Pitch Black (`#000000`) surfaces from the moment I log in,  
**So that** I do not experience a strange blue-slate tint on load or a visual color jump after toggling themes.

- **Acceptance Criteria**:
  - `DARK_THEME.surfaces.canvas` in `apps/web/src/lib/theme.ts` is `#000000`.
  - `DARK_THEME.surfaces.panel` is `#0c0d10`.
  - `DARK_THEME.surfaces.subtle` is `#121419`.
  - `DARK_THEME.surfaces.hover` is `#1f242d`.
  - `DARK_THEME.surfaces.active` is `#262c37`.
  - `DARK_THEME.borders.hairline` is `#1f242d` and `border-strong` is `#2b323c`.
  - `:root` default tokens in `apps/web/src/app/globals.css` match `[data-theme="dark"], .dark` exactly (`--bg-canvas: #000000`, `--bg-panel: #0c0d10`, `--bg-subtle: #121419`, `--bg-hover: #1f242d`, `--bg-active: #262c37`, `--border-subtle: #1f242d`, `--border-strong: #2b323c`).
  - Light mode surfaces (`--bg-canvas: #f6f8fa`, `--bg-panel: #ffffff`) remain completely preserved and functional.

### User Story 2: Seamless Pre-Hydration Theme Initialization & Cookie Sync (P1)
**As an** operator refreshing or opening tabs,  
**I want** my preferred theme (dark or light) applied before initial paint without flash or discrepancy,  
**So that** the interface looks stable, predictable, and professional.

- **Acceptance Criteria**:
  - `apps/web/src/app/layout.tsx` incorporates an inline `<script>` in `<head>` (or root) that evaluates `localStorage.getItem('theme')` or cookie `fbup_theme`, defaulting to `'dark'`, and immediately applies `document.documentElement.dataset.theme = activeTheme`.
  - `suppressHydrationWarning` is added to `<html lang="en">` to allow pre-hydration theme injection without React hydration mismatch warnings.
  - `WorkspaceStudioFooter` ensures that theme toggles persist to both `localStorage.setItem('theme', newTheme)` and `document.cookie = fbup_theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`.
  - On mount, `WorkspaceStudioFooter` ensures `document.documentElement.dataset.theme` is synchronized with the resolved theme.

### User Story 3: UI Test Suite & Documentation Verification (P1)
**As a** software engineer maintaining the codebase,  
**I want** theme token unit tests and foundational documentation updated to reflect Pure Pitch Black dark mode,  
**So that** CI test suites pass cleanly and platform knowledge remains synchronized.

- **Acceptance Criteria**:
  - Unit tests in `apps/web/tests/ui/pages.test.tsx` validate `DARK_THEME.surfaces.canvas` as `#000000`, `panel` as `#0c0d10`, `subtle` as `#121419`, and `hairline` as `#1f242d`.
  - `docs/foundational-knowledge.md` documents Spec 055 resolution.

---

## 3. Non-Functional Requirements
- **Theme Standard Enforcement**: Strict adherence to `.agents/rules/theme-standards.md`.
- **Absolute Immutability of `DESIGN.md`**: Do NOT modify `DESIGN.md`.
- **Zero Local Checks**: Validation performed via remote GitHub Actions CI upon PR creation.
