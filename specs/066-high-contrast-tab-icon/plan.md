# Implementation Plan: High-Contrast Browser Tab Icon & Cache Busting

**Branch**: `fix/066-high-contrast-tab-icon` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/066-high-contrast-tab-icon/spec.md`

## Summary
Add the official dark container tile (`#0c0d10` fill with `#2b323c` hairline border) to `apps/web/src/app/icon.svg`, `apps/web/public/icon.svg`, and regenerate multi-resolution `favicon.ico` in `apps/web/src/app/` and `apps/web/public/`. Configure cache-busted icon URLs (`/icon.svg?v=2` and `/favicon.ico?v=2`) in `apps/web/src/app/layout.tsx` metadata to force Chrome's internal SQLite database to invalidate legacy blank/404 records.

## Technical Context
**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19  
**Primary Dependencies**: Next.js 16, Pillow (for ICO generation)  
**Storage**: Static asset files in `apps/web/src/app/` and `apps/web/public/`  
**Target Platform**: Google Chrome / Chromium-based browsers, WebKit, Gecko  
**Performance Goals**: Instant cached icon display, >18:1 contrast on light tab strips  

## Constitution Check
- [x] **Principle 1 — Spec-Driven Development**: Spec 066 created and planned prior to execution.
- [x] **Principle 27 — Strict Theme Token Authority**: Background tile uses `SURFACES.panel` (`#0c0d10`) and hairline border uses `BORDERS.hairline` (`#2b323c`), exactly matching `BrandMark` dark container specification in `DESIGN.md` Section 7 and Spec 054.
- [x] **Principle 28 — Immutability of DESIGN.md**: No edits made to `DESIGN.md`.

## Project Structure

### Documentation
```text
specs/066-high-contrast-tab-icon/
├── spec.md
├── plan.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Files Impacted
```text
apps/web/
├── public/
│   ├── favicon.ico                         # High-contrast multi-resolution ICO with dark squircle
│   └── icon.svg                            # High-contrast vector SVG with dark squircle
├── src/
│   ├── app/
│   │   ├── favicon.ico                     # High-contrast multi-resolution ICO with dark squircle
│   │   ├── icon.svg                        # High-contrast vector SVG with dark squircle
│   │   └── layout.tsx                      # Cache-busted metadata icons configuration (?v=2)
└── tests/
    └── ui/
        └── brand-logo.test.tsx             # Unit tests verifying brand asset presence and geometry
```
