# Quickstart: Spec 018 - 6-Digit OTP Password Reset Flow

**Feature**: `specs/018-password-reset-otp-flow`  
**Date**: 2026-10-09  

---

## 1. Automated Verification Commands

Run the full Turborepo test and validation suite:
```bash
pnpm turbo run build lint typecheck test
```

Run auth unit and integration tests specifically:
```bash
pnpm --filter @fbuploadpro/web test tests/auth/
```

---

## 2. Manual Verification Workflow

### Test 1: Happy Path Password Recovery
1. Navigate to `http://app.localhost:3000/forgot-password`.
2. Input registered Gmail address (e.g., `creator@gmail.com`) and click **Send Verification Code**.
3. Observe seamless UI transition to Step 2 (Code & Password Entry).
4. Enter the 6-digit verification code from email (or test console), enter a new password (min 8 chars), confirm the password, and click **Reset Password**.
5. Verify success alert and redirection to `/login`.
6. Verify login with the new password succeeds.

### Test 2: Invalid & Expired Code Handling
1. Request a code on `/forgot-password`.
2. Enter an incorrect 6-digit code (e.g. `000000`).
3. Verify inline error indicates invalid code and displays remaining attempts (e.g., "Invalid verification code. 4 attempts remaining.").
4. Submit 5 incorrect codes consecutively.
5. Verify lockout message (15-minute temporary lockout).

### Test 3: Resend Cooldown
1. On Step 2, attempt to click **Resend Code** immediately.
2. Verify button is disabled or countdown displays remaining cooldown seconds (up to 60s).
3. Once timer expires, click **Resend Code** and verify a new 6-digit OTP is delivered.

### Test 4: Direct `/reset-password` Access
1. Directly open `http://app.localhost:3000/reset-password` in the browser.
2. Verify clean redirect to `/forgot-password`.
