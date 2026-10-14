# UX Writing & Theme Checklist: 041-strict-workspace-byoc-isolation

**Purpose**: Validate user-facing copy, interface clarity, and design token adherence
**Feature**: [spec.md](../spec.md)

## UX Writing Standards (`.agents/rules/ux-writing-standards.md`)

- [ ] Navigation tab and section heading are named "Facebook BYOC"
- [ ] No internal technical plumbing leaks (no mentions of PostgREST, RLS, composite foreign keys, or database schemas in UI copy)
- [ ] Clear, actionable helper text guiding users to Meta Developer Dashboard when configuring BYOC
- [ ] Pre-connection warning on Accounts page explains clearly why Facebook BYOC must be configured first
- [ ] Error messages for unconfigured BYOC provide direct, one-click links/buttons to Settings
- [ ] Zero simulated or decorative status indicators (status signals only reflect real entity runtime states)
- [ ] Zero em-dashes (`—`) in user-facing copy

## Theme & Design System Standards (`apps/web/src/lib/theme.ts`)

- [ ] Single source of truth: all colors, borders, radii, and spacing consumed from `@/lib/theme`
- [ ] `DESIGN.md` remains 100% untouched and unmodified (permanently frozen)
- [ ] Zero hardcoded hex colors or custom inline borders outside theme tokens
- [ ] Accessible color contrasts in both Dark Mode and Light Mode
