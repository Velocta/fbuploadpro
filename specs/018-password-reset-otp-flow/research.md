# Technical Research: Spec 018 - 6-Digit OTP Password Reset Flow

**Feature**: `specs/018-password-reset-otp-flow`  
**Date**: 2026-10-09  

---

## 1. Background & Problem Statement

Previously, FBUploadPro implemented password recovery using Supabase email magic links (`requestPasswordReset` in `supabase-auth.ts` dispatches Supabase links via `resetPasswordForEmail`, and `/reset-password` parsed URL tokens `token`, `code`, or `#access_token`).

This introduced several issues:
1. Inconsistent UX compared to the signup flow, which uses a 6-digit email OTP.
2. Fragile URL-based token handling susceptible to browser link scanners, URL stripping, and fragmented hash handling.
3. Cross-device friction: opening the recovery link on a mobile device leaves the desktop browser session hanging.

By removing email magic links and replacing them with a unified **6-Digit Numeric OTP Recovery Flow**, the password reset experience becomes robust, instant, and consistent with the platform's authentication architecture.

---

## 2. Technical Decisions & Research Findings

### Decision 1: OTP Generation & Storage Mechanics
- **Mechanism**: Use `crypto.getRandomValues(new Uint32Array(1))` to generate cryptographically uniform 6-digit integers between `100000` and `999999`.
- **TTL & Expiration**: 10-minute time-to-live (`10 * 60 * 1000` ms).
- **In-Memory Store**: A dedicated `pendingPasswordResets = new Map<string, PendingPasswordResetEntry>()` in `apps/web/src/lib/otp-service.ts`.
- **Automatic Garbage Collection**: Expired entries are pruned upon access to prevent memory leaks.
- **Timing Attacks Prevention**: OTP verification uses `crypto.timingSafeEqual` across equal-length buffers.

### Decision 2: Progressive Lockout & Rate Limiting
- **IP Rate Limiting**: Max 5 reset requests per 60 seconds per IP address (`forgot:ip:${clientIp}`).
- **Email Rate Limiting**: Max 3 reset requests per 60 seconds per canonical Gmail address (`forgot:email:${canonicalEmail}`).
- **Resend Cooldown**: 60-second minimum interval between OTP dispatches.
- **Verification Failure Lockout**: Maximum 5 incorrect OTP attempts before a 15-minute temporary lockout (`recordFailedAttempt`, `isLockedOut`).

### Decision 3: Email Notification via Resend
- **Email Delivery**: Leverage `apps/web/src/lib/email-service.ts`.
- **Template**: Implement `sendPasswordResetOtpEmail({ email, name, otp })` with custom HTML/text templates tailored for password recovery (e.g., subject `${otp} is your password reset code`).
- **Simulated Fallback**: In test environments or when `RESEND_API_KEY` is unavailable, log securely to console without throwing.

### Decision 4: Password Mutation & Session Invalidation
- **Zod Contracts**: Update `@fbuploadpro/contracts` with `ForgotPasswordRequestSchema` and `ResetPasswordOtpRequestSchema`.
- **Single-Use Enforcement**: Immediately delete the OTP entry upon successful verification before mutating credentials.
- **Session Termination**: Update `passwordUpdatedAt = Math.floor(Date.now() / 1000)` on the user record so that all existing JWT session tokens issued prior to that timestamp (`session.iat < user.passwordUpdatedAt`) are immediately rejected by `validateSessionActive`.

### Decision 5: Two-Step UX Flow on `/forgot-password`
- **Step 1**: Prompt for email. On success, move to Step 2 without reloading the page.
- **Step 2**: Render 6-digit code input, new password, and confirm new password. Include a 60-second cooldown timer for resending, and a "Change email address" link to safely return to Step 1.
- **`/reset-password` Redirection**: If a user hits `/reset-password` directly, redirect cleanly to `/forgot-password`.
