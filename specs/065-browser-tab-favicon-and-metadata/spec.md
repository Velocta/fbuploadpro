# Feature Specification: Browser Tab Favicon & Platform Metadata Realignment

**Feature Branch**: `fix/065-browser-tab-favicon-and-metadata`
**Created**: 2026-10-17
**Status**: Draft
**Input**: User request: "yes do it and make the description publishing automation platform"

---

## 1. Executive Summary
This specification defines the remediation for the missing browser tab logo mark in Google Chrome and Chromium browsers when accessing FBUploadPro across apex, central gateway (`app.fbuploadpro.com`), and tenant workspace subdomains (`[subdomain].fbuploadpro.com`). It establishes a comprehensive metadata asset delivery pipeline, configures explicit metadata tags and fallback icons (`icon.svg`, `favicon.ico`), eliminates multi-tenant middleware routing interception for icon endpoints, and realigns the global application description to `"publishing automation platform"`.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Tenant Browser Tab Icon Display (Priority: P1)
**As a** customer accessing my workspace dashboard on a dedicated subdomain (e.g. `acme.fbuploadpro.com`),  
**I want** the official FBUploadPro gold icon clearly displayed in my Chrome browser tab,  
**So that** I can immediately visually identify and differentiate my active publishing workspace from other browser tabs.

**Why this priority**: Brand presence and visual identification in browser tabs is essential for usability, professionalism, and user confidence in an enterprise SaaS application.

**Independent Test**: Can be verified by opening a workspace subdomain route in Google Chrome (both standard and Incognito sessions) and confirming the tab displays the gold logo mark without 404 or 307 errors in the Network inspector.

**Acceptance Scenarios**:
1. **Given** an unauthenticated or authenticated user navigating to any tenant subdomain (`[subdomain].rootDomain`), **When** the browser tab loads, **Then** the official FBUploadPro brand icon is displayed in the tab strip.
2. **Given** a browser requesting `/icon` or `/favicon.ico` on any subdomain, **When** the edge middleware processes the request, **Then** the request is bypassed directly to static asset handlers without being rewritten to `/tenant/[subdomain]/icon` or redirected to `/login`.

---

### User Story 2 - Universal Browser Icon Compatibility & Fallbacks (Priority: P1)
**As a** user using various desktop browsers (Chrome, Edge, Brave, Safari, Firefox),  
**I want** both modern scalable vector icons (`icon.svg`) and classic icon fallbacks (`favicon.ico`) provided,  
**So that** the browser tab logo renders reliably regardless of browser engine caching behaviors or fallback conventions.

**Why this priority**: Different browsers handle SVG tab icons differently; Chrome specifically queries `/favicon.ico` in the background and defaults to blank if absent or failing.

**Independent Test**: Can be tested by directly requesting `GET /favicon.ico` and `GET /icon.svg` and receiving valid 200 HTTP responses with valid image MIME types (`image/x-icon` and `image/svg+xml`).

**Acceptance Scenarios**:
1. **Given** a browser requesting `/favicon.ico`, **When** the server handles the request, **Then** it returns the official 16x16 / 32x32 multi-resolution brand icon with HTTP 200.
2. **Given** modern browsers supporting SVG favicons, **When** rendering `<link rel="icon">`, **Then** the crisp vector SVG asset is served with proper content headers.

---

### User Story 3 - Public Platform Description Realignment (Priority: P2)
**As an** end-user, developer, or search engine inspecting page metadata,  
**I want** the root platform description concisely set to `"publishing automation platform"`,  
**So that** page headers and search snippets reflect the precise, professional product scope.

**Why this priority**: Aligns metadata with the user's explicit directive and UX writing standards (concise, clear, non-jargon).

**Independent Test**: Can be tested by inspecting the HTML `<meta name="description">` tag in page headers and verifying it equals `"publishing automation platform"`.

**Acceptance Scenarios**:
1. **Given** any page rendered by the root layout, **When** inspecting the document `<head>`, **Then** `<meta name="description" content="publishing automation platform">` is present.

---

### Edge Cases
- **Unauthenticated Subdomain Visits**: The edge middleware normally redirects unauthenticated requests on tenant subdomains to `/login`. Icon and metadata requests must bypass this check so browsers can load tab icons before or during login.
- **Chrome Internal Favicon Cache**: Chrome caches 404 responses for favicons in its local SQLite profile. Instructions and standard caching headers must ensure updated assets propagate cleanly.
- **Static Asset MIME Types**: The `.ico` file must be served with standard MIME type `image/x-icon` or `image/vnd.microsoft.icon` and `.svg` with `image/svg+xml`.

---

## 3. Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: Edge middleware (`apps/web/src/middleware.ts`) MUST exempt metadata icon endpoints (`/icon`, `/apple-icon`, `/favicon.ico`) from tenant rewriting and session authentication guards.
- **FR-002**: Edge middleware `matcher` configuration MUST bypass `/icon`, `/apple-icon`, `/favicon.ico`, and `*.ico` files so requests route directly to Next.js asset handlers.
- **FR-003**: The web application MUST include a valid, canonical `favicon.ico` in `apps/web/src/app/favicon.ico` representing the official gold FBUploadPro brand geometry.
- **FR-004**: Root layout metadata (`apps/web/src/app/layout.tsx`) MUST explicitly define `icons` linking both SVG vector icon and ICO fallback.
- **FR-005**: Root layout metadata (`apps/web/src/app/layout.tsx`) MUST update `description` to `"publishing automation platform"`.
- **FR-006**: Existing multi-tenant routing, authentication gates, and workspace security MUST remain 100% intact and unaffected.

---

## 4. Key Entities
- **Root Layout Metadata**: The Next.js `Metadata` configuration defined in `apps/web/src/app/layout.tsx` specifying `title`, `description`, and `icons`.
- **Edge Routing Matcher**: The regular expression filter in `apps/web/src/middleware.ts` governing which HTTP requests execute tenant authentication and rewrite logic.
- **Brand Assets**: The canonical vector SVG icon (`app/icon.svg`) and binary icon file (`app/favicon.ico`).

---

## 5. Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: Google Chrome and Chromium browsers display the official gold logo in the browser tab on root (`/`), auth (`/login`, `/signup`), and workspace routes (`/tenant/[subdomain]/*` or `[subdomain].fbuploadpro.com`).
- **SC-002**: 100% of HTTP requests to `/icon`, `/apple-icon`, and `/favicon.ico` on customer workspace subdomains return HTTP 200 without 307 redirects or 404 rewrites.
- **SC-003**: Document `<meta name="description">` accurately contains `"publishing automation platform"`.
- **SC-004**: All existing middleware routing, tenant isolation, and UI tests pass with 100% success.

---

## 6. Assumptions
- The official 4-path SVG geometry defined in `apps/web/src/app/icon.svg` is the canonical brand mark and can be accurately rendered into a multi-resolution `.ico` file for compatibility.
- Chrome's tab icon will immediately reflect upon code deployment and hard refresh / cache clearance.
