# FBUploadPro Monorepo Audit: Complete Catalog of 49 Codebase Issues

> **Repository**: `velocta-fbuploadpro`  
> **Governance Baseline**: FBUploadPro Constitution `v2.29.0` | Next.js 16 | Pure Supabase PostgREST & RLS | Cloudflare Workers  
> **Generated Date**: October 2026  

---

## Executive Summary

| Severity | Count | Primary Impact Areas |
| :--- | :---: | :--- |
| **P0 — Critical** | 10 | Auth bypass, workspace ownership hijack, lingering session cookies, crypto timingSafeEqual flaws, hardcoded fallback secrets |
| **P1 — High** | 19 | Worker/DB split-brain, RLS service-role overuse, test theater, serverless memory state, schema naming drift, cascade deletions |
| **P2 — Medium** | 16 | N+1 network loops, regex censorship, error status mappings, timestamp race conditions, contract validation gaps |
| **P3 — Polish / Docs** | 4 | Governance links, constitution indentation, hook configuration, test assertions |
| **Total Issues** | **49** | Comprehensive monorepo technical debt & vulnerability catalog |

---

## Issues Directory

### [ISSUE-01] Cross-Tenant Workspace Ownership Hijack via UPSERT ON CONFLICT (subdomain)
- **Severity**: `P0 - Critical`
- **Category**: Security / Multi-Tenant Isolation
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Principle III (Multi-Tenant Defense-in-Depth), Principle 27 (Multi-Workspace Architecture)

**Problem & Root Cause**:
In loginTenantUser, resetUserPasswordWithOtp, and signUpTenantUser fallback paths, subdomain is resolved without checking collisions or falls back to an unverified slug on error. The subsequent PostgREST query executes `supabase.from('workspaces').upsert({ owner_id: userId, name: ..., subdomain: ... }, { onConflict: 'subdomain' })` under SUPABASE_SERVICE_ROLE_KEY. In PostgreSQL PostgREST, an upsert on unique subdomain overwrites owner_id with the new userId.

**Impact**:
An attacker or colliding registration can steal ownership of an existing tenant's workspace and all associated resources, bypassing RLS tenant boundaries.

**Concrete Remediation**:
Replace upsert with an explicit `.insert()`. Handle PostgreSQL duplicate key violation (SQLSTATE 23505) by generating a randomized suffix and retrying, or strictly reject colliding registrations. Never mutate owner_id on existing workspace rows.

---

### [ISSUE-02] Existing Sessions Are Never Invalidated After Password Reset in Production
- **Severity**: `P0 - Critical`
- **Category**: Security / Session Security
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Principle IV, Principle 12, Principle 29

**Problem & Root Cause**:
In `resetUserPasswordWithOtp`, step 3 only mutates `localUserStore.get(canonicalEmail)` in-memory and never persists `password_updated_at` to Supabase. In `resetUserPassword`, the timestamp write is inside an `else` branch that never executes when Supabase is configured. Furthermore, `findUserByEmail` never selects `password_updated_at` from PostgreSQL.

**Impact**:
`validateSessionActive` evaluates `if (user.passwordUpdatedAt && session.iat < user.passwordUpdatedAt)` to false for all Supabase-backed users in production. Leaked or pre-existing 30-day session cookies remain valid indefinitely after password resets.

**Concrete Remediation**:
Add `password_updated_at TIMESTAMPTZ` column to `public.users` (or read GoTrue user updated_at). Update it upon password reset. Select it in `findUserByEmail` and enforce validation in `validateSessionActive`.

---

### [ISSUE-03] PostgREST .or() Filter Injection via Unvalidated Email Fallback
- **Severity**: `P0 - Critical`
- **Category**: Security / Injection Defense
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Principle IV (Zero-Trust Boundary Validation), Principle 10

**Problem & Root Cause**:
In `findUserByEmail` and `verifySignupOtpViaSupabase`, when `canonicalizeGmailAddress` throws on malformed input, the catch block falls back to raw `emailInput.trim().toLowerCase()` and directly interpolates it into `.or(`normalized_email.eq.${canonicalEmail},email.ilike.${canonicalEmail}`)`.

**Impact**:
PostgREST uses commas and dots as query delimiters in `.or()`. An attacker supplying strings containing `,id.eq.<uuid>` or operators injects arbitrary SQL filter predicates into service-role queries against public.users.

**Concrete Remediation**:
Fail fast and reject invalid emails immediately when canonicalizeGmailAddress throws. For parameterized queries, use `.eq('normalized_email', canonicalEmail)` or sanitize input to strip PostgREST query delimiters.

---

### [ISSUE-04] Password Verification Bypass in Local/Fallback loginTenantUser
- **Severity**: `P0 - Critical`
- **Category**: Security / Authentication Bypass
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Principle IV, Principle 10

**Problem & Root Cause**:
In `loginTenantUser`, the code checks `if (storedHash) { const valid = await verifyPassword(...); if (!valid) throw new Error('Invalid email or password'); }`. If `storedHash` is undefined (e.g. user created via test seed or OTP verification fallback where password store was omitted), the guard evaluates to false and skips password verification entirely.

**Impact**:
Any user lacking a password store entry can be logged into with an arbitrary password or blank password, issuing a signed 30-day JWT session.

**Concrete Remediation**:
Enforce strict positive verification: `if (!storedHash || !(await verifyPassword(params.password, storedHash))) { throw new Error('Invalid email or password'); }`.

---

### [ISSUE-05] Service-Role Key Used Indiscriminately in getSupabaseClient()
- **Severity**: `P1 - High`
- **Category**: Architecture / RLS Governance
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Principle 28 (Pure Supabase PostgREST & RLS)

