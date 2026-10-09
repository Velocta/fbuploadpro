# Implementation Plan: Password Reset & Recovery Flow

**Branch**: `feat/011-password-reset-recovery-flow` | **Date**: 2026-10-09 | **Spec**: [specs/011-password-reset-recovery-flow/spec.md](spec.md)

---

## 1. Summary

This plan outlines the implementation of:
1. "Forgot password?" link on `/login` form located directly above the password field.
2. Dedicated `/forgot-password` page with email submission and success confirmation state.
3. Dedicated `/reset-password` page with new password & confirm password inputs.
4. Backend API routes `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` integrated with Supabase Auth and test fallback.
5. Unit tests covering recovery request and password update flows.

---

## 2. Technical Context

- **Platform / Framework**: Next.js 16 (App Router) + React 19 (`apps/web`).
- **Authentication**: Supabase Auth client (`@supabase/supabase-js`) with `resetPasswordForEmail` and `updateUser`.
- **UI Components**: `AuthSplitLayout`, `PasswordInput`, `Input`, `Button`, `Alert`.
- **Testing**: Vitest + React Testing Library.

---

## 3. Architecture & File Structure

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/
│   │   │       ├── forgot-password/
│   │   │       │   └── route.ts         # Endpoint for requesting password recovery
│   │   │       └── reset-password/
│   │   │           └── route.ts         # Endpoint for submitting new password
│   │   ├── forgot-password/
│   │   │   └── page.tsx                 # UI for requesting recovery email
│   │   ├── reset-password/
│   │   │   └── page.tsx                 # UI for entering new password
│   │   └── login/
│   │       └── page.tsx                 # Enhanced with "Forgot password?" link
│   └── lib/
│       └── supabase-auth.ts             # Enhanced with recovery helpers
└── tests/
    └── auth/
        ├── forgot-password.test.tsx     # Tests for forgot password page & API
        └── reset-password.test.tsx      # Tests for reset password page & API
```

---

## 4. Implementation Steps

1. **Recovery Helpers in `apps/web/src/lib/supabase-auth.ts`**:
   - Add `requestPasswordReset(email: string, redirectTo: string)`.
   - Add `resetUserPassword(params: { password: string; email?: string; token?: string })`.
2. **API Endpoints**:
   - `apps/web/src/app/api/auth/forgot-password/route.ts`: Validate email, call `requestPasswordReset`, return `{ success: true, message: string }`.
   - `apps/web/src/app/api/auth/reset-password/route.ts`: Validate password (8+ chars), call `resetUserPassword`, return `{ success: true }`.
3. **Login Page Link**:
   - In `apps/web/src/app/login/page.tsx`, add "Forgot password?" text link right above the password input.
4. **Forgot Password Page (`apps/web/src/app/forgot-password/page.tsx`)**:
   - Render using `AuthSplitLayout`.
   - Form with Email input and "Send Recovery Link" button.
   - Upon success, show confirmation alert with option to resend or back to login.
5. **Reset Password Page (`apps/web/src/app/reset-password/page.tsx`)**:
   - Render using `AuthSplitLayout`.
   - Form with New Password and Confirm New Password using `PasswordInput`.
   - Validates matching passwords and length >= 8.
   - Upon success, redirects to `/login`.
6. **Tests & Quality Gate**:
   - Unit tests in `apps/web/tests/auth/`.
   - Run `pnpm turbo run build lint typecheck test`.
