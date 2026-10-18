# Implementation Plan: Media Library Functional Fixes

**Branch**: `fix/068-media-library-functional-fixes` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Fix verified issues in the Media Library (`/tenant/[subdomain]/media`, `MediaLibraryExplorer`): spontaneous import cancel, missing storage media listing, dropdown option selection, and toolbar dividers.

---

## Summary

Remediate four critical and quality-of-life defects in the Media Library:
1. Fix presigned R2 upload parameters and confirmation body in `MediaImportModal` to correctly use `UploadUrlResponse` keys (`mediaUploadUrl`, `mediaKey`, `publicMediaUrl`), implement an explicit user action guard for batch cancellation, and log state machine transitions.
2. Update `MediaListQuerySchema` in `@fbuploadpro/contracts` to accept `limit` up to 1000 so the initial explorer fetch (`limit=500`) succeeds with HTTP 200, resolving existing storage files (including `velocta-avatar.png`) at root and across searches.
3. Fix toolbar dropdown menus (Aspect ratio, Caption status, Sort) so outside-click listeners do not swallow option clicks, update trigger labels upon selection, and support keyboard interaction.
4. Render 1px vertical hairline dividers (`var(--border-subtle)`) separating toolbar groups (Search, Media-type tabs, Dropdowns, View mode toggle) per approved design.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ / Next.js 16 (App Router) / React 19  
**Primary Dependencies**: `@fbuploadpro/contracts`, `zod`, `@web/lib/theme`  
**Storage**: Remote Supabase PostgreSQL substrate (`media_items`), Cloudflare R2 bucket  
**Testing**: Vitest (`packages/contracts/tests/`, `apps/web/tests/ui/`)  
**Target Platform**: Web application (`apps/web`)  
**Constraints**: Do NOT modify `DESIGN.md`, theme tokens, global CSS, colors, fonts, or type scale. Single unified agent execution. Remote CI validation on PR.

---

## Constitution Check

- Single unified agent workflow (no subagents).
- Follow SDD: specify -> plan -> checklist -> tasks -> implement -> converge -> PR.
- Strict theme token compliance (reference `var(--border-subtle)` / `@web/lib/theme`).
- Absolute immutability of `DESIGN.md` (no edits to `DESIGN.md`).
- No local builds or tests before PR creation; remote CI quality gate.
- Single combined PR including spec artifacts and docs updates.

---

## Project Structure

### Documentation & Specs
```text
specs/068-media-library-functional-fixes/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code Touched
```text
packages/contracts/
└── src/domain/media.ts               # Increase max limit to 1000 in MediaListQuerySchema

apps/web/
├── src/components/media/
│   ├── media-import-modal.tsx        # Align uploadUrl/storageKey/url, explicit cancel guard, failure logging
│   └── media-library-explorer.tsx    # Dropdown click & outside-click ref fix, toolbar hairline dividers
└── tests/
    └── ui/media-library-explorer.test.tsx # UI test coverage for fixes
```
