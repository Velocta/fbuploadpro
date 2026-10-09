# Feature Specification: Spec 022 — Left-Aligned Authentication Split Layout Architecture

**Status**: Draft  
**Branch**: `feat/spec-022-left-aligned-auth-layout`  
**Constitution Reference**: FBUploadPro Constitution v2.11.0 (Principle 16)  

---

## 1. Executive Summary

This feature updates the split-screen authentication architecture (`AuthSplitLayout`) so that the primary interactive authentication forms appear on the left side of desktop viewports ($\ge 1024\text{px}$) and the secondary brand showcase panel appears on the right side.

Following ergonomic F-pattern visual hierarchy and accessibility standards, placing the task-oriented form in the primary left column allows users and screen readers to immediately interact with credentials entry without scanning past marketing pillars. In accordance with user direction, this layout applies universally across all authentication screens (`/login`, `/signup`, `/forgot-password`, and `/reset-password`).

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Left-Aligned Form Layout on Desktop
**As a** customer visiting FBUploadPro to sign in or register,  
**I want** the login and signup forms positioned on the left side of my screen,  
**So that** I can immediately focus on and complete my authentication workflow.

- **AC 1.1**: On desktop viewports ($\ge 1024\text{px}$), the interactive form container (`<main className="auth-form-panel">`) is rendered on the left (first column), and the brand showcase container (`<section className="auth-showcase-panel">`) is rendered on the right (second column).
- **AC 1.2**: The showcase panel on the right features an interior border hairline on its left edge (`border-left: 1px solid var(--border-subtle)`), with no border on its right edge.
- **AC 1.3**: The subtle gold ambient glow in the showcase panel is balanced along the right/outer quadrant (`circle at 82% 22%`).
- **AC 1.4**: All primary form elements, labels, validation alerts, password toggles, and submission buttons preserve their exact sizing, typography, and theme token bindings (`apps/web/src/lib/theme.ts`).

### User Story 2 (P1): Universal Consistency Across Auth Suite
**As a** user navigating between Sign In, Sign Up, Forgot Password, and Reset Password,  
**I want** a unified visual and spatial layout across all authentication screens,  
**So that** transitions between recovery and sign-in feel seamless and predictable.

- **AC 2.1**: `/login`, `/signup`, `/forgot-password`, and `/reset-password` all render with the form on the left and the brand showcase on the right.
- **AC 2.2**: The component API for `AuthSplitLayout` supports an optional `formPosition?: 'left' | 'right'` prop with `'left'` as the default.

### User Story 3 (P2): Responsive Mobile & Tablet Layout Integrity
**As a** mobile or tablet operator accessing FBUploadPro ($< 1024\text{px}$),  
**I want** a single-column, centered form view with clear branding,  
**So that** mobile authentication remains completely fluid without lateral scrolling or cramped sidebars.

- **AC 3.1**: On viewports $< 1024\text{px}$, the showcase panel is hidden (`display: none !important`), and the auth form occupies 100% width.
- **AC 3.2**: The mobile brand header (`BrandLogo` and "FBUploadPro" title) continues to render centered above the form card on small screens.
- **AC 3.3**: Zero visual regressions, overlaps, or broken inputs on viewport resize.

---

## 3. Design System & Tokens
- **Single Source of Truth**: All styling must strictly utilize tokens from `apps/web/src/lib/theme.ts` (`PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`) or CSS variables (`--bg-canvas`, `--bg-panel`, `--border-subtle`, `--text-main`, `--text-sub`).
- **Design Immutability**: `DESIGN.md` remains strictly unchanged.
