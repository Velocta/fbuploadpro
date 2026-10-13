# Spec 040: Eradicate Mocks & Production Hardening

## Overview
Harden the FBUploadPro production codebase by systematically eradicating silent mock fallbacks, dummy adapters, and in-memory stores that cause data loss, broken routes, or security vulnerabilities in serverless production environments (Vercel & Cloudflare).

---

## User Stories

### User Story 1 (P1): Pure PostgREST Route Handler Migration
**As an** operator accessing tenant workspace endpoints (`/api/tenant/[subdomain]/...`),  
**I want** all API route handlers to execute real queries against Supabase PostgREST (`@supabase/supabase-js`),  
**So that** my accounts, pages, media, publishing queue, logs, and slots load authentic database data instead of returning empty arrays (`[]`) from dummy adapters.

#### Acceptance Criteria
- All 20+ tenant route handlers query Supabase tables directly via `supabase.from('...')` with strongly typed `SupabaseClient<Database>`.
- `apps/web/src/lib/db.ts` and `PureSupabaseClientAdapter` are completely removed.
- Route handlers accept an optional `supabaseClient?: SupabaseClient<Database>` parameter so Vitest suites run fast and isolated without live network calls.
- In production runtime, when no client is injected, route handlers call `getSupabaseClient()` and throw a 500 error if Supabase is unconfigured.

---

### User Story 2 (P1): Fail-Fast Cloudflare R2 Storage Service
**As a** system administrator deploying to production,  
**I want** `getStorageService()` to immediately fail fast if Cloudflare R2 environment variables are missing in production (`NODE_ENV === 'production'`),  
**So that** media uploads never silently fall back to `mock-r2.fbuploadpro.com` or skip binary transfer.

#### Acceptance Criteria
- `getStorageService()` checks `process.env.NODE_ENV === 'production'`. If R2 configuration (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) is incomplete, it throws an explicit error: `"Cloudflare R2 storage credentials are required in production"`.
- `MockStorageProvider` is strictly restricted to `test` and local development environments.

---

### User Story 3 (P1): Serverless-Safe Supabase Auth & Native OTP Delivery
**As a** user signing up or requesting password reset on serverless infrastructure,  
**I want** all authentication credentials, OTP codes, and reset tokens to be handled directly by Supabase Auth and PostgreSQL,  
**So that** verification does not fail due to ephemeral in-memory `Map`s across different serverless lambda instances.

#### Acceptance Criteria
- In-memory credential and token stores (`localPasswordStore`, `localUserStore`, `localResetTokenStore`) are removed from `apps/web/src/lib/supabase-auth.ts`.
- `apps/web/src/lib/otp-service.ts` in-memory maps (`pendingSignups`, `pendingPasswordResets`) are retired for production; authentication and OTP verification execute natively through Supabase Auth (`supabase.auth.signUp`, `supabase.auth.verifyOtp`, `supabase.auth.signInWithPassword`, `supabase.auth.resetPasswordForEmail`).
- Unit tests mock the Supabase Auth client methods rather than relying on in-memory Node `Map` stores.

---

### User Story 4 (P2): Strict Session Secret Enforcement in Production
**As a** security engineer,  
**I want** `SESSION_SECRET` to be strictly required without hardcoded fallback strings in production,  
**So that** session cookies cannot be forged using public repository fallbacks.

#### Acceptance Criteria
- When `NODE_ENV === 'production'`, `getSessionSecret()` throws if `process.env.SESSION_SECRET` is missing or shorter than 32 characters.
- Route handlers and middleware consume `getSessionSecret()` instead of inline `process.env.SESSION_SECRET || 'super-secret...'`.

---

### User Story 5 (P2): Distributed Rate Limiting Enforcement in Production
**As an** infrastructure operator,  
**I want** rate limiting in production to be backed by distributed Upstash Redis storage,  
**So that** brute-force attempts cannot bypass rate limits by distributing traffic across serverless lambdas.

#### Acceptance Criteria
- When `NODE_ENV === 'production'`, rate limiting verifies that Upstash Redis environment variables (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) are configured, throwing or returning a 500 error if missing.
- In-memory rate limiting (`new Map()`) is restricted to non-production (`NODE_ENV !== 'production'`) development and testing.
