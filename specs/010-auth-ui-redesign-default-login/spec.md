# Feature Specification: Professional Auth UI/UX Redesign & Default Login Page

**Feature Branch**: `feat/010-auth-ui-redesign-default-login`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User prompt: "using speckit remake the UI UX of login and signup page properly and professionally also make the default page login page remove the FBUploadPro placeholder landing page make default login page do all the steps properly and create a PR"

---

## 1. Executive Summary

This feature replaces the placeholder landing page card on root (`/`) with an automatic redirect to `/login`, and delivers a production-grade, professional split-screen UI/UX redesign for both the Login (`/login`) and Sign Up (`/signup`) portals.

The new authentication experience follows a split-screen layout:
- **Left Column (Brand Showcase)**: Deep pitch-black background with subtle radial glow, FBUploadPro typography with Gold accent, compelling product value proposition (automated Reels publishing, slot-based queueing, multi-profile management), and high-craft feature highlights.
- **Right Column (Focused Auth Card)**: Polished, accessible form built with Spec 008 UI primitives, incorporating interactive show/hide password eye toggles, clear validation errors via `Alert`, clean inputs, and quick switching between Login and Signup. As explicitly requested, the subdomain preview badge is removed from the signup form to maintain a clean, frictionless registration flow.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - Default Root Navigation to Login (Priority: P1) 🎯 MVP

When any visitor or operator navigates to the root URL (`/` or `app.fbuploadpro.com/`), they are immediately and seamlessly redirected to `/login`. The temporary placeholder landing card ("FBUploadPro: High-throughput Facebook publishing automation platform [Sign In] [Create Account]") is completely eliminated. If an authenticated user visits `/` or `/login`, the existing session middleware redirects them to their tenant dashboard (`{subdomain}.fbuploadpro.com/dashboard`).

**Why this priority**: Eliminates confusing temporary placeholder screens and establishes `/login` as the default front door of the web application.

**Independent Test**:
- Open the root URL `/` in a browser or test client.
- Assert that the response issues an immediate HTTP 307/308 redirect to `/login`.
- Verify that navigating to `/` does not render the deprecated placeholder landing card.

**Acceptance Scenarios**:
1. **Given** an unauthenticated visitor, **When** they navigate to `/`, **Then** the server redirects them to `/login`.
2. **Given** an unauthenticated visitor on `app.{rootDomain}/`, **When** they request `/`, **Then** middleware routes them directly to `/login`.
3. **Given** an authenticated user with an active session, **When** they request `/` or `/login`, **Then** middleware redirects them to their tenant workspace dashboard (`{subdomain}.{rootDomain}/dashboard`).

---

### User Story 2 - Professional Split-Screen Login Experience (Priority: P2)

When an existing operator visits `/login`, they encounter a high-craft split-screen layout:
- The left showcase column highlights FBUploadPro's mission, high-frequency publishing reliability, and key capabilities.
- The right column provides the focused Sign In form with Email Address, Password with an interactive show/hide eye toggle, clear "Sign In" primary action button with loading spinner, and a link to create an account.
- If credentials are invalid, an accessible error alert clearly explains the issue without technical jargon. If a `returnUrl` is present in the query parameters, it is preserved and honored upon successful authentication.

**Why this priority**: Core authentication portal where creators and operators log in daily. It must look trustworthy, professional, and responsive.

**Independent Test**:
- Render `/login` on desktop (1440px) and mobile (375px).
- Verify responsive layout (split-screen on desktop; clean stacked card with brand header on mobile).
- Toggle password visibility and verify eye icon state and input masking.
- Submit invalid credentials and verify `Alert` banner; submit valid credentials and verify redirection to `{subdomain}.{rootDomain}/dashboard`.

