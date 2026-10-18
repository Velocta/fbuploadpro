# Implementation Plan: Downloader Component & API Namespace Separation

**Feature Branch**: `feat/068-downloader-namespace-separation` | **Spec**: [spec.md](spec.md)

## Architecture & Namespace Mapping

```
apps/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── tenant/
│   │   │       └── [subdomain]/
│   │   │           ├── downloader/               <-- NEW primary API route
│   │   │           │   └── route.ts
│   │   │           └── media/
│   │   │               └── downloader/           <-- Legacy compatibility wrapper
│   │   │                   └── route.ts
│   │   └── tenant/
│   │       └── [subdomain]/
│   │           └── downloader/
│   │               └── page.tsx                  <-- Imports from components/downloader
│   └── components/
│       ├── downloader/                           <-- NEW dedicated component directory
│       │   └── media-downloader.tsx
│       └── media/
│           └── media-downloader.tsx              <-- Backward-compatibility re-export
└── tests/
    ├── api/
    │   └── media-downloader.test.ts              <-- Tests /downloader and legacy fallback
    └── ui/
        └── media-downloader.test.tsx             <-- Tests @/components/downloader
```

## Technical Decisions

1. **Clean Directory Isolation**:
   - `apps/web/src/components/downloader/` is established as a first-class directory alongside `components/media/`, `components/pages/`, `components/accounts/`, etc.
   - Downloader UI logic, modals, progress bars, and recent history lists live exclusively within `components/downloader/`.

2. **API Endpoint Migration**:
   - The primary route is moved to `/api/tenant/[subdomain]/downloader`.
   - The legacy `/api/tenant/[subdomain]/media/downloader` route is retained as a zero-overhead pass-through re-export (`export { GET, POST } from '../../downloader/route'`), guaranteeing zero downtime or breaking changes for any in-flight requests or external webhooks.

3. **Frontend Fetch Target**:
   - `apps/web/src/components/downloader/media-downloader.tsx` targets `/api/tenant/${subdomain}/downloader`.

4. **Backward-Compatibility Re-Export in `components/media/`**:
   - `apps/web/src/components/media/media-downloader.tsx` re-exports `MediaDownloader` from `@/components/downloader/media-downloader` with a deprecation notice, preventing breaking any legacy imports.
