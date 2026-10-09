# Quality Checklist: Spec 022 — Left-Aligned Authentication Split Layout

## Requirements Validation
- [ ] Primary interactive form container is positioned on the left side on desktop ($\ge 1024\text{px}$).
- [ ] Showcase container is positioned on the right side on desktop with border on the left (`border-left`) and outer glow at `82% 22%`.
- [ ] `AuthSplitLayout` supports `formPosition?: 'left' | 'right'` with `'left'` as default.
- [ ] Consistent experience verified on `/login`, `/signup`, `/forgot-password`, and `/reset-password`.
- [ ] Responsive behavior hides showcase on `< 1024\text{px}` and presents full-width form with mobile header.
- [ ] Zero technical plumbing leaks or fake status badges in copy.
- [ ] Theme tokens strictly adhered to from `apps/web/src/lib/theme.ts`.
- [ ] `DESIGN.md` remains completely untouched.
- [ ] All tests passing 100% across Turborepo pipeline.