**Problem & Root Cause**:
`getSupabaseClient()` defaults to `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`. Calling client-side GoTrue methods (verifyOtp, updateUser) on a service-role client with `persistSession: false` causes `supabase.auth.updateUser` to fail without an active session context.

**Impact**:
Violates Principle 28 (client-facing operations must run under authenticated user session RLS). Causes GoTrue updateUser errors that force awkward admin fallbacks.

**Concrete Remediation**:
Separate client instantiations into `getSupabaseAnonClient()` (for GoTrue user auth flows) and `getSupabaseServiceClient()` (exclusively for backend administrative tasks).

---

### [ISSUE-06] Broken Pre-Hashed Password Handling Between signUpTenantUser and registerTenantUser
- **Severity**: `P1 - High`
- **Category**: Runtime / Auth State
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Principle 10, Principle 12, Principle 17

**Problem & Root Cause**:
In `registerTenantUser`, `params.hashedPassword || params.password` is passed directly to `supabase.auth.signUp({ password })`. If a PBKDF2 hash is passed, Supabase hashes the PBKDF2 string, breaking subsequent plaintext logins. Conversely, `signUpTenantUser` only reads `params.password`, failing if only pre-hashed credentials are provided, while still computing 100k iteration PBKDF2 synchronously.

**Impact**:
Users registered with pre-hashed passwords cannot log in. CPU cycles are wasted on redundant PBKDF2 hashes.

**Concrete Remediation**:
Standardize password lifecycle: raw passwords are passed directly to `supabase.auth.signUp` when Supabase is active; never pass PBKDF2 hashes into GoTrue signUp.

---

### [ISSUE-07] Silent PostgREST Insert/Upsert Failures During Signup & Verification
- **Severity**: `P1 - High`
- **Category**: Reliability / Data Integrity
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Coding Standards 2.B, 2.D, Principle IV

**Problem & Root Cause**:
PostgREST calls (`supabase.from('users').upsert(...)`, `supabase.from('workspaces').upsert(...)`) return `{ data, error }` instead of throwing exceptions. In `signUpTenantUser` and `registerTenantUser`, `insertError` and `workspaceError` are either ignored or only logged via `console.error`, followed by returning a fabricated user record and signed token.

**Impact**:
Users receive valid session tokens for workspaces and profiles that failed to persist to the database, resulting in broken downstream navigation and 404s.

**Concrete Remediation**:
Check `if (error) throw new Error(...)` immediately after all Supabase mutations, conforming to Coding Standards Section 2.B ('Fail-Fast over Fake Success').

---

### [ISSUE-08] Sequential N+1 Network Loop in resolveUniqueSubdomain
- **Severity**: `P2 - Medium`
- **Category**: Performance / Scalability
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Principle 27

**Problem & Root Cause**:
`resolveUniqueSubdomain` runs an unbounded `while (true)` loop firing a separate `supabase.from('workspaces').select('id').eq('subdomain', candidate).maybeSingle()` query for every suffix increment (candidate1, candidate2...).

**Impact**:
High-volume collisions (e.g. common names like 'alex', 'marketing') trigger dozens of sequential HTTPS queries during user signup, risking Vercel function timeouts.

**Concrete Remediation**:
Query existing subdomains with a single `.ilike('subdomain', `${baseSubdomain}%`)` call or append a 4-letter random string per Principle 27.

---

### [ISSUE-09] False-Positive Regex Censorship & Misclassified HTTP Statuses in auth-errors.ts
- **Severity**: `P2 - Medium`
- **Category**: Reliability / API UX
- **Affected Files**: `apps/web/src/lib/auth-errors.ts`
- **Governing Rule**: Principle 9, Principle 11

**Problem & Root Cause**:
`SQL_ACTION_REGEX = /\b(select|insert|update|delete)\s/i` and keywords matching 'stack' match standard conversational English words. Additionally, `formatAuthErrorResponse` omits 'Password cannot exceed 128 characters' (returning 500 instead of 400), matches 'Too many incorrect attempts' before rate limiting (returning 400 instead of 429), and lacks a code handler for 'REQUIRES_OTP'.

**Impact**:
Customer-facing validation messages are censored with generic fallbacks; invalid passwords trigger 500 server errors; rate limits return wrong status codes.

**Concrete Remediation**:
Tighten regex patterns to match database-specific error signatures (e.g. `/(syntax error at or near|relation ".*" does not exist|pg_)/i`). Fix status code mapping hierarchy.

---

### [ISSUE-10] Unbounded Memory Leak in localResetTokenStore
- **Severity**: `P2 - Medium`
- **Category**: Reliability / Memory Leak
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Principle 12, Principle 29

**Problem & Root Cause**:
`requestPasswordReset` inserts a token into `localResetTokenStore` Map on every call, even when Supabase is active in production. `resetUserPassword` never reads or cleans up these entries in production.

**Impact**:
Server memory leaks continuously over the lifetime of the Node.js isolate. Violates Principle 12 (no recovery link tokens) and Principle 29 (no in-memory maps).

**Concrete Remediation**:
Purge `localResetTokenStore` entirely. Route all password resets through 6-digit OTP verification via Supabase Auth.

---

### [ISSUE-11] auth-resilience.test.tsx Tests Input Validation Failure Instead of ECONNREFUSED
- **Severity**: `P1 - High`
- **Category**: Testing / Test Theater
- **Affected Files**: `apps/web/tests/auth/auth-resilience.test.tsx`
- **Governing Rule**: Coding Standards Section 5.A (Behavioral Verification over Mock Theater)