**Acceptance Scenarios**:
1. **Given** a visitor on `/login` at desktop width (>1024px), **When** the page renders, **Then** a split-screen presentation is shown with the brand showcase on the left and the sign-in form on the right.
2. **Given** a visitor on mobile (<768px), **When** the page renders, **Then** the layout gracefully collapses into a single-column view with a compact FBUploadPro header and full-width card.
3. **Given** the password field, **When** the user clicks the eye toggle button, **Then** the input flips between masked `type="password"` and readable `type="text"`, with proper `aria-label`.
4. **Given** an invalid login attempt, **When** `POST /api/auth/login` returns an error, **Then** the form displays a helpful `Alert` banner while retaining the entered email.
5. **Given** a valid login attempt with a query param `returnUrl`, **When** authentication succeeds, **Then** the browser is redirected to the authorized target.

---

### User Story 3 - Professional Split-Screen Sign Up Experience (Priority: P3)

When a prospective user visits `/signup`, they see the matching split-screen aesthetic:
- The left showcase column presents creator benefits (multi-profile management, direct R2 media uploads, automated first comments).
- The right column hosts the registration form collecting Full Name, Phone Number, Email Address, and Password with show/hide toggle.
- Per explicit user decision, the raw subdomain preview badge is removed from the form for maximum elegance.
- Upon successful submission, the account is created, the session cookie is issued, and the user is redirected into their new workspace dashboard.

**Why this priority**: Seamless user onboarding with unified brand aesthetics, eliminating clutter while preserving all required registration data fields.

**Independent Test**:
- Visit `/signup`.
- Verify the split-screen layout and that no subdomain preview box is displayed.
- Verify client validation for required fields, email format, and 8+ character password.
- Test successful registration redirecting to the tenant dashboard.

**Acceptance Scenarios**:
1. **Given** a visitor on `/signup`, **When** viewing the registration form, **Then** inputs for Full Name, Phone Number, Email Address, and Password are present, and the subdomain preview badge is absent.
2. **Given** the password field, **When** clicking the eye toggle, **Then** the password characters become visible or masked.
3. **Given** form validation failure (e.g. password < 8 characters), **When** attempting submission, **Then** an informative validation message is displayed.
4. **Given** successful registration, **When** `POST /api/auth/signup` completes, **Then** the user is redirected to `{subdomain}.{rootDomain}/dashboard`.
5. **Given** the "Already have an account?" footer, **When** clicked, **Then** the user navigates smoothly to `/login`.

---

## 3. Design & Anti-Slop Specifications

### Taste Skill Dials
- **Design Variance**: `4 / 10` (Structured, elegant, authoritative B2B SaaS).
- **Motion Intensity**: `3 / 10` (Subtle 150–200ms ease-out transitions for buttons, inputs, and toggles; zero dizzying animations).
- **Visual Density**: `5 / 10` (Generous spacing, crisp 1px borders, high readability).

### Palette & Tokens (`apps/web/src/lib/theme.ts`)
- **Canvas / Surfaces**: Pitch Black `#000000` / Card surface `var(--bg-surface, #0b0e14)` / Subtle border `var(--border-subtle, #1f242d)`.
- **Brand Accents**: Primary Gold `#fad734` for focus rings, brand mark highlights, and primary action buttons.
- **Typography**: Inter / system-ui, high contrast headings, muted secondary labels (`#9ca3af`).
- **Icons**: Clean inline SVGs for password eye (Show / Hide), checkmarks for feature list, and brand mark.
- **Compliance**: Zero hardcoded ad-hoc hex values outside token references; zero capsule pill badges; zero fake status indicators.

---

## 4. Requirements & Non-Functional Constraints

- **Accessibility**: WCAG 2.1 AA compliant. Minimum 44x44px touch targets on mobile, full keyboard navigation (Tab / Enter / Space), proper `aria-label` attributes on password toggles.
- **Responsive Breakpoints**:
  - Desktop (>1024px): 2-column split (Showcase ~48%, Form ~52%).
  - Tablet (768px - 1024px): Stacked or condensed split.
  - Mobile (<768px): Single column, compact brand header, edge-to-edge padding (16px).
- **Zero Regressions**: Existing auth APIs (`/api/auth/login`, `/api/auth/signup`), session cookies, and subdomain tenant redirects remain 100% functional and compatible.
