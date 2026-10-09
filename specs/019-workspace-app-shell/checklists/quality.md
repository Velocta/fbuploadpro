# Quality & UX Checklist: Pure Sidebar-Only Workspace App Shell

**Feature ID**: `019-workspace-app-shell`  
**Date**: 2026-10-09  

---

## 1. Layout & Headerless Architecture
- [ ] No top horizontal `<header>` exists above the main content canvas on desktop
- [ ] Content canvas (`SidebarInset`) occupies 100vh full height with independent vertical scrolling
- [ ] All colors, backgrounds, borders, and spacing use tokens strictly from `apps/web/src/lib/theme.ts`
- [ ] `DESIGN.md` remains completely unmodified and respected

## 2. Navigation Hierarchy & Shadcn Primitives
- [ ] `SidebarSeparator` primitive component implemented with hairline border token
- [ ] "Home" navigation item displayed at top with home icon and active keystone bar
- [ ] Visual hairline separator rendered between "Home" and the "Facebook" section
- [ ] "Facebook" group heading rendered using `SidebarGroupLabel`
- [ ] "Accounts" sub-item rendered under the "Facebook" section

## 3. User Profile Card & Chevron-Up Popover
- [ ] User profile displays avatar with initials, user name, and canonical email
- [ ] Chevron-up (`^`) trigger button renders with accessible `aria-label` and `aria-expanded`
- [ ] Popover card opens smoothly anchored above the footer card
- [ ] Popover contains theme switcher (Dark / Light)
- [ ] Popover contains "Sign out" action calling `POST /api/auth/logout`
- [ ] Outside click listener dismisses popover cleanly

## 4. Mobile Responsiveness
- [ ] On viewports <768px, desktop sidebar docks off-canvas
- [ ] Discreet floating trigger button renders in top-left corner on mobile
- [ ] Tapping floating button slides out mobile drawer sheet with backdrop blur
- [ ] Tapping backdrop or selecting route closes the mobile drawer

## 5. Quality & Governance Gates
- [ ] Unit and component test suites pass for all new and modified components
- [ ] `pnpm turbo run build lint typecheck test` passes with 100% success and 0 errors