**Problem & Root Cause**:
Tests send `@fbuploadpro.com` emails to `/api/auth/login`, `/signup`, `/forgot-password`. `SignupRequestSchema` and `LoginRequestSchema` strictly require `@gmail.com` domains, short-circuiting with `400 Bad Request` before database calls ever execute.

**Impact**:
Assertions `expect(data.error).not.toContain('ECONNREFUSED')` pass trivially without ever testing database connection failure or error sanitization.

**Concrete Remediation**:
Provide valid `@gmail.com` email payloads and inject a mocked failing Supabase client via `_setMockSupabaseClient` that throws `ECONNREFUSED`.

---

### [ISSUE-12] Legacy Raw SQL DatabaseClient Mocking in Route Handlers & Security Tests
- **Severity**: `P2 - Medium`
- **Category**: Testing / Architectural Drift
- **Affected Files**: `apps/web/tests/security/token-leakage.test.ts, apps/web/tests/api/multi-account-oauth.test.ts`
- **Governing Rule**: Principle 28, Principle 29

**Problem & Root Cause**:
Tests mock `DatabaseClient` with `mockDb.query` matching raw SQL strings (`FROM facebook_accounts`, `INSERT INTO facebook_pages`).

**Impact**:
Violates Principle 28 & Principle 29 (pure PostgREST via @supabase/supabase-js, zero pg/raw SQL client). Also masks schema changes like `followersCount` vs `current_followers`.

**Concrete Remediation**:
Update test suites and route handlers to mock or use typed `SupabaseClient<Database>` PostgREST query builders (`supabase.from(...)`).

---

### [ISSUE-13] Contradictory Database Import Directives in coding-standards.md
- **Severity**: `P2 - Medium`
- **Category**: Governance / Documentation
- **Affected Files**: `.agents/rules/coding-standards.md`
- **Governing Rule**: Principle II, Principle 28

**Problem & Root Cause**:
Sections 6.B and 6.C instruct agents: 'Must import from @fbuploadpro/database/edge' and reference `packages/database`, which was completely eradicated in Constitution v2.28.0/v2.29.0.

**Impact**:
AI agents following coding-standards.md attempt to reintroduce eradicated packages and broken TCP drivers.

**Concrete Remediation**:
Update `coding-standards.md` to mandate `@supabase/supabase-js` over HTTPS and remove all references to `@fbuploadpro/database`.

---

### [ISSUE-14] Broken Hardcoded Agent Worktree Links in theme-standards.md
- **Severity**: `P3 - Low`
- **Category**: Governance / Cleanliness
- **Affected Files**: `.agents/rules/theme-standards.md`
- **Governing Rule**: Governance Integrity

**Problem & Root Cause**:
Lines 3-4 and 10 contain absolute `file:///home/agent/.../worktrees/...` URLs pointing to ephemeral directories.

**Impact**:
Hyperlinks fail in development environments and pollute repository governance rules.

**Concrete Remediation**:
Replace absolute worktree URLs with repository-relative paths (`apps/web/src/lib/theme.ts`, `DESIGN.md`).

---

### [ISSUE-15] Debug console.log Statements Emitting Verification OTPs to Stdout
- **Severity**: `P2 - Medium`
- **Category**: Security / Information Leak
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Coding Standards 5.B.5, Principle IV

**Problem & Root Cause**:
Lines 439 and 728 print `console.log('[SupabaseAuth Fallback] Simulated OTP dispatch to ...: ${otp}')`.

**Impact**:
Sensitive 6-digit one-time passwords are leaked to server log streams and cloud observability tools.

**Concrete Remediation**:
Remove OTP logging statements or replace them with sanitized audit logs omitting the OTP token.

---

### [ISSUE-16] Legacy /dashboard Route and user.subdomain Lingering in Contracts Tests
- **Severity**: `P2 - Medium`
- **Category**: Contracts / Governance Drift
- **Affected Files**: `packages/contracts/tests/auth-contracts.test.ts, apps/web/src/lib/supabase-auth.ts`
- **Governing Rule**: Principle 14, Principle 27

**Problem & Root Cause**:
Contracts tests validate `/dashboard` redirect targets (banned by Principle 14) and `AuthUser` maintains `subdomain` on the user entity (superseded by workspaces table in Principle 27).

**Impact**:
Contracts diverge from Constitution v2.29.0 routing and multi-workspace requirements.

**Concrete Remediation**:
Update `auth-contracts.test.ts` to assert tenant root redirection (`/`) and decouple `subdomain` from `AuthUser` in favor of workspace models.

---

### [ISSUE-17] Constitution Header & Section Indentation Drift
- **Severity**: `P3 - Low`
- **Category**: Governance / Documentation
- **Affected Files**: `.specify/memory/constitution.md`
- **Governing Rule**: Constitution Governance

**Problem & Root Cause**:
Sync Impact Report header lists `2.27.0 -> 2.28.0` with `TODO: Implement Spec 038`, while footer declares `2.29.0`. Principle 29 is improperly indented as a sub-bullet under Principle 28.

**Impact**:
SpecKit automated scanners and agents misread constitutional hierarchy and version numbering.

**Concrete Remediation**:
Normalize header version to 2.29.0, clear completed Spec 038 TODOs, and elevate Principle 29 to a top-level `### 29.` heading.

---

### [ISSUE-18] Lingering HttpOnly Session Cookie on Offline/Fallback Logout (?logout=success)
- **Severity**: `P0 - Critical`
- **Category**: Security / Session Lifecycle
- **Affected Files**: `apps/web/src/middleware.ts, apps/web/tests/auth/logout-resilience.test.ts`
- **Governing Rule**: Principle 15 (Resilient Session Termination)

