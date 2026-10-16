# Feature Specification: Theme-Reactive Cards & Placeholder Surfaces

**Feature Branch**: `fix/059-theme-reactive-cards`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "the underlying card is not based on theme its not changing color when iam switching from dark mode to light mode make it proper its happening in all the prop sidebars like instagram tiktok etc as well"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Theme-Reactive Surface Switching for Fdola Studio & Platform Cards (Priority: P1)

When users toggle between Dark Mode and Light Mode using the workspace user menu, all cards and container surfaces across the application—including Fdola Studio (web gate & desktop workspace) and all platform sidebar destinations (Instagram, TikTok, YouTube, Threads, X)—must dynamically update their background color, border color, text color, and elevation shadow in immediate lockstep with the active theme mode without requiring page reload or leaving stale dark tokens on a light canvas.

**Why this priority**: Inconsistent surfaces break UI polish, cause unreadable text contrast (e.g. dark slate cards stranded on light gray canvas), and violate Design System Theme Governance (Principle 8 & Theme Standards).

**Independent Test**:
1. Mount `FdolaStudioGate`, `FdolaStudioWorkspace`, and `PlatformPlaceholderAccounts` under default dark mode: verify background resolves to dark panel token (`var(--bg-panel, #0c0d10)`), subtle border (`var(--border-subtle, #1f242d)`), and high contrast white text (`var(--text-main, #ffffff)`).
2. Set `data-theme="light"` on the document root: verify the cards immediately adapt to light panel token (`#ffffff`), light hairline border (`#eaecef`), light card shadow, and crisp black text (`#000000`) and secondary text (`#474d57`).

**Acceptance Scenarios**:

1. **Given** a user viewing Fdola Studio in a web browser on Dark Mode, **When** they toggle the theme to Light Mode via the workspace menu, **Then** the gate card background transitions from dark panel (`#0c0d10`) to clean white (`#ffffff`), the subtle hairline border updates to light slate (`#eaecef`), the shadow shifts to light elevation, and all body copy updates to crisp light-mode text tokens.
2. **Given** a user navigating to any upcoming platform sidebar route (Instagram, TikTok, YouTube, Threads, or X) on Light Mode, **When** the page renders `PlatformPlaceholderAccounts`, **Then** the placeholder card displays with a white panel surface (`var(--bg-panel)`), light borders, reactive icon container background (`var(--bg-active)`), and reactive secondary text (`var(--text-sub)`), with zero hardcoded pitch-slate dark backgrounds.
3. **Given** any component referencing CSS variables `--bg-surface` or `--text-muted`, **When** evaluated in `:root`, `[data-theme="light"]`, or `[data-theme="dark"]`, **Then** `globals.css` provides resilient alias fallbacks mapping `--bg-surface` to `--bg-panel` and `--text-muted` to `--text-sub`.

---

### User Story 2 - Automated Theme Reactivity Test Suite (Priority: P2)

Comprehensive automated unit and regression tests in `apps/web` must assert that `FdolaStudioGate`, `FdolaStudioWorkspace`, and `PlatformPlaceholderAccounts` correctly reference dynamic CSS variables `--bg-panel`, `--border-subtle`, `--shadow-card`, and `--text-sub` instead of hardcoded dark color literals or undefined variables.

**Why this priority**: Prevents theme regressions and guarantees ongoing adherence to Theme System Governance and Taste Skill standards.

**Independent Test**:
Run UI test suite asserting computed styles or inline style references across dark and light CSS variable bindings.

**Acceptance Scenarios**:

1. **Given** `fdola-studio-gate.tsx` and `fdola-studio-workspace.tsx`, **When** rendered, **Then** the card background is bound to `var(--bg-panel, ...)` and card shadow is bound to `var(--shadow-card, ...)`.
2. **Given** `platform-placeholder-accounts.tsx`, **When** rendered for any platform, **Then** the card background is bound to `var(--bg-panel, ...)` and body copy is bound to `var(--text-sub, ...)`.

---

## Technical Constraints & Boundaries

- **Theme Authority**: Strictly follow `apps/web/src/lib/theme.ts` and `apps/web/src/app/globals.css`.
- **Immutability of `DESIGN.md`**: Do NOT modify `DESIGN.md`.
- **CSS Variable Contract**:
  - Panel backgrounds: `var(--bg-panel, ${THEME.default.surfaces.panel})`
  - Subtle borders: `var(--border-subtle, ${THEME.default.borders.hairline})`
  - Card elevation shadow: `var(--shadow-card, ${THEME.default.shadows.card})`
  - Primary text: `var(--text-main, ${THEME.default.text.primary})`
  - Secondary text: `var(--text-sub, ${THEME.default.text.secondary})`
  - Muted text: `var(--text-dim, ${THEME.default.text.muted})`
  - Active button / icon container: `var(--bg-active, ${THEME.default.surfaces.active})`
  - Hover state: `var(--bg-hover, ${THEME.default.surfaces.hover})`
- **Global CSS Safeguards**: Add `--bg-surface: var(--bg-panel);` and `--text-muted: var(--text-sub);` in `globals.css` `:root`, light, and dark blocks for resilience.
