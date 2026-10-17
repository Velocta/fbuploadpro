# Feature Specification: Spec 064 - Default Auth Showcase Panel Standardization

## 1. Executive Summary
Following the redesign of the right-side showcase panel on the login page (Spec 061), this specification standardizes the new multi-platform cloud publishing showcase panel as the global default across all authentication surfaces (`/login`, `/signup`, `/forgot-password`, `/reset-password`). 

All legacy Meta-exclusive value pillars (`VALUE_PILLARS`), obsolete headline copy, and unused icon components (`ShieldCheckIcon`, `CloudIcon`, `CommentIcon`) are permanently purged from `apps/web/src/components/auth/auth-split-layout.tsx`.

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Canonical Default Showcase Across All Auth Pages
**As a** new or returning creator navigating to `/signup`, `/forgot-password`, or `/reset-password`,  
**I want** to see the same modern, minimal, multi-platform showcase panel as `/login`,  
**So that** brand messaging and platform capabilities (Facebook, Instagram, TikTok, YouTube, Threads, and X) are unified across every authentication screen.

- **Acceptance Criteria 1.1**: `AuthSplitLayout` defaults to `AuthShowcasePanel` whenever the `showcase` prop is omitted or undefined.
- **Acceptance Criteria 1.2**: Visiting `/signup`, `/forgot-password`, and `/reset-password` renders the new showcase panel featuring:
  - Brand row with `BrandMark` and tagline `"Content automation for creators"`
  - Unboxed eyebrow label `"CREATE · SCHEDULE · GROW"`
  - Three-line headline `"Your pages,\nposting themselves —\n100% on the cloud."`
  - Subtext detailing multi-platform cloud publishing
  - Three hairline-divided feature rows (Clock, 2x2 Grid, Padlock)
  - Platform line (`Facebook · Instagram · TikTok · YouTube · Threads · X`)
  - Trust footer (`Official platform logins · Encrypted end-to-end`)
- **Acceptance Criteria 1.3**: Zero layout shift, zero console errors, and clean responsive mobile display (showcase panel hidden on viewports <1024px with mobile brand header rendered cleanly above auth card).

---

### User Story 2 (P1): Elimination of Legacy Showcase Bloat
**As a** frontend maintainer,  
**I want** dead, obsolete marketing copy and components purged from `auth-split-layout.tsx`,  
**So that** the codebase remains lean, clean, and free of redundant duplication.

- **Acceptance Criteria 2.1**: `VALUE_PILLARS` array is completely removed from `auth-split-layout.tsx`.
- **Acceptance Criteria 2.2**: Unused SVG icons (`ShieldCheckIcon`, `CloudIcon`, `CommentIcon`, `LockIcon`) are removed from `auth-split-layout.tsx`.
- **Acceptance Criteria 2.3**: The legacy headline (`"Automate Facebook and Instagram 100% on the cloud without ever giving away your credentials..."`) and colored badge container are removed completely.

---

### User Story 3 (P1): Test Suite Modernization
**As an** automated test runner,  
**I want** the auth component test suite to validate the new canonical showcase panel,  
**So that** CI quality gates assert the modern copy and multi-platform value proposition.

- **Acceptance Criteria 3.1**: `apps/web/tests/auth/auth-components.test.tsx` is updated to assert the new default showcase elements and copy instead of the deleted `VALUE_PILLARS`.
- **Acceptance Criteria 3.2**: A new test verifies that `SignupPage` renders the new default showcase panel.
