# Security & OWASP Verification Checklist: Authentication Flow Remediation

**Feature**: `specs/017-auth-flow-audit-remediation`  
**Date**: 2026-10-09  

## 1. Post-Authentication Redirection (OWASP A01: Broken Access Control)

- [x] All redirect parameters (`returnUrl`) validated against strict relative path check (`startsWith('/') && !startsWith('//')`)
- [x] Protocol-relative URLs (`//evil.com`) and data/javascript URIs blocked
- [x] Fully-qualified URLs permitted ONLY if host matches exact `{subdomain}.{rootDomain}`
- [x] Fallback always routes to safe internal tenant workspace root

## 2. Password Reset Lifecycle & Authorization (OWASP A07: Identification and Authentication Failures)

- [x] Client page parses recovery tokens from query parameters (`code`) and hash fragments (`access_token`)
- [x] Client displays explicit "Invalid or Expired Link" state when tokens are missing
- [x] Server API requires and verifies recovery token before mutating user credentials
- [x] Arbitrary password override endpoints without token verification completely eliminated
- [x] IP rate limiting (max 5 requests per 60 seconds) enforced on `/api/auth/reset-password`
- [x] Single-use token invalidation enforced upon successful password update

## 3. Credential Storage & Memory Hygiene (Constitution Principle X)

- [x] Cleartext passwords pre-hashed with PBKDF2 immediately upon receipt at API boundary
- [x] Staging cache (`pendingSignups`) stores only salt-hashed passwords, zero plaintext in heap
- [x] Cleartext passwords never emitted in server logs, error envelopes, or tracebacks

## 4. Session Security & Lifecycle (OWASP A07)

- [x] JWT token lifetime synchronized to 30 days matching `fbup_session` cookie `maxAge`
- [x] Session cookie flags verified: `httpOnly: true`, `sameSite: 'lax'`, `secure: isProduction`
- [x] Pre-existing active sessions invalidated upon password change

## 5. WCAG 2.2 AA Accessibility & Input Hygiene

- [x] Form labels properly associated via `htmlFor` and input `id`
- [x] `autoComplete` attributes set on all fields (`username`, `current-password`, `name`, `tel`, `email`, `new-password`)
- [x] Password visibility toggle has visible focus indicator (`:focus-visible`)
- [x] Legal links open in new tab with `target="_blank"` and `rel="noopener noreferrer"` without wiping form inputs
- [x] Secondary action buttons have sufficient padding meeting touch target minimums (>= 24x24px)
- [x] `LoginRequestSchema` bounds password to 128 characters to prevent hashing CPU DoS
