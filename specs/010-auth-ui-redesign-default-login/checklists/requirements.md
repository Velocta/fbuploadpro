# Quality Checklist: Auth UI/UX Redesign & Default Login Page

## 1. UX & Visual Craft
- [x] Root page (`/`) seamlessly redirects to `/login` with zero placeholder artifacts visible.
- [x] Split-screen layout renders correctly on desktop (>1024px) with brand showcase on left and form on right.
- [x] Responsive collapse operates smoothly on tablet and mobile (<768px) with no horizontal overflow.
- [x] Theme tokens from `@/lib/theme` and CSS variables are strictly used; zero ad-hoc hex codes or capsule pill badges.
- [x] Password field has an accessible eye toggle button with clear SVG icons and dynamic `aria-label`.
- [x] Subdomain preview box is removed from `/signup` per user directive.

## 2. Professional UX Writing
- [x] All copy is purposeful, concise, conversational, and clear.
- [x] No technical plumbing jargon (database, schema, regex, server names) anywhere on the page.
- [x] No decorative or fake status dots ("Online", "Ready").
- [x] Error messages clearly explain what happened and suggest a direct next step.

## 3. Accessibility & Security
- [x] All interactive elements are reachable via Tab navigation.
- [x] Color contrast exceeds WCAG AA standards.
- [x] Inputs have associated labels and descriptive helper texts where appropriate.
- [x] Passwords remain masked by default until explicitly toggled.
- [x] Sessions and return URLs are preserved accurately through the authentication flow.

## 4. Verification & Quality Gates
- [x] Unit tests for root redirect and auth layouts pass.
- [x] `pnpm turbo run build lint typecheck test` runs cleanly with 0 errors.