**Problem & Root Cause**:
Principle 15 specifies that client logout should navigate to `/login?logout=success` if network logout fails. Because `fbup_session` is `HttpOnly`, browser JS cannot clear it. When middleware encounters `?logout=success`, it permits `/login` to render (200 OK) but fails to set an expired `Set-Cookie` header.

**Impact**:
The active session cookie remains alive in the browser. Visiting `/login` without the query param or opening a new tab immediately logs the user back in.

**Concrete Remediation**:
In `middleware.ts`, whenever `req.nextUrl.searchParams.get('logout') === 'success'`, explicitly append `Set-Cookie: fbup_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax` to the response.

---

### [ISSUE-19] Rate-Limiter Bypass via X-Forwarded-For IP Spoofing
- **Severity**: `P1 - High`
- **Category**: Security / Rate Limiting
- **Affected Files**: `apps/web/src/lib/rate-limiter.ts, apps/web/src/app/api/auth/login/route.ts`
- **Governing Rule**: Principle IV, Principle 10

**Problem & Root Cause**:
`extractClientIp` takes the leftmost IP from the client-controlled `x-forwarded-for` header without validating trusted reverse proxy boundaries.

**Impact**:
Attackers can bypass IP-based brute-force defenses across login, signup, and OTP endpoints by generating arbitrary random IPs in `X-Forwarded-For`.

**Concrete Remediation**:
Extract IP from verified platform headers (`x-vercel-forwarded-for`, `cf-connecting-ip`, `x-real-ip`) or read the rightmost untrusted proxy IP.

---

### [ISSUE-20] Non-Production Header-Spoofing Backdoor in getServerSessionContext
- **Severity**: `P1 - High`
- **Category**: Security / Authentication Bypass
- **Affected Files**: `apps/web/src/lib/auth.ts, apps/web/tests/auth/header-spoofing-defense.test.ts`
- **Governing Rule**: Principle IV, Principle 29

**Problem & Root Cause**:
When `NODE_ENV !== 'production'` and no session cookie is present, `getServerSessionContext()` constructs an authenticated session directly from `x-user-id`, `x-user-role`, etc., skipping SessionPayloadSchema verification.

**Impact**:
Violates Principle IV and Principle 29. Leaves authentication backdoor in staging and preview deployments.

**Concrete Remediation**:
Remove header spoofing fallback entirely from `apps/web/src/lib/auth.ts`. Require tests to provide signed session cookies via `signSessionToken()`.

---

### [ISSUE-21] Same-Second Timestamp Granularity Race in validateSessionActive
- **Severity**: `P2 - Medium`
- **Category**: Concurrency / Session Lifecycle
- **Affected Files**: `apps/web/src/lib/supabase-auth.ts, apps/web/tests/auth/session-invalidation.test.ts`
- **Governing Rule**: Principle 12, Principle 15

**Problem & Root Cause**:
Session `iat` and `passwordUpdatedAt` are stored in integer seconds and compared via `session.iat < user.passwordUpdatedAt`. Any token issued within the same clock second as a password reset has `iat === passwordUpdatedAt` and is not invalidated.

**Impact**:
Automated rapid requests fail session revocation; tests require artificial `1100ms` sleeps.

**Concrete Remediation**:
Use millisecond timestamps, strict inequality with versioning, or a monotonic `session_version` integer incremented on password changes.

---

### [ISSUE-22] Relative /login Redirect on Logout Violates Central Gateway Routing
- **Severity**: `P2 - Medium`
- **Category**: Routing / Architecture
- **Affected Files**: `apps/web/src/app/api/auth/logout/route.ts`
- **Governing Rule**: Principle 6, Principle 15

**Problem & Root Cause**:
`POST /api/auth/logout` returns `{ redirectUrl: '/login' }`.

**Impact**:
Logging out from `tenant.fbuploadpro.com` navigates to `tenant.fbuploadpro.com/login` instead of the canonical central gateway `app.fbuploadpro.com/login?logout=success` mandated by Principle 6 and Principle 15.

**Concrete Remediation**:
Construct an absolute redirect URL to `https://app.${rootDomain}/login?logout=success` using `buildCentralAppUrl()`.

---

### [ISSUE-23] Multi-Workspace Subdomain Switching Breaks Multi-Tab Operations
- **Severity**: `P1 - High`
- **Category**: Architecture / Multi-Workspace
- **Affected Files**: `apps/web/src/middleware.ts, packages/contracts/src/domain/session.ts`
- **Governing Rule**: Principle 27 (Multi-Workspace Architecture)

**Problem & Root Cause**:
Route handlers and middleware enforce `session.subdomain === requestedSubdomain`. Even though `SessionPayloadSchema` supports `allowedSubdomains: string[]`, accessing Workspace B in Tab 2 requires mutating the shared `.rootDomain` cookie, which immediately causes 403 Forbidden in Tab 1.

**Impact**:
Users cannot work across multiple owned workspaces simultaneously in different browser tabs.

**Concrete Remediation**:
Authorize requests if `session.subdomain === requestedSubdomain || session.allowedSubdomains?.includes(requestedSubdomain)`.

---

### [ISSUE-24] evaluateAccountHealth & evaluatePageHealth Compute State Only in Read-Memory Without DB Sync
- **Severity**: `P1 - High`
- **Category**: Reliability / Worker-UI Split-Brain
- **Affected Files**: `apps/web/src/app/api/tenant/[subdomain]/accounts/route.ts, apps/worker/src/dispatcher.ts`
- **Governing Rule**: Principle 19 (Error Status Taxonomy), Principle 28

