# Implementation Plan: Fdola Studio Desktop-Only Section & Native Shell Scaffolding

**Branch**: `feat/057-fdola-studio-desktop-section` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/057-fdola-studio-desktop-section/spec.md`

## Summary

Implement a new navigation section in the primary workspace group positioned directly below "Downloader" named "Fdola Studio". In standard web browsers, navigating to `/tenant/[subdomain]/fdola-studio` displays a dedicated desktop gate card stating "This feature is only available on desktop. Please download the desktop app." with zero download links and zero buttons. When running inside the desktop shell (detected via `@fbuploadpro/contracts` `isDesktopApp()`), it renders an empty Fdola Studio workspace placeholder for the desktop application.

## Technical Context

**Language/Version**: TypeScript 5.8+, Next.js 16 (App Router), React 19  
**Primary Dependencies**: `@fbuploadpro/contracts` (`isDesktopApp`), `@/components/ui/sidebar`, `@/lib/theme`, native SVG icons  
**Storage**: N/A (Client-side workspace routing, environment detection, and tool scaffolding)  
**Testing**: Vitest + React Testing Library (`apps/web/tests/ui/workspace-sidebar.test.tsx`, `apps/web/tests/ui/workspace-breadcrumb.test.tsx`, `apps/web/tests/ui/fdola-studio.test.tsx`)  
**Target Platform**: Tauri v2 Desktop Client (`apps/desktop`) and modern desktop web browsers (`apps/web`)  
**Project Type**: Next.js App Router Web Application (`apps/web`) & Tauri v2 Desktop Client (`apps/desktop`)  
**Performance Goals**: Instantaneous route transition (<50ms), zero hydration mismatch, zero layout shifts  
**Constraints**: Strict adherence to `apps/web/src/lib/theme.ts` (zero hardcoded hex codes, zero capsule pill badges, zero modification of `DESIGN.md`), strict UX writing standards (no technical plumbing leaks)  
**Scale/Scope**: 1 new sidebar navigation entry, breadcrumb mapping, 1 desktop gate / studio workspace component (`FdolaStudioView`), 1 tenant page route (`/tenant/[subdomain]/fdola-studio`), automated UI test suites  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Principle 1: Monorepo Architecture & Package Boundaries (Changes isolated to `apps/web` with domain contracts in `@fbuploadpro/contracts`)
- [x] Principle 6: Strict Design System Authority (`apps/web/src/lib/theme.ts` referenced exclusively)
- [x] Principle 14: Automated Testing & Zero Mock Theater (Real unit tests asserting rendered DOM)
- [x] Principle 19: Universal UX Writing & Tone Standards (Clear, human, zero tech plumbing leaks)
- [x] Absolute Immutability of `DESIGN.md` (DESIGN.md is untouched)
- [x] Single Combined PR Protocol (All artifacts and docs included in single PR)

## Project Structure

### Documentation (this feature)

```text
specs/057-fdola-studio-desktop-section/
├── plan.md              # This file
├── research.md          # Technical decisions and architecture rationale
├── data-model.md        # Environment states and tool module types
├── quickstart.md        # Verification and testing scenarios
├── contracts/
│   └── studio-contracts.md # Component interfaces and route contracts
└── tasks.md             # Sequenced implementation tasks
```

### Source Code

```text
apps/web/
├── src/
│   ├── components/
│   │   ├── workspace/
│   │   │   ├── workspace-sidebar.tsx              # Add Fdola Studio below Downloader
│   │   │   └── workspace-breadcrumb.tsx           # Add Fdola Studio breadcrumb mapping
│   │   └── studio/
│   │       ├── fdola-studio-view.tsx              # Environment-adaptive studio / gate container
│   │       ├── fdola-studio-gate.tsx              # Web browser desktop gate card
│   │       └── fdola-studio-workspace.tsx         # Native desktop studio shell & tool modules
│   └── app/
│       └── tenant/
│           └── [subdomain]/
│               └── fdola-studio/
│                   └── page.tsx                   # Tenant Fdola Studio page route
└── tests/
    └── ui/
        ├── fdola-studio.test.tsx                  # Unit tests for studio view, gate & workspace
        ├── workspace-sidebar.test.tsx             # Updated sidebar ordering & active state tests
        └── workspace-breadcrumb.test.tsx          # Updated breadcrumb resolution tests
```

**Structure Decision**: Clean component separation under `apps/web/src/components/studio/` with the root entry at `apps/web/src/app/tenant/[subdomain]/fdola-studio/page.tsx`, consuming `isDesktopApp()` from `@fbuploadpro/contracts`.

## Complexity Tracking

> Zero constitution violations; no complexity tracking entries required.
