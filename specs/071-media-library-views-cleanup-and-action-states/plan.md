# Implementation Plan: Media Library Sidebar Cleanup & Double-Click Action State Hardening

**Branch**: `feat/071-media-library-views-cleanup-and-action-states` | **Date**: October 18, 2026 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/071-media-library-views-cleanup-and-action-states/spec.md`

## Summary

This plan outlines the architectural and code modifications required to:
1. Completely remove the `<aside data-testid="media-views-rail">` and the `MediaViewsRail` component, returning the Media Library to a full-width layout where folder navigation is elegantly handled by the breadcrumbs context row and subfolder rows.
2. Implement explicit, robust loading and disabled states (`isSubmitting`, `isRenamingFolder`, `isDeletingFolder`, `isMoving`, `isDeleting`, `isSaving`, `isBusy`) across all dialogs, action bars, cards, table rows, and import buttons to prevent duplicate API executions and accidental double-clicks.

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19 / Next.js 16 App Router  
**Primary Dependencies**: React hooks, Next.js, `@fbuploadpro/contracts`, `apps/web/src/lib/theme.ts`  
**Storage**: Remote Supabase PostgreSQL (via existing Next.js API route handlers)  
**Testing**: Vitest (`apps/web/tests/ui/media-library-explorer.test.tsx`)  
**Target Platform**: Web (Modern desktop & tablet browsers)  
**Project Type**: Monorepo Web Application (`apps/web`)  
**Constraints**: Zero changes to `DESIGN.md`, strictly reference tokens from `apps/web/src/lib/theme.ts`, zero local CI builds.

## Constitution Check

| Principle | Status | Notes |
| :--- | :--- | :--- |
| **P1: Single Source of Truth** | PASS | All tokens from `@web/lib/theme`. |
| **P2: Strict Immutability of DESIGN.md** | PASS | No modifications to `DESIGN.md`. |
| **P3: Plain Language Copy** | PASS | All buttons show clear, plain text ("Creating...", "Saving...", "Deleting...", "Moving..."). |
| **P4: No Local Builds** | PASS | Validation offloaded to remote GitHub Actions CI. |
| **P5: Single Combined PR** | PASS | Specs, code, tests, and documentation committed atomically in one PR. |

## Project Structure

### Documentation (this feature)

```text
specs/071-media-library-views-cleanup-and-action-states/
├── spec.md              # Feature specification
├── research.md          # Pre-implementation technical investigation
├── plan.md              # Technical implementation plan
├── data-model.md        # State definitions and transition models
├── quickstart.md        # Verification and regression test guide
├── checklists/
│   └── requirements.md  # Quality and compliance checklist
└── tasks.md             # Sequenced, atomic implementation tasks
```

### Source Code Impact

```text
apps/web/src/components/media/
├── media-library-explorer.tsx      # Remove MediaViewsRail; add folder/asset action states
├── new-folder-modal.tsx            # Disable inputs & cancel on isSubmitting; double-click guard
├── batch-action-bar.tsx            # Connect isBusy prop to batch operations in explorer
├── batch-set-caption-modal.tsx     # Disable inputs & cancel on isSubmitting; double-click guard
├── media-preview-modal.tsx         # Add isDeleting state; disable save/delete/cancel during ops
├── media-import-modal.tsx          # Protect Start import from rapid double clicks
apps/web/tests/ui/
└── media-library-explorer.test.tsx # Update tests for sidebar removal and action states
docs/
└── foundational-knowledge.md       # Synchronize architectural documentation
```
