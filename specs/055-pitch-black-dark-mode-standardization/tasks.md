# Implementation Tasks: Pitch Black Dark Mode Standardization (Spec 055)

- [x] **T001 [P1]**: Restore Pure Pitch Black dark mode surface tokens in `apps/web/src/lib/theme.ts` (`canvas: '#000000'`, `panel: '#0c0d10'`, `subtle: '#121419'`, `hover: '#1f242d'`, `active: '#262c37'`, `borders.hairline: '#1f242d'`, `borders.strong: '#2b323c'`).
- [x] **T002 [P1]**: Align `:root` CSS variables in `apps/web/src/app/globals.css` with `[data-theme="dark"], .dark` (`--bg-canvas: #000000`, `--bg-panel: #0c0d10`, `--bg-subtle: #121419`, `--bg-hover: #1f242d`, `--bg-active: #262c37`, `--border-subtle: #1f242d`, `--border-strong: #2b323c`).
- [x] **T003 [P1]**: Add pre-hydration theme initialization script and `suppressHydrationWarning` to `apps/web/src/app/layout.tsx`.
- [x] **T004 [P1]**: Update `apps/web/src/components/workspace/workspace-studio-footer.tsx` to set `data-theme` on mount and persist `fbup_theme` cookie upon toggling.
- [x] **T005 [P1]**: Update unit tests in `apps/web/tests/ui/pages.test.tsx` for Pure Pitch Black token assertions.
- [x] **T006 [P1]**: Update roadmap milestones and feature log in `docs/foundational-knowledge.md`.
