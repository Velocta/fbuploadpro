# Feature Specification: Downloader Component & API Namespace Separation

**Feature Branch**: `feat/068-downloader-namespace-separation`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User directive: "move it to downloader instead of media". User confirmed via Pre-Flight Alignment: "(Recommended) Move both the UI component to components/downloader/ and the backend API route to /api/tenant/[subdomain]/downloader (full separation)".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dedicated Downloader Component Namespace (Priority: P1)

As a frontend developer and platform maintainer, I want the Downloader UI components to reside cleanly in their own dedicated namespace (`apps/web/src/components/downloader/`) rather than inside `apps/web/src/components/media/`, so that Media Library and Downloader maintain strict architectural isolation and zero code coupling.

**Why this priority**: Placing Downloader files inside the Media Library component directory violates separation of concerns. Relocating them provides a clean, maintainable directory structure mirroring the top-level route `/tenant/[subdomain]/downloader`.

**Independent Test**: Navigate to `/tenant/[subdomain]/downloader` in the workspace. Verify the Downloader UI renders identically from `@/components/downloader/media-downloader` with all batch downloading, folder selection, deduplication, and recent download history features working seamlessly.

**Acceptance Scenarios**:
1. **Given** the Downloader page (`apps/web/src/app/tenant/[subdomain]/downloader/page.tsx`), **When** loaded, **Then** it imports and renders `MediaDownloader` from `@/components/downloader/media-downloader`.
2. **Given** `apps/web/src/components/downloader/media-downloader.tsx`, **When** inspected, **Then** it houses the complete Downloader UI, batch progress, and recent list components.
3. **Given** `apps/web/src/components/media/`, **When** scanned, **Then** zero Downloader UI components or Downloader-specific types reside in the `media` folder (or only clean backward-compatibility re-exports exist).

---

### User Story 2 - Dedicated Downloader Backend API Namespace & Backward Compatibility (Priority: P1)

As a platform engineer and API consumer, I want the Downloader backend endpoints to reside at `/api/tenant/[subdomain]/downloader` rather than nested under `/api/tenant/[subdomain]/media/downloader`, while preserving backward-compatible routing for legacy callers.

**Why this priority**: Downloader has its own top-level routing, extraction pipeline, and background queue integration. Moving the API route aligns the URL taxonomy (`/downloader` -> `/api/.../downloader`) and removes all remnants of Downloader from the `/media` API tree.

**Independent Test**: Issue a `POST /api/tenant/[subdomain]/downloader` request with valid URLs. Verify that the batch download executes and returns the correct response. Issue a request to the legacy `/api/tenant/[subdomain]/media/downloader` endpoint and verify it seamlessly delegates or redirects with 100% fidelity.

**Acceptance Scenarios**:
1. **Given** `apps/web/src/app/api/tenant/[subdomain]/downloader/route.ts`, **When** a `POST` or `GET` request is received, **Then** it handles hybrid URL extraction, direct R2 ingestion, and job status polling.
2. **Given** `apps/web/src/components/downloader/media-downloader.tsx`, **When** initiating a batch download or polling job progress, **Then** it requests `/api/tenant/${subdomain}/downloader`.
3. **Given** any legacy request to `/api/tenant/${subdomain}/media/downloader`, **When** invoked, **Then** it seamlessly re-exports or proxies to `/api/tenant/${subdomain}/downloader` without breaking external clients or Cloudflare Worker webhooks.

---

### User Story 3 - Full Test Suite & Contract Alignment (Priority: P2)

As a test engineer, I want the automated unit, API, and UI test suites to test the new `components/downloader/` and `api/.../downloader` locations directly, ensuring regression prevention and 100% test passing across the monorepo.

**Why this priority**: Maintaining test coverage prevents regression during structural refactors.

**Independent Test**: Run automated test suites against `apps/web/tests/ui/media-downloader.test.tsx` and `apps/web/tests/api/media-downloader.test.ts`. Verify 100% pass rate.

**Acceptance Scenarios**:
1. **Given** `apps/web/tests/ui/media-downloader.test.tsx`, **When** executed, **Then** it imports from `@/components/downloader/media-downloader` and tests mock requests against `/api/tenant/[subdomain]/downloader`.
2. **Given** `apps/web/tests/api/media-downloader.test.ts`, **When** executed, **Then** it verifies requests against `/api/tenant/[subdomain]/downloader` and validates legacy compatibility.

---

## Edge Cases

- **Existing Client / Browser In-Flight Requests**: Any browser sessions with open tabs polling the old `/api/tenant/[subdomain]/media/downloader` route must continue to receive valid responses via the compatibility proxy/re-export.
- **Worker Job Completion Callbacks**: If the Cloudflare Worker or external services reference the downloader endpoint, the backward-compatibility route ensures zero dropped webhook notifications.
- **Folder Ingestion Target**: Moving the Downloader namespace does NOT alter the destination storage—downloads still default to the user's `Downloads` folder in `media_folders` and persist records into `media_items`.

## Requirements Checklist

- [ ] `apps/web/src/components/downloader/media-downloader.tsx` created with full Downloader implementation.
- [ ] `apps/web/src/app/tenant/[subdomain]/downloader/page.tsx` updated to import from `@/components/downloader/media-downloader`.
- [ ] `apps/web/src/app/api/tenant/[subdomain]/downloader/route.ts` created as primary API route.
- [ ] `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts` converted into a backward-compatibility proxy/re-export.
- [ ] `apps/web/tests/ui/media-downloader.test.tsx` and `apps/web/tests/api/media-downloader.test.ts` updated to reference new paths.
- [ ] Documentation and Constitution synchronized.