**Problem & Root Cause**:
When a page hits rate-limit error 368, its DB status is set to `fb_rate_limited`. After 3 days, `evaluatePageHealth()` returns `'active'` in UI memory during `GET /pages`, but the row in `facebook_pages` remains `fb_rate_limited`. Background publishing workers and PostgreSQL RPC functions query DB columns directly (`WHERE status = 'active'`).

**Impact**:
The UI displays the page as active, but background publishing remains permanently frozen because the worker never claims jobs for pages marked `fb_rate_limited` in the DB.

**Concrete Remediation**:
Persist status transitions back to PostgreSQL when evaluated, or update queue claiming RPC to evaluate the 3-day cooldown timestamp (`updated_at <= NOW() - INTERVAL '3 days'`).

---

### [ISSUE-25] Ephemeral In-Memory otp-service.ts and globalInsightsCache in Serverless Runtime
- **Severity**: `P1 - High`
- **Category**: Architecture / Serverless State Leak
- **Affected Files**: `apps/web/src/lib/otp-service.ts, apps/web/src/lib/insights/insights-cache.ts`
- **Governing Rule**: Principle 17, Principle 18, Principle 29

**Problem & Root Cause**:
Pending signups, OTP secrets, and insights caches are stored in module-level `Map` instances in Next.js serverless functions.

**Impact**:
Violates Principle 17, 18, and 29. Signup step 1 and step 2 hitting different serverless isolates result in 'No pending registration found' 400 errors.

**Concrete Remediation**:
Store pending state in Supabase GoTrue Auth / database, and cache insights via Upstash Redis or stale-while-revalidate headers.

---

### [ISSUE-26] Trigger vs CHECK Constraint Mismatch (SQLSTATE 23514) on Normalized Email
- **Severity**: `P1 - High`
- **Category**: Database / Migration Integrity
- **Affected Files**: `supabase/migrations/20261009120000_auth_hardening_canonical_email_e164.sql`
- **Governing Rule**: Principle 10 (Strict Gmail Canonicalization)

**Problem & Root Cause**:
`canonicalize_user_email()` trigger strips `.` and `+tag`, leaving characters like `_` or `-` (e.g. `john_doe@gmail.com`). However, the check constraint enforces `CHECK (normalized_email ~ '^[a-z0-9]+@gmail\.com$')`. Emails with underscores trigger a database crash (23514). Also, unique index creation precedes invalid row cleanup.

**Impact**:
Users with hyphens or underscores in their Gmail address crash PostgreSQL during insert or update.

**Concrete Remediation**:
Update the PL/pgSQL trigger regex to strip all non-alphanumeric characters from username before appending `@gmail.com`, aligning with TypeScript `deriveSubdomainFromEmail`.

---

### [ISSUE-27] Schema Column and Table Name Inconsistencies Across Migrations and Tests
- **Severity**: `P1 - High`
- **Category**: Architecture / Schema Drift
- **Affected Files**: `supabase/migrations/20261013140000_pure_supabase_rls_and_rpc.sql, apps/web/tests/security/insights-token-leakage.test.ts`
- **Governing Rule**: Principle 25, Principle 28

**Problem & Root Cause**:
The same entity attributes are named differently: `fb_page_access_token` vs `encrypted_access_token` vs `encrypted_page_token`; `publish_logs` vs `publishing_logs`; `page_insights_daily` vs `page_insights_daily_snapshots`.

**Impact**:
Queries execute against non-existent columns/tables in production, masked by mock DB clients in tests.

**Concrete Remediation**:
Unify names to canonical migration definitions: `encrypted_access_token`, `publish_logs`, and `page_insights_daily_snapshots`.

---

### [ISSUE-28] LoginRequestSchema Accepts Cross-Tenant returnUrl and Banned /dashboard Path
- **Severity**: `P2 - Medium`
- **Category**: Contracts / Validation
- **Affected Files**: `packages/contracts/tests/auth-contracts.test.ts, packages/contracts/src/domain/auth.ts`
- **Governing Rule**: Principle 12, Principle 14

**Problem & Root Cause**:
`LoginRequestSchema.safeParse` accepts `returnUrl: 'https://jane.fbuploadpro.com/dashboard'`, violating Principle 12 open-redirect rules and Principle 14 eradication of `/dashboard`.

**Impact**:
Users can be redirected to deprecated routes or arbitrary subdomains upon login.

**Concrete Remediation**:
Refine `returnUrl` validation in `LoginRequestSchema` to enforce relative paths (excluding `/dashboard`) or validate against caller workspace.

---

### [ISSUE-29] AuthSuccessResponseSchema and SessionPayloadSchema Permit Non-Gmail Domains
- **Severity**: `P2 - Medium`
- **Category**: Contracts / Validation
- **Affected Files**: `packages/contracts/src/domain/auth.ts, packages/contracts/src/domain/session.ts`
- **Governing Rule**: Principle IV, Principle 10

**Problem & Root Cause**:
`SignupRequestSchema` strictly enforces `@gmail.com`, but downstream schemas (`AuthSuccessResponseSchema`, `SessionPayloadSchema`) permit any valid email address (`z.string().email()`).

**Impact**:
Non-compliant email formats propagate past boundary layers into session tokens and response payloads.

**Concrete Remediation**:
Apply `canonicalizeGmailAddress` or Gmail domain refinement across all authentication-related Zod schemas.

---

