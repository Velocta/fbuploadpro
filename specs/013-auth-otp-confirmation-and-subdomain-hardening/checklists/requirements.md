# Requirements Checklist: Spec 013

**Feature**: Auth OTP Confirmation & Subdomain Hardening  
**Target Spec**: `specs/013-auth-otp-confirmation-and-subdomain-hardening/spec.md`

---

## 1. Functional Requirements

- [ ] CHK01: `/api/auth/signup` generates a 6-digit cryptographic OTP upon valid details submission and holds registration in pending state.
- [ ] CHK02: OTP email is dispatched using the Resend SDK with clean fallback logging in test environments.
- [ ] CHK03: `/api/auth/signup/verify-otp` validates the 6-digit OTP, provisions the user record, and issues the `fbup_session` cookie.
- [ ] CHK04: `/api/auth/signup/resend-otp` enforces a 60-second cooldown period before permitting another OTP dispatch.
- [ ] CHK05: In `apps/web/src/middleware.ts`, requests to `/login`, `/signup`, `/forgot-password`, and `/reset-password` on tenant subdomains return HTTP 307 redirects to `https://app.${rootDomain}${path}` preserving query strings.
- [ ] CHK06: The buggy `isPublicTenantPath` that rewrote `/login` and `/signup` to `/tenant/[subdomain]/...` is completely removed.
- [ ] CHK07: Real-time password strength meter updates criteria and score (Weak / Fair / Strong) as the user types.
- [ ] CHK08: Caps Lock detection displays an inline warning indicator when Caps Lock is active on password inputs.
- [ ] CHK09: `returnUrl` is preserved when switching between `/login` and `/signup` and when completing OTP registration.
- [ ] CHK10: Clear legal consent statement ("By creating an account, you agree to our Terms of Service and Privacy Policy") is visible on `/signup`.

---

## 2. Security & Constitution Guardrails

- [ ] CHK11: Zero technical plumbing tokens (`ECONNREFUSED`, `127.0.0.1`, `5432`, SQL queries, or stack traces) leaked in error messages.
- [ ] CHK12: All UI components strictly reference tokens from `apps/web/src/lib/theme.ts`. Zero ad-hoc colors or borders.
- [ ] CHK13: Root `DESIGN.md` is strictly immutable and untouched.
- [ ] CHK14: 100% test pass rate across `pnpm turbo run build lint typecheck test`.
