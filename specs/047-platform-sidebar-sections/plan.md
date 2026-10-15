# Implementation Plan: Multi-Platform Sidebar Sections & Placeholder Workspaces

**Branch**: `feat/047-platform-sidebar-sections` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/047-platform-sidebar-sections/spec.md`

## Summary

Expand the workspace sidebar navigation under the "Platform" group to support five new social publishing channels alongside Facebook: Instagram, Threads, X (Twitter), TikTok, and YouTube. Each new platform features a brand-aligned stroke SVG icon, collapsible trigger, and an "Accounts" sub-item accompanied by an in-sidebar placeholder note ("Being tested — not available for public use"). Clicking an Accounts sub-item navigates to a dedicated placeholder workspace page (`/tenant/[subdomain]/[platform]/accounts`) rendering an empty state card explaining the testing status.

## Technical Context

**Language/Version**: TypeScript 5.8+, Next.js 16 (App Router), React 19  
**Primary Dependencies**: `@/components/ui/sidebar`, `@/lib/theme`, `lucide-react` / inline SVG icons conforming to design tokens  
**Storage**: N/A (UI navigation and placeholder pages; no database migrations needed)  
**Testing**: Vitest + React Testing Library (`apps/web/tests/ui/workspace-sidebar.test.tsx`, `apps/web/tests/ui/platform-placeholder-accounts.test.tsx`)  
**Target Platform**: Modern desktop and mobile web browsers  
**Project Type**: Next.js App Router Web Application (`apps/web`)  
**Performance Goals**: Instantaneous sidebar collapse/expand transitions (<16ms, 60fps), zero hydration mismatch, zero layout shifts  
**Constraints**: Absolute adherence to `apps/web/src/lib/theme.ts` (zero hardcoded hex codes, zero capsule pill badges, zero modification of `DESIGN.md`), strict UX writing standards (no technical plumbing leaks)  
**Scale/Scope**: 5 new collapsible platform entries in `WorkspaceSidebar`, 1 shared placeholder page component, 5 tenant route pages  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Principle 1: Monorepo Architecture & Package Boundaries (Changes isolated to `apps/web`)
- [x] Principle 6: Strict Design System Authority (`apps/web/src/lib/theme.ts` referenced exclusively)
- [x] Principle 14: Automated Testing & Zero Mock Theater (Real unit tests asserting rendered DOM)
- [x] Principle 19: Universal UX Writing & Tone Standards (Clear, human, zero tech plumbing leaks)
- [x] Absolute Immutability of `DESIGN.md` (DESIGN.md is untouched)
- [x] Single Combined PR Protocol (All artifacts and docs included in single PR)

## Project Structure

### Documentation (this feature)

```text
specs/047-platform-sidebar-sections/
├── plan.md              # This file
├── research.md          # Technical decisions and rationale
├── data-model.md        # Navigation data types and route mappings
├── quickstart.md        # Verification and testing scenarios
├── contracts/
│   └── platform-navigation.md # Component interfaces and URL routes
└── tasks.md             # Sequenced implementation tasks
```

### Source Code

```text
apps/web/
├── src/
│   ├── components/
│   │   └── workspace/
│   │       ├── workspace-sidebar.tsx              # Sidebar component with multi-platform menus
│   │       └── platform-placeholder-accounts.tsx  # Shared empty state placeholder component
│   └── app/
│       └── tenant/
│           └── [subdomain]/
│               ├── instagram/accounts/page.tsx    # Instagram Accounts placeholder page
│               ├── threads/accounts/page.tsx      # Threads Accounts placeholder page
│               ├── x/accounts/page.tsx            # X (Twitter) Accounts placeholder page
│               ├── tiktok/accounts/page.tsx       # TikTok Accounts placeholder page
│               └── youtube/accounts/page.tsx      # YouTube Accounts placeholder page
└── tests/
    └── ui/
        ├── workspace-sidebar.test.tsx             # Unit tests for sidebar navigation
        └── platform-placeholder-accounts.test.tsx # Unit tests for placeholder pages
```

## Complexity Tracking

*No constitutional violations; no additional external dependencies.*