### [ISSUE-30] canonicalizeGmailAddress Permits 1-5 Character Usernames and Reserved Keywords
- **Severity**: `P2 - Medium`
- **Category**: Contracts / Validation
- **Affected Files**: `packages/contracts/src/domain/auth.ts`
- **Governing Rule**: Principle 10, Principle 27

**Problem & Root Cause**:
Google requires Gmail usernames to be 6-30 characters long. `canonicalizeGmailAddress` accepts `a@gmail.com` or `admin@gmail.com` without minimum length validation, conflicting with workspace subdomain padding logic.

**Impact**:
Invalid Gmail addresses pass frontend validation and fail later in downstream services or cause subdomain collisions.

**Concrete Remediation**:
Validate username length (6-30 characters) and reject reserved system prefixes in `canonicalizeGmailAddress`.

---

### [ISSUE-31] auth-resilience.test.tsx Reset-Password Test Fails on 400 Validation Instead of DB Error
- **Severity**: `P2 - Medium`
- **Category**: Testing / Test Theater
- **Affected Files**: `apps/web/tests/auth/auth-resilience.test.tsx`
- **Governing Rule**: Coding Standards Section 5.A

**Problem & Root Cause**:
The test submits `{ password: 'new-valid-password-1234' }` without an email or token, triggering a 400 validation error before checking database connection resilience.

**Impact**:
Test creates false confidence in database fault-tolerance while only testing schema validation.

**Concrete Remediation**:
Pass valid request bodies including email and recovery token, and mock a Supabase failure to properly verify error sanitization.

---

### [ISSUE-32] logout-resilience.test.ts Does Not Assert tenant_redirect Notice
- **Severity**: `P3 - Low`
- **Category**: Testing / Completeness
- **Affected Files**: `apps/web/tests/auth/logout-resilience.test.ts`
- **Governing Rule**: Coding Standards Section 5.A

**Problem & Root Cause**:
Test named 'redirects cross-tenant subdomain manual mismatch with tenant_redirect notice' only checks `location === 'http://acme.localhost:3000/'` and never asserts the notice query parameter or cookie.

**Impact**:
Incomplete test coverage allows UX regression where users are redirected without notification.

**Concrete Remediation**:
Assert the presence of `notice=tenant_redirect` or flash cookie in response redirect headers.

---

### [ISSUE-33] Broken Hook Command in .agents/hooks.json
- **Severity**: `P3 - Low`
- **Category**: Tooling / Developer Experience
- **Affected Files**: `.agents/hooks.json`
- **Governing Rule**: Governance Integrity

**Problem & Root Cause**:
Hooks configuration references `'./scripts/lint.sh'`, which does not exist in the repository.

**Impact**:
Automated git hooks or agent hooks crash when attempting to invoke the missing script.

**Concrete Remediation**:
Update command to `'pnpm run lint'` or create `scripts/lint.sh`.

---

### [ISSUE-34] Plaintext Password Storage & Universal Auth Bypass via Colon in Password
- **Severity**: `P0 - Critical`
- **Category**: Security / Cryptographic Bypass
- **Affected Files**: `apps/web/src/lib/otp-service.ts`
- **Governing Rule**: Principle IV, Principle 10, Principle 12

**Problem & Root Cause**:
`createPendingSignup` checks `rawPassword.includes(':') ? rawPassword : hashPasswordSync(rawPassword)` to detect pre-hashed passwords. A password containing a colon (e.g. 'Secret:123') is stored plaintext. When `verifyHashedPasswordSync` splits on ':', non-hex characters cause `Buffer.from(..., 'hex')` to return a 0-byte buffer. `crypto.pbkdf2Sync` with length 0 derives a 0-byte buffer. `timingSafeEqual(alloc(0), alloc(0))` returns true for ANY password.

**Impact**:
Critical authentication bypass: any candidate password is accepted as valid, granting immediate account access.

**Concrete Remediation**:
Use strict regex `/^[0-9a-f]{32}:[0-9a-f]{64}$/i` to validate pre-hashed passwords and enforce key length >= 32 before timingSafeEqual.

---

### [ISSUE-35] Complete Lockout & Cooldown Bypass via createPendingSignup & refreshPendingSignupOtp
- **Severity**: `P0 - Critical`
- **Category**: Security / Rate Limiting
- **Affected Files**: `apps/web/src/lib/otp-service.ts`
- **Governing Rule**: Principle 10 (Hardened OTP Security)

**Problem & Root Cause**:
`createPendingSignup` and `createPasswordResetOtp` overwrite pending store entries with `attempts: 0` without checking `isLockedOut()`. `refreshPendingSignupOtp` unconditionally calls `clearLockout(canonicalEmail)`.

**Impact**:
An attacker locked out after 5 failed attempts can bypass the lockout instantly by submitting a login or signup request, enabling unlimited OTP brute-forcing.

**Concrete Remediation**:
Check `isLockedOut(email)` before creating or refreshing OTP entries; never call `clearLockout` on unverified requests.

---

### [ISSUE-36] Desynchronized Attempt Counters Between otp-service and rate-limiter on Resend
- **Severity**: `P2 - Medium`
- **Category**: Reliability / Auth State
- **Affected Files**: `apps/web/src/lib/otp-service.ts, apps/web/src/lib/rate-limiter.ts`
- **Governing Rule**: Principle 10, Principle 15

**Problem & Root Cause**:
When legitimate users request a fresh OTP via `resendSignupOtp`, `entry.attempts` is reset to 0 in `otp-service`, but `rate-limiter.ts` failure count is not cleared.

**Impact**:
A single typo on the newly issued OTP triggers an immediate 15-minute lockout if the previous OTP had prior failed attempts.

