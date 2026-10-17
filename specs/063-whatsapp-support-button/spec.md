# Feature Specification: WhatsApp Support Button

**Feature Branch**: `feat/063-whatsapp-support-button`  
**Created**: 2026-10-17  
**Status**: Draft  
**Input**: User request: "i want to add a whatsapp support button on the right bottom what should be visible on every page how should we do it"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Global Floating WhatsApp Button Access (Priority: P1)

As any user browsing FBUploadPro (whether on public auth pages or within a private tenant workspace), I want a persistent, unobtrusive WhatsApp support button in the bottom-right corner of my screen so that I can reach out to customer support at any moment with a single click.

**Why this priority**:
Customer support availability is vital for user trust, onboarding friction reduction, and rapid issue resolution across all screens of the platform.

**Independent Test**:
Can be fully tested by loading any route in the application (`/login`, `/signup`, `/tenant/[subdomain]`, etc.), verifying that the WhatsApp button is rendered in the bottom-right corner, and verifying that clicking it opens WhatsApp (`wa.me`) in a new tab with the pre-filled support message.

**Acceptance Scenarios**:
1. **Given** any page in the application (gateway or tenant workspace), **When** the page renders, **Then** the WhatsApp support button is visible at the bottom-right of the viewport with a high-contrast icon and accessible tooltip/label.
2. **Given** the floating button is rendered, **When** the user hovers or focuses with keyboard, **Then** a smooth elevation and tooltip "Chat on WhatsApp" is displayed.
3. **Given** the button is clicked, **When** the link activates, **Then** a new browser tab opens navigating to `https://wa.me/<sanitized_number>?text=<encoded_message>` with `rel="noopener noreferrer"`.

---

### User Story 2 - Environment Variable Configuration & Fallback Resilience (Priority: P2)

As a DevOps engineer or platform administrator, I want to configure the WhatsApp support phone number and default message via environment variables (`NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` and `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE`) so that the support channel can be updated or customized per environment without code changes.

**Why this priority**:
Ensures deployment flexibility across staging, demo (`vinsmokemedia.online`), and production environments without hardcoding phone numbers in source control.

**Independent Test**:
Can be tested by setting different values for `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` in `.env.example` and unit testing the link generator function with various phone number formats (with `+`, spaces, dashes, or digits only) and verifying sanitization to E.164 digits.

**Acceptance Scenarios**:
1. **Given** `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` is set to `+1 (555) 123-4567`, **When** the component renders, **Then** the link targets `https://wa.me/15551234567` with all non-numeric characters stripped.
2. **Given** `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE` is configured, **When** the link is clicked, **Then** the message is URL-encoded into the `?text=` query parameter.
3. **Given** no environment variable is provided, **When** the component evaluates configuration, **Then** it cleanly renders nothing (`null`), ensuring zero broken or dummy links are displayed.

---

### User Story 3 - Responsive Viewport & Non-Obtrusive Layout Behavior (Priority: P3)

As a user on a mobile device or small viewport, I want the floating button to remain positioned cleanly without obscuring primary mobile interface elements (like sidebar triggers, bottom navigation, or modal footers).

**Why this priority**:
Prevents accidental taps and layout overlapping on small screens and narrow responsive viewports.

**Independent Test**:
Resize the browser viewport to 375px width (mobile) and verify the WhatsApp button maintains adequate clearance (`bottom: 16px`, `right: 16px` on mobile, `bottom: 24px`, `right: 24px` on desktop) and appropriate `z-index` layering below active full-screen modal overlays.

**Acceptance Scenarios**:
1. **Given** a mobile viewport (<640px), **When** the button is rendered, **Then** it adjusts spacing to `16px` offset from viewport bounds.
2. **Given** a dialog modal is opened, **When** the modal backdrop renders at high z-index (e.g. z-50/z-100), **Then** modal content takes precedence and does not get obstructed.

---

## Edge Cases

- **Malformed Phone Number**: If an admin sets an invalid string (e.g. letters or empty string), sanitization extracts only digits; if no digits exist, the button either logs a warning and hides or uses a safe fallback.
- **Special Characters in Message**: Default message containing emojis, quotes, or newlines must be safely encoded via `encodeURIComponent` without breaking the URL.
- **Desktop vs Mobile Browser**: `https://wa.me/` protocol works universally across desktop (WhatsApp Web / desktop client) and mobile (direct WhatsApp app deep-link).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a floating WhatsApp support action button fixed to the bottom-right corner of every page via `apps/web/src/app/layout.tsx`.
- **FR-002**: System MUST read the support recipient phone number from `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` and clean non-digit characters to produce a valid `wa.me/<number>` target.
- **FR-003**: System MUST support an optional pre-filled message configured via `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE` (with a sensible default: "Hi! I need assistance with my FBUploadPro account.").
- **FR-004**: System MUST open the target in a new window/tab using `target="_blank"` and `rel="noopener noreferrer"`.
- **FR-005**: System MUST include accessible labeling (`aria-label="Contact WhatsApp Support"`) and optical hover tooltip or title.
- **FR-006**: System MUST respect design system standards from `apps/web/src/lib/theme.ts`, maintaining clean typography, focus outlines, and crisp vector iconography.
- **FR-007**: System MUST provide documentation in `apps/web/.env.example` explaining `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` and `NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: WhatsApp support button is present and clickable on 100% of routes in `apps/web`.
- **SC-002**: Clicking the button navigates to `https://wa.me/<cleaned_digits>?text=...` in a new tab without JavaScript errors.
- **SC-003**: Zero layout disruption or overlap with existing layout headers, sidebars, or modals.
- **SC-004**: Unit and component tests pass with 100% coverage on URL formatting, sanitization, and rendering.
