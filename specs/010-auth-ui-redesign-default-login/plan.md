# Implementation Plan: Professional Auth UI/UX Redesign & Default Login Page

**Branch**: `feat/010-auth-ui-redesign-default-login` | **Date**: 2026-10-09 | **Spec**: [specs/010-auth-ui-redesign-default-login/spec.md](spec.md)

---

## 1. Summary

This plan outlines the implementation of:
1. Replacing the placeholder landing page on root (`/`) with an automatic redirect to `/login`.
2. Building an accessible, responsive Split-Screen authentication layout (`AuthSplitLayout`) featuring a high-craft brand showcase on the left and a focused form container on the right.
3. Redesigning `/login` with the split layout, enhanced password visibility toggle, accessible alerts, and return URL handling.
4. Redesigning `/signup` with the split layout, removing the subdomain preview badge, including password visibility toggle, and retaining all required registration fields (Name, Phone, Email, Password).
5. Comprehensive unit tests covering root redirection and auth page rendering.

---

## 2. Technical Context

- **Platform / Framework**: Next.js 16 (App Router) + React 19 (`apps/web`).
- **Styling & Tokens**: Canonical tokens from `apps/web/src/lib/theme.ts` and CSS variables in `apps/web/src/app/globals.css`.
- **UI Primitives**: Spec 008 components in `apps/web/src/components/ui/` (`Button`, `Input`, `Card`, `Alert`).
- **Testing**: Vitest + React Testing Library (`apps/web/vitest.config.ts`).
- **Quality Gates**: `pnpm turbo run build lint typecheck test` must pass with 0 errors.

---

## 3. Architecture & File Structure

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Replaced: redirect('/login')
│   │   ├── login/
│   │   │   └── page.tsx                # Redesigned: Split-screen login
│   │   └── signup/
│   │       └── page.tsx                # Redesigned: Split-screen signup (no subdomain badge)
│   ├── components/
│   │   └── auth/
│   │       ├── auth-split-layout.tsx   # Brand showcase + form container layout
│   │       └── password-input.tsx      # Input with show/hide password toggle
│   └── lib/
│       └── theme.ts                    # Canonical theme tokens
└── tests/
    └── auth/
        ├── root-redirect.test.tsx      # Tests asserting root redirects to /login
        └── auth-split-layout.test.tsx  # Tests for auth split layout & password input
```

---

## 4. Implementation Steps

1. **Root Redirect (`apps/web/src/app/page.tsx`)**:
   - Use Next.js `redirect('/login')` to immediately send visitors on `/` to `/login`.
   - Update `apps/web/src/middleware.ts` to ensure unauthenticated visits to `/` on the app gateway also route directly to `/login`.
2. **Password Input Primitive (`apps/web/src/components/auth/password-input.tsx`)**:
   - Wrap `Input` with a toggle button positioned inside the field.
   - SVG icons for eye (visible) and eye-slash (hidden).
   - `aria-label` updates dynamically ("Show password" / "Hide password").
   - Maintains full keyboard navigation and focus rings.
3. **Auth Split Layout Component (`apps/web/src/components/auth/auth-split-layout.tsx`)**:
   - Desktop: 2-column grid / flex (Left: Brand Showcase; Right: Auth Form Container).
   - Left Showcase:
     - Gold brand mark & FBUploadPro wordmark.
     - Strong headline: "High-throughput Facebook publishing automation."
     - Feature pillars: Slot-based queues, Cloudflare R2 direct ingestion, real-time page analytics, unrestricted publishing.
     - Subtle dark ambient radial background glow using tokens.
   - Mobile: Graceful collapse into a sleek single column with a compact brand header.
4. **Login Page Redesign (`apps/web/src/app/login/page.tsx`)**:
   - Integrate `AuthSplitLayout` with `subtitle="Sign in to your account"`.
   - Fields: Email, Password (using `PasswordInput`).
   - "Sign In" button with loading state.
   - Clear error banner using `Alert`.
   - "Don't have an account? Create one" link to `/signup`.
5. **Signup Page Redesign (`apps/web/src/app/signup/page.tsx`)**:
   - Integrate `AuthSplitLayout` with `subtitle="Create your workspace"`.
   - Fields: Full Name, Phone Number, Email Address, Password (using `PasswordInput`).
   - Remove the subdomain preview box.
   - "Create Workspace" button with loading state.
   - Clear error banner using `Alert`.
   - "Already have an account? Sign in" link to `/login`.
6. **Tests & Verification**:
   - Write unit tests in `apps/web/tests/auth/`.
   - Execute full Turborepo test suite: `pnpm turbo run build lint typecheck test`.