**Concrete Remediation**:
Coordinate attempt resetting between `otp-service` and `rate-limiter` upon legitimate OTP re-issuance.

---

### [ISSUE-37] Event-Loop Blocking via Synchronous crypto.pbkdf2Sync
- **Severity**: `P1 - High`
- **Category**: Performance / DoS Vector
- **Affected Files**: `apps/web/src/lib/otp-service.ts`
- **Governing Rule**: Principle 10, Coding Standards Performance

**Problem & Root Cause**:
`hashPasswordSync` and `verifyHashedPasswordSync` run 100,000 iterations of `crypto.pbkdf2Sync` synchronously on the single-threaded Node.js event loop.

**Impact**:
Blocks event loop for 50-150ms per request. Concurrent traffic experiences severe latency spikes; provides easy CPU exhaustion denial-of-service vector.

**Concrete Remediation**:
Migrate to asynchronous `crypto.pbkdf2` via `promisify` or Web Crypto `crypto.subtle.deriveBits`.

---

### [ISSUE-38] Non-Digit Stripping and Modulo Bias in OTP Generation
- **Severity**: `P2 - Medium`
- **Category**: Security / Cryptography
- **Affected Files**: `apps/web/src/lib/otp-service.ts`
- **Governing Rule**: Principle 10

**Problem & Root Cause**:
Non-digits are silently stripped via `replace(/\D/g, '')` instead of rejecting malformed tokens. Furthermore, `100000 + (randomValue % 900000)` introduces modulo bias because 2^32 is not evenly divisible by 900,000.

**Impact**:
Lower range OTPs (100000-467295) have higher probability than upper range. Malformed inputs are silently coerced.

**Concrete Remediation**:
Use `crypto.randomInt(100000, 1000000)` for uniform cryptographic distribution and strictly reject non-6-digit strings.

---

### [ISSUE-39] Hardcoded Fallback Secrets Used When NODE_ENV Is Undefined in Edge/Worker Isolates
- **Severity**: `P0 - Critical`
- **Category**: Security / Secret Management
- **Affected Files**: `packages/contracts/src/domain/session.ts, packages/contracts/src/crypto/token.ts`
- **Governing Rule**: Principle IV, Principle 29 (Zero Silent Fallback to Mocks)

**Problem & Root Cause**:
`getSessionSecret` and `getTokenEncryptionKey` check `if (isProduction) throw; return 'super-secret-session-signing-key...';`. In Cloudflare Workers or serverless edge environments where `NODE_ENV` is undefined, this falls back to the public development secret.

**Impact**:
Edge workers sign and verify JWT tokens and encrypt Facebook tokens using public fallback keys in production environments.

**Concrete Remediation**:
Invert environment check: strictly require explicit `NODE_ENV === 'test'` or `'development'` to allow fallback keys; throw in all other cases (including undefined).

---

### [ISSUE-40] Unvalidated JWT Header and Missing iat/exp Sanity Checks in verifySessionToken
- **Severity**: `P1 - High`
- **Category**: Security / Token Validation
- **Affected Files**: `packages/contracts/src/domain/session.ts`
- **Governing Rule**: Principle IV

**Problem & Root Cause**:
`verifySessionToken` verifies HMAC signature over header.payload but never validates header claims (`alg === 'HS256'`, `typ === 'JWT'`). Also does not enforce `exp > iat` or reject tokens with futuristic `iat`.

**Impact**:
Allows token malleability and accepts logically impossible timestamps.

**Concrete Remediation**:
Validate JWT header structure and enforce `exp > iat` and clock skew bounds in `verifySessionToken`.

---

### [ISSUE-41] Migration Silently Reactivated All Paused Pages to Active
- **Severity**: `P1 - High`
- **Category**: Database / Migration Flaw
- **Affected Files**: `supabase/migrations/20261010073500_facebook_profile_picture_url.sql`
- **Governing Rule**: Principle 19

**Problem & Root Cause**:
Line 75 executes `UPDATE facebook_pages SET status = 'active' WHERE status IS NULL OR status::text NOT IN ('active', 'fb_rate_limited', 'page_checkpoint', 'invalid_token', 'disconnected');`, omitting `'paused'` from the excluded list.

**Impact**:
Every page intentionally paused by users was automatically resumed without authorization.

**Concrete Remediation**:
Create a corrective migration ensuring `'paused'` status is preserved in all future batch queries.

---

### [ISSUE-42] Migration Orphans Users with Zero Workspaces on Subdomain Collision
- **Severity**: `P1 - High`
- **Category**: Database / Migration Flaw
- **Affected Files**: `supabase/migrations/20261013120000_remove_users_subdomain_and_auto_workspaces.sql`
- **Governing Rule**: Principle 27

**Problem & Root Cause**:
Backfill query executes `INSERT INTO workspaces ... ON CONFLICT (subdomain) DO NOTHING;` followed immediately by dropping `users.subdomain`. Colliding rows were skipped without creating a workspace.

**Impact**:
Users whose email prefix collided with an existing subdomain ended up with zero workspaces.

**Concrete Remediation**:
Run a repair migration detecting users with 0 workspaces (`NOT EXISTS (SELECT 1 FROM workspaces WHERE owner_id = users.id)`) and generate a unique workspace with a randomized suffix.

---

### [ISSUE-43] Missing updated_at Auto-Update Triggers Across Core Tables
- **Severity**: `P1 - High`
- **Category**: Database / Trigger Automation
- **Affected Files**: `supabase/migrations/20261008120001_initial_schema.sql, supabase/migrations/20261008120003_media_library.sql`
- **Governing Rule**: Principle 19, Principle 20, Principle 28

