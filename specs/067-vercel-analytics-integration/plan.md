# Implementation Plan: Vercel Web Analytics Integration

**Branch**: `feat/067-vercel-analytics-integration` | **Date**: 2026-10-18 | **Spec**: [specs/067-vercel-analytics-integration/spec.md](specs/067-vercel-analytics-integration/spec.md)

**Input**: Feature specification from `specs/067-vercel-analytics-integration/spec.md`

## Summary

Integrate `@vercel/analytics` into the Next.js 16 App Router application (`apps/web`). The package provides the official `<Analytics />` component (`@vercel/analytics/next`) designed specifically for Next.js App Router Server Component root layouts. When mounted inside `<body>` of `apps/web/src/app/layout.tsx`, it injects the lightweight client analytics script automatically in Vercel production deployments with zero impact on TTFB, SSR, or client bundle performance.

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 22 / React 19 / Next.js 16 (App Router)  
**Primary Dependencies**: `@vercel/analytics` (added to `apps/web/package.json`)  
**Storage**: N/A (hosted telemetry sent directly to Vercel infrastructure)  
**Testing**: Vitest (`apps/web/tests/ui/root-layout-analytics.test.tsx`)  
**Target Platform**: Vercel Edge / Serverless Web Application  
**Project Type**: Next.js Web App (`apps/web`)  
**Performance Goals**: < 1KB script execution overhead; zero blocking time on critical path  
**Constraints**: Zero hydration mismatches; clean rendering within App Router root layout; compliance with React 19 standards  
**Scale/Scope**: 1 package addition, 1 layout modification, 1 unit test suite, docs synchronization

## Constitution Check

- **Monorepo Dependency Hygiene**: `@vercel/analytics` is installed specifically in `apps/web` via `pnpm --filter @fbuploadpro/web add @vercel/analytics`.
- **Theme & Anti-Slop Compliance**: No styling or visual UI changes are introduced. Analytics runs purely as an ambient telemetry component.
- **Zero Raw Secret / Leak Exemption**: Vercel Analytics requires no client-side secret keys; it leverages Vercel's ambient deployment environment variables.
- **Single Agent & Atomic PR Standard**: All spec artifacts, package manifest updates, layout changes, unit tests, and documentation are committed atomically in a single PR.

## Project Structure

### Documentation (this feature)

```text
specs/067-vercel-analytics-integration/
├── spec.md
├── plan.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code Modifications

```text
apps/web/
├── package.json                          # Add @vercel/analytics dependency
├── src/app/layout.tsx                    # Import and render <Analytics /> from @vercel/analytics/next
└── tests/ui/root-layout-analytics.test.tsx # Unit test for root layout analytics mounting
docs/
└── foundational-knowledge.md             # Record Vercel Analytics integration
```

## Architecture & Implementation Steps

1. **Dependency Installation**:
   Add `@vercel/analytics` to `apps/web/package.json` using pnpm.
2. **Layout Integration**:
   Import `Analytics` from `@vercel/analytics/next` in `apps/web/src/app/layout.tsx`.
   Render `<Analytics />` in `RootLayout` inside `<body>`.
3. **Automated Testing**:
   Create a unit test in `apps/web/tests/ui/root-layout-analytics.test.tsx` verifying that `RootLayout` renders the `<Analytics />` component without error.
4. **Documentation Sync**:
   Update `docs/foundational-knowledge.md` to document the analytics setup under the web app technical stack.
