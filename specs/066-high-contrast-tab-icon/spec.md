# Feature Specification: High-Contrast Browser Tab Icon & Cache Busting

**Feature Branch**: `fix/066-high-contrast-tab-icon`
**Created**: 2026-10-17
**Status**: Draft
**Input**: User request: "yes" (after diagnosing why Chrome loads /favicon.ico directly but fails to display icon on /login and other HTML pages)

---

## 1. Executive Summary
This specification defines the implementation of a high-contrast dark squircle container tile for the official FBUploadPro browser tab icon (`icon.svg` and `favicon.ico`) and active cache-busting metadata configuration (`?v=2`) in `apps/web/src/app/layout.tsx`. By encasing the gold FBUploadPro vector mark within the canonical dark tile (`#0c0d10` fill with `#2b323c` hairline border), the icon achieves high visual contrast (>18:1) across white, light-gray, and dark browser tabs, while cache-busting parameters force Chrome's internal SQLite database to invalidate legacy blank/404 records on `/login` and tenant workspace routes.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - High-Contrast Universal Browser Tab Icon (Priority: P1)
**As a** customer visiting `https://app.fbuploadpro.com/login` or my workspace dashboard in Google Chrome (light or dark mode),  
**I want** the FBUploadPro gold logo clearly and crisply visible in my browser tab,  
**So that** I can instantly identify the tab regardless of my browser's theme or operating system window styling.

**Why this priority**: A transparent yellow icon on white/light tabs has a contrast ratio of only 1.27:1 and appears completely invisible. Housing it in the dark brand tile guarantees immediate legibility on all tab backgrounds.

**Independent Test**: Can be verified by viewing the browser tab in Google Chrome in both standard Light Mode and Dark Mode; the dark squircle tile and gold ascending upload vector must be unmistakably visible in the tab strip.

**Acceptance Scenarios**:
1. **Given** a user viewing an HTML page on `app.fbuploadpro.com` or any workspace subdomain, **When** the page loads in a light-mode Chrome window, **Then** the dark tile with the gold mark is prominently visible with high contrast.
2. **Given** a user viewing in dark mode, **When** the page loads, **Then** the subtle hairline border frames the dark tile cleanly against dark tab strips.

---

### User Story 2 - Automated Chrome Favicon Cache Busting (Priority: P1)
**As an** existing user whose browser previously cached a blank icon or 404 for `/login`,  
**I want** the application metadata to supply a cache-busted icon URL (e.g. `?v=2`),  
**So that** Chrome is compelled to download and display the new high-contrast icon without requiring manual browser cache deletion.

**Why this priority**: Chrome's internal SQLite `Favicons` file stubbornly retains failed/blank states for HTML URLs unless the icon resource URL changes.

**Independent Test**: Can be verified by inspecting the HTML response of `GET /login` and confirming `<link rel="icon">` references the versioned resource (`?v=2`).

**Acceptance Scenarios**:
1. **Given** any request to root or tenant pages, **When** inspecting the generated `<head>`, **Then** `icon` and `shortcut` links contain the `?v=2` cache-busting query parameter.

---

## 3. Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: `apps/web/src/app/icon.svg` and `apps/web/public/icon.svg` MUST include a 64x64 squircle background container (`<rect width="64" height="64" rx="14" fill="#0c0d10" stroke="#2b323c" stroke-width="1.5"/>`) behind the official gold geometry.
- **FR-002**: `apps/web/src/app/favicon.ico` and `apps/web/public/favicon.ico` MUST be regenerated to include the dark squircle container across all embedded resolutions (16x16, 32x32, 48x48).
- **FR-003**: `apps/web/src/app/layout.tsx` metadata MUST configure cache-busted URLs (`/icon.svg?v=2` and `/favicon.ico?v=2`) for both `icon` and `shortcut` fields.
- **FR-004**: Edge middleware (`apps/web/src/middleware.ts`) MUST continue to exempt all query string variants of `/icon`, `/apple-icon`, and `/favicon.ico`.

---

## 4. Key Entities
- **Brand Squircle Tile**: The 64x64 rounded rectangle (`rx=14`) filled with `#0c0d10` (dark panel) and stroked with `#2b323c` (hairline border).
- **Cache-Busted Icon Metadata**: The Next.js `Metadata.icons` configuration referencing versioned query parameters (`?v=2`).

---

## 5. Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: The FBUploadPro logo is prominently visible in Chrome tabs on white/light backgrounds (contrast ratio > 18:1).
- **SC-002**: Visiting `https://app.fbuploadpro.com/login` loads and displays the tab icon on fresh and existing browser sessions.
- **SC-003**: 100% of automated tests pass without errors or regressions.
