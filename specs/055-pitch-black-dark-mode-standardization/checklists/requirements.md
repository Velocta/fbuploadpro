# Requirements Checklist: Pitch Black Dark Mode Standardization (Spec 055)

- [ ] `DARK_THEME.surfaces.canvas` in `apps/web/src/lib/theme.ts` set to `#000000`.
- [ ] `DARK_THEME.surfaces.panel` set to `#0c0d10`.
- [ ] `DARK_THEME.surfaces.subtle` set to `#121419`.
- [ ] `DARK_THEME.surfaces.hover` set to `#1f242d`.
- [ ] `DARK_THEME.surfaces.active` set to `#262c37`.
- [ ] `DARK_THEME.borders.hairline` set to `#1f242d`.
- [ ] `DARK_THEME.borders.strong` set to `#2b323c`.
- [ ] `:root` CSS variables in `apps/web/src/app/globals.css` synchronized with `[data-theme="dark"], .dark`.
- [ ] `apps/web/src/app/layout.tsx` injects pre-hydration theme initialization script and `suppressHydrationWarning`.
- [ ] `WorkspaceStudioFooter` syncs `data-theme` on mount and writes `fbup_theme` cookie on toggle.
- [ ] Unit tests in `apps/web/tests/ui/pages.test.tsx` updated for `#000000` canvas and verified for CI.
- [ ] `docs/foundational-knowledge.md` synchronized with Spec 055.
