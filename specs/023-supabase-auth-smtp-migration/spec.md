# Feature Specification: Spec 023 — Supabase Auth Native SMTP OTP Delivery Architecture

**Status**: Draft  
**Branch**: `feat/spec-023-supabase-auth-smtp-migration`  
**Constitution Reference**: FBUploadPro Constitution v2.12.0 (Principle 17)  

---

## 1. Executive Summary

This feature eliminates the direct third-party `resend` dependency and replaces all custom email dispatch mechanisms with native **Supabase Auth** OTP email delivery over custom SMTP.

Users configure their custom SMTP provider directly in Supabase Project Settings (Auth > SMTP Settings). When users register, request a new code, or reset their password, Supabase Auth handles the cryptographic generation and email delivery of the 6-digit verification code (`{{ .Token }}`). The user profile is staged into the public `users` table as `pending_verification` on initial `signUp`, and transitions to `active` immediately upon successful `verifyOtp`.

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Native Supabase Auth Registration & 6-Digit OTP Delivery
**As a** new customer signing up for FBUploadPro,  
**I want** to receive a 6-digit verification OTP delivered through the platform's Supabase SMTP provider,  
**So that** I can securely verify my Gmail address and activate my account without external intermediary email services.

- **AC 1.1**: `POST /api/auth/signup` calls `supabase.auth.signUp({ email, password, options: { data: { name, phone, subdomain } } })`. Supabase automatically dispatches the verification email containing the 6-digit numeric token (`{{ .Token }}`) via the project-configured custom SMTP.
- **AC 1.2**: Upon successful `signUp`, a profile record is created in the public `users` table with status `pending_verification`, preserving multi-tenant isolation and user profile metadata (`name`, `phone`, `subdomain`).
- **AC 1.3**: The client receives HTTP 200 with `{ success: true, requiresOtp: true, email }` and advances to Step 2 (`step=otp`).
- **AC 1.4**: In offline / local CI environments without Supabase credentials, the fallback continues to simulate OTP dispatch and logs the code to the development console.

### User Story 2 (P1): Verification & Account Activation via `verifyOtp`
**As a** registrant entering my 6-digit verification code on Step 2,  
**I want** my code validated through Supabase Auth,  
**So that** my account status becomes `active` and I am signed into my workspace.

- **AC 2.1**: `POST /api/auth/signup/verify-otp` calls `supabase.auth.verifyOtp({ email, token, type: 'signup' })` (or `type: 'email'`).
- **AC 2.2**: Upon successful verification, the public `users` table record status is updated to `active`, and a storage quota record is ensured.
- **AC 2.3**: An authenticated session cookie (`fbup_session`) is signed and set, and the client receives the workspace root redirect URL.
- **AC 2.4**: Failed verification attempts return a clean, user-friendly error message without technical leakages.

### User Story 3 (P1): Native Resend Cooldown & OTP Regeneration
**As a** registrant requesting a fresh code on Step 2,  
**I want** Supabase Auth to dispatch a fresh verification code,  
**So that** I can complete onboarding if my previous email was delayed.

- **AC 3.1**: `POST /api/auth/signup/resend-otp` calls `supabase.auth.resend({ type: 'signup', email })`.
- **AC 3.2**: Enforces the 60-second cooldown timer on both the server and client.

### User Story 4 (P1): Password Reset via Supabase Auth Recovery OTP
**As a** user who forgot my password,  
**I want** to request a 6-digit reset code delivered via Supabase Auth SMTP,  
**So that** I can securely reset my credentials using the existing 2-step OTP interface.

- **AC 4.1**: `POST /api/auth/forgot-password` calls `supabase.auth.resetPasswordForEmail(email)`.
- **AC 4.2**: `POST /api/auth/reset-password` verifies the recovery OTP via `supabase.auth.verifyOtp({ email, token, type: 'recovery' })` and updates the password via `supabase.auth.updateUser({ password })`.
- **AC 4.3**: Upon completion, the user is redirected to `/login?reset=success`.

### User Story 5 (P2): Deprecation and Clean Removal of Resend
**As a** maintainer of FBUploadPro,  
**I want** the `resend` package and unused files removed from the codebase,  
**So that** the bundle remains lean and free of redundant email dependencies.

- **AC 5.1**: `resend` dependency removed from `apps/web/package.json`.
- **AC 5.2**: `apps/web/src/lib/email-service.ts` deleted.
- **AC 5.3**: All references to `RESEND_API_KEY` purged from codebase and documentation.
