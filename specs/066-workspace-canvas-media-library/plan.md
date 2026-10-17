# Implementation Plan: Workspace Canvas Media Library

**Branch**: `feat/066-workspace-canvas-media-library` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/066-workspace-canvas-media-library/spec.md`

---

## 1. Summary

This plan executes the complete architectural and UX/UI transformation of the FBUploadPro Media Library from a nested "box-in-a-box" card hierarchy into a high-precision, 3-pane **Workspace Canvas**:
1. **Left Folder Rail (`MediaFolderRail`)**: 250px collapsible sidebar organizing Smart Collections (*All Media*, *Videos*, *Images*, *Uncaptioned*) and full folder tree with native HTML5 drag-and-drop targets.
2. **Fluid Media Stage**: Visual-first borderless media grid replacing nested card boxes, embedded caption textareas, and 4-button action rows with clean, elevated `MediaAssetTile` components.
3. **Right Inspector Panel (`MediaInspectorPanel`)**: 360px dedicated creative studio housing interactive media player with scrubber, direct caption editor with counter, one-click scheduling, folder relocation, and Facebook publishing format eligibility readouts.

---

## 2. Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16 App Router  
**Primary Dependencies**: `@fbuploadpro/contracts`, `lucide-react`, `@supabase/supabase-js`  
**Storage**: Remote Supabase PostgreSQL (via existing `/api/tenant/[subdomain]/media` endpoints)  
**Testing**: Vitest (`apps/web/tests/ui/media-library-explorer.test.tsx`)  
**Target Platform**: Vercel (Next.js 16 Webapp)  
**Project Type**: Monorepo Web Application  
**Performance Goals**: Instant responsive layout transition (< 16ms, 60fps); tile hover video playback debounce (300ms); zero layout shifts on panel open/close  
**Constraints**: Zero ad-hoc colors or borders (strict adherence to `apps/web/src/lib/theme.ts` & `DESIGN.md`); zero capsule pill badges; no local builds before commit (remote CI PR verification)

---

## 3. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (SDD & TDD)**: Fully specified in `spec.md`, planned in `plan.md`, testable via automated Vitest suites.
- [x] **Principle II (Service Isolation)**: Strictly frontend UI and client components within `apps/web`; zero backend leakage.
- [x] **Principle III (Design System Authority)**: Anchored strictly to `apps/web/src/lib/theme.ts` (pitch black canvas `#000000`, 1px hairlines `#1f242d`, gold `#fad734` focus ring and primary buttons, zero capsule pills).
- [x] **Principle IV (Anti-Slop Craft & Impeccable Floor)**: Eliminates box-in-a-box nesting; promotes visual media assets to 80%+ of tile surface; professional UX copy with zero internal plumbing exposure.
- [x] **Elimination of Local Builds**: Verification offloaded to remote GitHub Actions CI.

---

## 4. Project Structure

### Documentation (this feature)

```text
specs/066-workspace-canvas-media-library/
├── plan.md              # This file
├── research.md          # Architectural decisions & research
├── data-model.md        # State models & smart collections mapping
├── quickstart.md        # Verification workflows
├── contracts/
│   └── workspace-canvas-contracts.md # Component interfaces & props
└── tasks.md             # Implementation tasks (generated in Phase 6)
```

### Source Code Impact

```text
apps/web/
├── src/
│   ├── components/
│   │   └── media/
│   │       ├── media-library-explorer.tsx      # Orchestrator refactored to 3-pane Workspace Canvas
│   │       ├── media-folder-rail.tsx           # NEW: Left sidebar rail (smart collections + folder tree)
│   │       ├── media-asset-tile.tsx            # NEW: Clean visual tile (anti-box, hover preview, no inline form)
│   │       ├── media-inspector-panel.tsx       # NEW: Right studio panel (preview, caption editor, eligibility)
│   │       ├── media-asset-card.tsx            # Refactored/aliased to clean tile implementation
│   │       └── index.ts                        # Exports
│   └── lib/
│       └── theme.ts                            # Single source of truth styling tokens
└── tests/
    └── ui/
        └── media-library-explorer.test.tsx     # Comprehensive Vitest test suite for 3-pane studio
```

---

## 5. Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| None | N/A | N/A |
