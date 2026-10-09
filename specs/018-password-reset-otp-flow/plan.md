# Implementation Plan: 018 - 6-Digit OTP Password Reset Flow

**Branch**: `feat/018-password-reset-otp-flow` | **Date**: 2026-10-09 | **Spec**: [specs/018-password-reset-otp-flow/spec.md](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/auth_flow_audit/specs/018-password-reset-otp-flow/spec.md)

**Input**: Feature specification from `specs/018-password-reset-otp-flow/spec.md`

---

## 1. Summary

Transition password reset from legacy magic recovery links to a unified, cryptographically secure 6-Digit Numeric OTP flow.
- Deliver 6-digit OTPs via Resend email service (`apps/web/src/lib/email-service.ts`).
- Secure code lifecycle with 10-minute TTL, 60s cooldown, 5-attempt progressive lockout, and constant-time verification (`crypto.timingSafeEqual`).
- Implement an intuitive two-step interface directly on `/forgot-password` (Step 1: Gmail, Step 2: Code + Password + Confirm Password + 60s Resend Timer).
- Gracefully redirect `/reset-password` to `/forgot-password`.
- Invalidate active user sessions upon password update to prevent unauthorized account access.

---

## 2. Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Primary Dependencies**: Next.js 16 (App Router), React 19, Zod, `node:crypto`, `resend`, `@supabase/supabase-js`, `libphonenumber-js`  
**Storage**: In-memory OTP storage (`otp-service.ts`) with automatic expiration cleanup, PostgreSQL database (`@fbuploadpro/database`), Supabase PostgREST client  
**Testing**: Vitest (`pnpm --filter @fbuploadpro/web test`)  
**Target Platform**: Node.js & Vercel edge/serverless execution  
**Project Type**: Next.js Web Application (`apps/web`) & Monorepo contracts (`packages/contracts`)  
**Performance Goals**: OTP dispatch under 300ms, constant-time verification < 5ms  
**Constraints**: Zero technical plumbing leaks, theme token fidelity (`apps/web/src/lib/theme.ts`), atomic PR under 200 LoC  
**Scale/Scope**: All authentication and password recovery users  

---

## 3. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
| :--- | :--- | :--- |
| **I. SDD Single Source of Truth** | All changes traced to Spec 018 artifacts (`spec.md`, `plan.md`, `tasks.md`). TDD mandatory. | PASS |
| **II. Modular Architecture** | Contracts isolated in `@fbuploadpro/contracts`; UI in `apps/web`. No cross-layer pollution. | PASS |
| **III. Multi-Tenant Isolation** | User identity compound constraints preserved; tenant boundary `user_id` enforced. | PASS |
| **IV. Zero-Trust Validation** | Strict Zod validation on all API endpoints; constant-time OTP comparison; zero secrets leaked. | PASS |
| **V. Atomic PRs & Git Hygiene** | Focused changes on `feat/018-password-reset-otp-flow`, passing full quality gate. | PASS |
| **Section 8: Theme Tokens** | All styling uses `@web/lib/theme` or CSS variables. Zero ad-hoc colors or custom borders. `DESIGN.md` untouched. | PASS |
| **Section 9: Professional UX Writing** | Clear, human microcopy; zero developer jargon; zero mock status badges. | PASS |
| **Section 10: Strict Gmail & OTP** | Canonical Gmail enforcement; cryptographically secure 6-digit OTP with 10m TTL & 5-attempt lockout. | PASS |
| **Section 12: Auth Security & OTP Reset** | Magic links eliminated; OTP password reset enforced; session tokens invalidated post-mutation. | PASS |

---

## 4. Project Structure & Affected Modules

```text
packages/contracts/
└── src/domain/auth.ts                  # Add ForgotPasswordRequestSchema, ResetPasswordOtpRequestSchema

apps/web/
├── src/
│   ├── app/
│   │   ├── api/auth/
│   │   │   ├── forgot-password/
│   │   │   │   ├── route.ts            # Dispatches 6-digit OTP via email-service
│   │   │   │   └── resend/route.ts     # Resends 6-digit OTP respecting 60s cooldown
│   │   │   └── reset-password/
│   │   │       └── route.ts            # Verifies OTP, updates password, invalidates sessions
│   │   ├── forgot-password/
│   │   │   └── page.tsx                # Two-step UI: Step 1 (email), Step 2 (code + new password)
│   │   └── reset-password/
│   │       └── page.tsx                # Seamless redirection to /forgot-password
│   └── lib/
│       ├── otp-service.ts              # createPasswordResetOtp, verifyPasswordResetOtp, resendPasswordResetOtp
│       ├── email-service.ts            # sendPasswordResetOtpEmail template and dispatch
│       └── supabase-auth.ts            # Password update with session invalidation
└── tests/
    └── auth/
        └── password-reset-otp.test.ts  # Integration & unit test coverage for OTP recovery
```
