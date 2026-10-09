# Technical Research: Authentication Flow Audit Remediation

**Feature**: `specs/017-auth-flow-audit-remediation`  
**Date**: 2026-10-09  

## Research Topics & Decisions

### 1. Open Redirect Defense via `returnUrl` (SEC-001)

- **Decision**: Implement a canonical `sanitizeAuthRedirectUrl(rawReturnUrl, userSubdomain, rootDomain)` utility in `apps/web/src/lib/auth-redirect.ts`.
- **Rationale**:
  - A simple `.includes(user.subdomain)` check is vulnerable to attacker URLs such as `https://evil.com/?victim` or `https://victim.evil.com`.
  - Protocol-relative URLs (e.g. `//evil.com`) start with `/` and can bypass naive `startsWith('/')` checks.
  - Safe rule: A redirect URL is only allowed if:
    1. It is a strictly relative path: starts with `/` and NOT `//`, containing no colon or backslash before the first path delimiter.
    2. OR, if it is a fully-qualified URL, its `URL.host` strictly equals `${userSubdomain}.${rootDomain}` and its protocol is `http:` (local) or `https:` (production).
    3. All other values fall back safely to `https://${userSubdomain}.${rootDomain}`.
- **Alternatives Considered**:
  - Regex domain match: Prone to regex evasion and catastrophic backtracking.
  - Rejecting all `returnUrl` parameters: Degrades user experience for deep-linked features.

---

### 2. Password Reset Token Exchange & State Machine (SEC-002, AUTH-08)

- **Decision**: Multi-phase token extraction and client-side guard.
  1. On `/reset-password` mount:
     - Check `useSearchParams().get('code')` (Supabase PKCE code) or `searchParams.get('token')`.
     - Check `window.location.hash` for `#access_token=...&type=recovery`.
     - If neither exists, immediately set state to `invalid-link` and render an informative callout with a link to `/forgot-password`.
  2. On submission:
     - Post `{ password, token, code }` to `POST /api/auth/reset-password`.
  3. Server verification:
     - In Supabase mode: exchange code for session via `supabase.auth.exchangeCodeForSession` or `supabase.auth.admin.updateUserById`, or verify access token.
     - In fallback mode: check token against a cryptographic reset store.
     - If token verification fails, return HTTP 400 with a clean sanitized error.
     - Never allow unauthenticated `{ email, password }` updates.
- **Rationale**: Completely restores functionality in Supabase while eliminating the arbitrary password override hole.
- **Alternatives Considered**:
  - Server-side redirect with cookie session: More complex, prone to cookie dropping across third-party mail client embedded webviews.

---

### 3. Cleartext Password Memory Retention (SEC-003)

- **Decision**: Pre-hash user password with PBKDF2 (`hashPassword`) inside `POST /api/auth/signup` before staging the payload in `pendingSignups`.
- **Rationale**:
  - Storing plaintext passwords in memory for 10 minutes creates liability during heap dumps or memory profiling.
  - Pre-hashing preserves the exact security guarantee: when the OTP is verified, the already-hashed password is saved directly to PostgreSQL (`localPasswordStore` or Supabase user provisioning).
  - Comports directly with Constitution Principle X.
- **Alternatives Considered**:
  - Storing password in encrypted Redis: Unnecessary overhead for temporary OTP staging when pre-hashing is completely secure and deterministic.

---

### 4. JWT Expiration & Cookie Lifetime Synchronization (AUTH-06)

- **Decision**: Update default session token signing expiration to 30 days (`2,592,000` seconds = `86400 * 30`) across `signSessionToken` in `contracts/src/domain/session.ts` and `supabase-auth.ts`.
- **Rationale**:
  - The `fbup_session` cookie is configured with `maxAge: 86400 * 30`.
  - When the JWT expired after 24 hours while the cookie remained for 30 days, users were abruptly logged out with a stale cookie that was never cleaned up.
  - Aligning both to 30 days ensures harmonious session persistence.
- **Alternatives Considered**:
  - Lowering cookie to 24 hours: Degrades user experience for a SaaS tool used daily by creators.
  - Sliding session refresh in middleware: Adds latency to every edge request; 30-day token matches cookie perfectly.

---

### 5. Session Revocation upon Password Change (SEC-005)

- **Decision**: Add `password_updated_at` (epoch timestamp) to the user record. Include `authTime` in session tokens. In session validation, tokens issued before `password_updated_at` are rejected.
- **Rationale**: Ensures any compromised sessions or tokens on other devices are terminated immediately when a user resets their password.
