# Feature Specification: Spec 024 — Native Supabase Auth Lifecycle & Frictionless Verification Architecture

**Feature ID**: `024-supabase-native-auth-lifecycle`  
**Status**: In Progress  
**Created**: 2026-10-09  
**Constitution Authority**: Principle 17 (Native Supabase Auth SMTP Delivery) & Principle 18 (Native Supabase Email Verification Lifecycle)

---

## 1. Executive Summary & Problem Statement

In Spec 023, the platform successfully decommissioned the third-party Resend SDK and migrated OTP email delivery to native Supabase Auth over custom SMTP. However, attempting to track email verification via a redundant `pending_verification` state in `public.users` introduced three friction points:
1. **Redundant Status Tracking**: Supabase Auth natively tracks email verification via `auth.users.email_confirmed_at`. Introducing `pending_verification` in `public.users` created conflicting sources of truth and database constraint issues.
2. **False "Invalid Credentials" on Login**: When an unverified user signs into `/login`, Supabase Auth returns `Email not confirmed`. The application collapsed this into `"Invalid email or password"` rather than guiding the user to `/signup?step=otp` to complete verification.
3. **Raw 60-Second Cooldown Failures**: When a user on the OTP screen clicks "Wrong email? Edit" and re-submits the signup form within 60 seconds, Supabase GoTrue throws its raw rate limit message: `"For security purposes, you can only request this after 47 seconds."`. The app surfaced this as a generic error rather than gracefully resuming the active valid OTP for the same email or displaying a live countdown timer for a new email.
4. **Natural Verification via Password Recovery**: When an unverified user proves email ownership by completing the 6-digit recovery OTP and updating their password, Supabase Auth correctly sets `email_confirmed_at = now()`. The application must embrace this native behavior as valid email proof, ensuring the user's profile is initialized as `active` so they can seamlessly enter their workspace without artificial barriers.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Unverified User Login Redirection (P1)
**As an** unverified user who signed up but hasn't entered my 6-digit OTP yet,  
**When I** navigate to `/login` and submit my valid email and password,  
**Then I should** NOT receive a misleading `"Invalid email or password"` error;  
**Instead, I should** be automatically redirected to `/signup?step=otp&email={email}&notice=pending_verification` with a clear message: *"Please enter the verification code sent to your email to complete registration."*

### User Story 2: Graceful Same-Email Signup Resubmission (P1)
**As a** user on the signup OTP screen who clicks "Wrong email? Edit" and clicks "Create Account" again with the **same email** within 60 seconds,  
**When I** re-submit the form,  
**Then I should** NOT see a `"For security purposes, you can only request this after X seconds"` error;  
**Instead, the system should** update any modified name/phone details, recognize that a valid OTP was already dispatched, return `requiresOtp: true`, and seamlessly guide me back to the OTP screen where my existing code is active.

### User Story 3: Live Cooldown UI for Different Email Resubmission (P2)
**As a** user who clicked "Wrong email? Edit", changed my email to a **new address**, and submitted during an active Supabase cooldown,  
**When the server receives** Supabase's `after X seconds` rate limit response,  
**Then the server should** return HTTP `429 Too Many Requests` with `{ retryAfterSeconds: X }`, and  
**The frontend should** display an informative countdown callout, display a countdown on the submit button (`"Please wait Xs..."`), and automatically re-enable when the cooldown reaches 0.

### User Story 4: Password Recovery Verification Continuity (P1)
**As an** unverified user who recovers my account by entering the 6-digit recovery OTP and a new password on `/forgot-password`,  
**When I** submit the new password,  
**Then my email should** be confirmed natively in Supabase Auth, my profile in `public.users` should be ensured with `status: 'active'`, and I should be able to log in and access my workspace without artificial roadblocks.

### User Story 5: Clean Two-State User Status (P1)
**As an** engineer maintaining the platform,  
**I want** `public.users.status` to strictly contain `'active' | 'suspended'`,  
**So that** business account status is decoupled from email verification state, eliminating database constraint conflicts and sync issues.

---

## 3. Edge Cases & Constraints

1. **Wrong Password on Unverified Login**: If an unverified user enters an **incorrect** password on `/login`, Supabase Auth returns `Invalid login credentials`. The API must still return `401: Invalid email or password`—the redirection to OTP only occurs when the password matches (`Email not confirmed`).
2. **Missing Profile on Post-Reset Login**: If a user resets their password and logs in, but their record in `public.users` was somehow omitted, `loginTenantUser` must upsert their record into `public.users` as `active` (and provision storage quotas), ensuring they never receive a 500 or broken workspace.
3. **Single Combined PR Protocol**: Roadmap documentation in `docs/foundational-knowledge.md` and constitution principles must be committed and pushed atomically in the same PR.
4. **Design System Immutability**: `DESIGN.md` remains frozen and strictly untouched.
