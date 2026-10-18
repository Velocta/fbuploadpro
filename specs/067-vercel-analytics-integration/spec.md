# Feature Specification: Vercel Web Analytics Integration

**Feature Branch**: `feat/067-vercel-analytics-integration`
**Created**: 2026-10-18
**Status**: Draft
**Input**: User request: "now add vercel analytics to web 1 Install our package npm i @vercel/analytics 2 Add the React component import { Analytics } from \"@vercel/analytics/next\""

---

## 1. Executive Summary
This specification defines the integration of Vercel Web Analytics into the FBUploadPro web application (`apps/web`). By adding `@vercel/analytics` and injecting the `<Analytics />` component from `@vercel/analytics/next` into the root application layout (`apps/web/src/app/layout.tsx`), the application collects privacy-friendly web vitals, visitor metrics, and page view insights automatically in production environments while maintaining zero performance overhead, strict React 19 / Next.js 16 App Router compatibility, and complete SSR/hydration purity.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - Production Web Traffic & Core Web Vitals Tracking (Priority: P1)
**As a** platform administrator and product owner,  
**I want** real-time privacy-compliant visitor and performance telemetry collected across all routes of the FBUploadPro web application,  
**So that** I can monitor traffic trends, page views, and Core Web Vitals on the Vercel Analytics dashboard.

**Why this priority**: Production traffic visibility and performance monitoring are essential for understanding user adoption, tracking page engagement across public and authenticated routes, and catching performance regressions.

**Independent Test**: Can be verified by rendering the root layout in Next.js and verifying the `<Analytics />` component script tag or component tree is cleanly injected into the document body without console errors or hydration mismatches.

**Acceptance Scenarios**:
1. **Given** a user navigating to any page (marketing landing, authentication, or workspace dashboard), **When** the page renders via `RootLayout`, **Then** the Vercel Analytics component is mounted in the document tree.
2. **Given** production deployment on Vercel, **When** user sessions occur, **Then** page visits and Web Vitals metrics are emitted to Vercel Analytics.

---

### User Story 2 - React 19 & Next.js 16 App Router Compliance (Priority: P1)
**As a** frontend engineer,  
**I want** the analytics integration to strictly use `@vercel/analytics/next` within the Server Component root layout,  
**So that** it adheres to Next.js 16 App Router conventions and React 19 standards with zero hydration mismatches, zero `useEffect` state leaks, and zero blocking of initial page rendering.

**Why this priority**: Avoids client-side rendering bottlenecks or hydration bailouts that could degrade the application's performance score or interfere with existing root layout scripts.

**Independent Test**: Run unit/UI tests verifying that `RootLayout` mounts children and includes `<Analytics />` without throwing errors or breaking desktop title bar / support button positioning.

**Acceptance Scenarios**:
1. **Given** the root layout (`apps/web/src/app/layout.tsx`), **When** rendered, **Then** `<Analytics />` from `@vercel/analytics/next` is positioned inside `<body>` alongside `<DesktopTitleBar />`, `<main>{children}</main>`, and `<WhatsAppSupportButton />`.
2. **Given** local development or testing environments, **When** analytics is executed, **Then** it operates without crashing or emitting mock/runtime warnings.

---

## 3. Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: `@vercel/analytics` MUST be installed as a production dependency in `apps/web/package.json`.
- **FR-002**: The root application layout (`apps/web/src/app/layout.tsx`) MUST import `{ Analytics }` from `@vercel/analytics/next`.
- **FR-003**: The root application layout MUST render `<Analytics />` within the `<body>` element.
- **FR-004**: Existing layout components (`DesktopTitleBar`, `<main>{children}</main>`, `WhatsAppSupportButton`, and `themeInitScript`) MUST remain fully functional and uncompromised.
- **FR-005**: All automated test suites for root layout and UI components MUST pass cleanly.

---

## 4. Key Entities
- **Root Layout (`apps/web/src/app/layout.tsx`)**: The root layout for all App Router pages in the web application.
- **Vercel Analytics Component (`@vercel/analytics/next`)**: The specialized Next.js App Router component that injects the lightweight analytics script and event handlers.
- **Package Configuration (`apps/web/package.json`)**: Package manifest registering `@vercel/analytics`.

---

## 5. Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: `@vercel/analytics` is present in `apps/web/package.json` dependencies and resolved via monorepo lockfile (`pnpm-lock.yaml`).
- **SC-002**: `<Analytics />` from `@vercel/analytics/next` is present and active inside `apps/web/src/app/layout.tsx`.
- **SC-003**: Root layout unit tests verify the presence and execution of `<Analytics />`.
- **SC-004**: Zero hydration warnings, zero React 19 deprecations, and zero impact on client startup time.

---

## 6. Assumptions
- Vercel Web Analytics is enabled on the Vercel project dashboard, requiring only package installation and component inclusion in the code.
- In non-Vercel environments (e.g. local development or Vitest test runner), `@vercel/analytics/next` safely no-ops or provides a inert stub.
