# Implementation Plan: Browser Tab Favicon & Platform Metadata Realignment

**Branch**: `fix/065-browser-tab-favicon-and-metadata` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/065-browser-tab-favicon-and-metadata/spec.md`

## Summary
Resolve missing browser tab icon in Google Chrome and Chromium-based browsers across all platform domains and workspace subdomains. Eliminate multi-tenant edge middleware interception for metadata icon routes (`/icon`, `/apple-icon`, `/favicon.ico`), generate and install a high-fidelity multi-resolution `favicon.ico` matching the official FBUploadPro brand geometry, explicitly declare `icons` in root layout metadata, and update the global application description to `"publishing automation platform"`.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19  
**Primary Dependencies**: Next.js 16, `@fbuploadpro/contracts`  
**Storage**: Static asset storage (`apps/web/src/app/`, `apps/web/public/`)  
**Testing**: Vitest 3.0.5 (`apps/web/tests/middleware/`, `apps/web/tests/unit/`)  
**Target Platform**: Modern Chromium (Chrome, Brave, Edge), WebKit (Safari), Gecko (Firefox)  
**Project Type**: Next.js Monorepo Web Application (`apps/web`)  
**Performance Goals**: Instant cached icon resolution (<5ms), zero unnecessary middleware cycles on icon queries  
**Constraints**: Zero regression to multi-tenant workspace isolation, zero mock theater, full TypeScript strict typing  

## Constitution Check

- [x] **Principle 1 — Spec-Driven Development**: Spec 065 created and planned before coding.
- [x] **Principle 5 — Multi-Tenant Subdomain Routing**: Edge routing rules maintain compound tenant isolation while strictly exempting public static metadata routes.
- [x] **Principle 27 — Strict Theme Token Authority**: Icon vector and binary colors strictly align with `PALETTE.primary` (`#fad734`), `PALETTE.accent1` (`#b29527`), and `PALETTE.accent2` (`#766018`).
- [x] **Principle 28 — Immutability of DESIGN.md**: No edits made to `DESIGN.md`.
- [x] **Universal Professional UX Writing**: Metadata description is concise, professional, and free of internal jargon.

## Project Structure

### Documentation (this feature)
```text
specs/065-browser-tab-favicon-and-metadata/
├── spec.md
├── plan.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code Impact
```text
apps/web/
├── public/
│   ├── favicon.ico                         # Root static fallback for browsers querying /favicon.ico
│   └── icon.svg                            # Root static fallback for /icon.svg
├── src/
│   ├── app/
│   │   ├── favicon.ico                     # Next.js App Router root favicon convention
│   │   ├── icon.svg                        # Canonical vector brand mark
│   │   └── layout.tsx                      # Metadata icons configuration & updated description
│   └── middleware.ts                       # Edge matcher & route exemption for metadata endpoints
└── tests/
    └── middleware/
        └── middleware-routing.test.ts      # Unit tests for metadata route bypass across subdomains
```

## Implementation Strategy

### 1. Edge Middleware Route & Matcher Exemption
In `apps/web/src/middleware.ts`:
- Update `config.matcher` to ignore metadata routes `/icon`, `/apple-icon`, `/favicon.ico`, and `*.ico` files.
- In `middleware()`, bypass tenant rewriting and auth redirects immediately if `pathname` is `/icon`, `/apple-icon`, or `/favicon.ico`.

### 2. High-Fidelity `favicon.ico` Generation
- Render the 4-path FBUploadPro brand geometry into standard multi-resolution `.ico` asset (16x16, 32x32, 48x48) with transparent background and rich gold colors.
- Place at both `apps/web/src/app/favicon.ico` (Next.js file convention) and `apps/web/public/favicon.ico` (root static asset).
- Copy `apps/web/src/app/icon.svg` to `apps/web/public/icon.svg`.

### 3. Root Layout Metadata Declaration
In `apps/web/src/app/layout.tsx`:
- Update description: `"publishing automation platform"`.
- Configure `icons`:
  ```typescript
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.svg',
  }
  ```

### 4. Verification & Automated Test Coverage
- Add tests in `apps/web/tests/middleware/middleware-routing.test.ts` verifying `/icon`, `/favicon.ico`, and `/apple-icon` are bypassed without rewriting on customer subdomains.