**Problem & Root Cause**:
Core tables (`users`, `facebook_accounts`, `facebook_pages`, `queue_items`, etc.) define `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, but lack `BEFORE UPDATE` triggers executing `NEW.updated_at = now()`.

**Impact**:
Updates via PostgREST leave `updated_at` unchanged unless manually passed. Breaks 3-day rate limit recovery, polling detection, and stale queue worker recovery.

**Concrete Remediation**:
Create a shared PostgreSQL function `set_updated_at()` and attach `BEFORE UPDATE` triggers across all core tables.

---

### [ISSUE-44] Multi-Node Folder Cycle Race and Orphaned Cloudflare R2 Files on Cascade Delete
- **Severity**: `P2 - Medium`
- **Category**: Database / Referential Integrity
- **Affected Files**: `supabase/migrations/20261010190000_nested_media_folders.sql`
- **Governing Rule**: Principle 22

**Problem & Root Cause**:
`CHECK (id <> parent_id)` only prevents direct self-parenting, not multi-node cycles ($A \to B \to A$) created via concurrent updates. Furthermore, `ON DELETE CASCADE` deletes DB records before R2 files are purged if a database cascade is triggered directly.

**Impact**:
Recursive CTE queries freeze on cycle loops; media files remain orphaned in Cloudflare R2 accumulating storage costs.

**Concrete Remediation**:
Add cycle-detection trigger in PL/pgSQL and enforce pre-deletion R2 object purge hooks.

---

### [ISSUE-45] trg_canonicalize_user_email Bypassed on Direct normalized_email Updates
- **Severity**: `P2 - Medium`
- **Category**: Database / Trigger Integrity
- **Affected Files**: `supabase/migrations/20261009120000_auth_hardening_canonical_email_e164.sql`
- **Governing Rule**: Principle 10

**Problem & Root Cause**:
Trigger is declared as `BEFORE INSERT OR UPDATE OF email ON users`. Updating `normalized_email` directly bypasses the trigger. Furthermore, empty usernames before `@` produce `@gmail.com` and trigger raw 23514 check errors.

**Impact**:
Allows `normalized_email` and `email` to desynchronize, and unhandled check failures leak into API responses.

**Concrete Remediation**:
Trigger on `BEFORE INSERT OR UPDATE OF email, normalized_email ON users` and raise clean exceptions for empty usernames.

---

### [ISSUE-46] Tenant Resources Lack workspace_id Foreign Key, Breaking Multi-Workspace Isolation
- **Severity**: `P0 - Critical`
- **Category**: Architecture / Multi-Workspace Isolation
- **Affected Files**: `supabase/migrations/20261008120001_initial_schema.sql, packages/contracts/src/domain/database.ts`
- **Governing Rule**: Principle III, Principle 27, Principle 28

**Problem & Root Cause**:
Principle 27 allows users to own multiple workspaces, each with distinct BYOC Facebook app credentials. However, `facebook_accounts`, `facebook_pages`, `media_folders`, and `media_items` only link to `user_id` without a `workspace_id` column.

**Impact**:
Severe multi-workspace bleed: accounts, pages, and media from Workspace A automatically appear in Workspace B. BYOC app credentials cannot be bound to specific accounts.

**Concrete Remediation**:
Add `workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` across tenant resources. Update composite keys and RLS policies.

---

### [ISSUE-47] .agents/mcp_config.json Bypasses Confirmation on Prohibited Migration Tools
- **Severity**: `P2 - Medium`
- **Category**: Governance / Agent Safety
- **Affected Files**: `.agents/mcp_config.json`
- **Governing Rule**: Constitution Section 3

**Problem & Root Cause**:
Constitution Section 3 explicitly bans AI agents from running migrations via Supabase MCP (`apply_migration`, `execute_sql`). Yet `.agents/mcp_config.json` sets `skip_elicitations=execute_sql,apply_migration`.

**Impact**:
Removes human approval safeguards for the exact destructive database operations forbidden by the Constitution.

**Concrete Remediation**:
Remove `skip_elicitations` parameter from MCP server configuration.

---

### [ISSUE-48] Insights Cache Serves Stale Data After Page Disconnection
- **Severity**: `P2 - Medium`
- **Category**: Reliability / Cache Invalidation
- **Affected Files**: `apps/web/src/lib/insights/insights-cache.ts, apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/route.ts`
- **Governing Rule**: Principle 25

**Problem & Root Cause**:
When a page is disconnected (`DELETE /pages/[pageId]`), cached insights entries in `globalInsightsCache` are not evicted.

**Impact**:
Subsequent insights queries continue returning metrics for disconnected/soft-deleted pages.

**Concrete Remediation**:
Call `globalInsightsCache.delete(pageId)` or invalidate redis cache upon page deletion.

---

### [ISSUE-49] Empty-Token Decryption Crash on Soft-Deleted Pages
- **Severity**: `P1 - High`
- **Category**: Reliability / Cryptography
- **Affected Files**: `packages/contracts/src/crypto/token.ts, apps/worker/src/insights-sync.ts`
- **Governing Rule**: Principle 20, Principle 25

**Problem & Root Cause**:
Principle 25 sets `encrypted_access_token = ''` on soft deletion. `decryptToken('', key)` throws `DomainError('Invalid encrypted token format')` because `''` lacks IV delimiter.

**Impact**:
Background sync workers or batch jobs querying pages without filtering out empty tokens crash with unhandled DomainErrors.

**Concrete Remediation**:
Make `decryptToken` safely return `null` when input is empty string, or enforce `.neq('encrypted_access_token', '')` in all worker queries.

---
