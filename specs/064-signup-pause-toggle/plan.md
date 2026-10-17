# Technical Architecture & Implementation Plan: Temporary Signup Pause Toggle

**Feature**: Spec 064 — Temporary Signup Pause Toggle  
**Branch**: `feat/064-signup-pause-toggle`  

---

## 1. Architectural Strategy

The feature enforces a dual-layer guard (Client Presentation + API Enforcement) driven by the standard environment variable `NEXT_PUBLIC_SIGNUPS_ENABLED`:

```mermaid
flowchart TD
    ClientReq["Visitor visits /signup"] --> CheckFlag{"isSignupEnabled()?"}
    CheckFlag -->|true (default)| RenderForm["Render Multi-Step Registration Form"]
    CheckFlag -->|false| CheckOtpStep{"step === 'otp'?"}
    CheckOtpStep -->|yes (in-flight)| RenderOtpForm["Render OTP Verification Step"]
    CheckOtpStep -->|no| RenderPausedUI["Render SignupPausedCard\n(Notice + Sign in CTA + WhatsApp Link)"]

    ApiReq["POST /api/auth/signup"] --> ApiCheck{"isSignupEnabled()?"}
    ApiCheck -->|true (default)| SupabaseSignUp["Execute signUpTenantUser()"]
    ApiCheck -->|false| Return403["Return HTTP 403 Forbidden\n(Sanitized customer message)"]
```

---

## 2. Component & Code Contracts

### 2.1 Shared Helper: `isSignupEnabled()`
Located in `@fbuploadpro/contracts` or `apps/web/src/lib/signup-guard.ts`:
```ts
export function isSignupEnabled(env?: Record<string, string | undefined>): boolean {
  const globalEnv = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const envObj = env ?? globalEnv ?? {};
  const flag = (envObj.NEXT_PUBLIC_SIGNUPS_ENABLED ?? envObj.ENABLE_SIGNUPS ?? 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0' && flag !== 'off' && flag !== 'disabled';
}
```

### 2.2 Client-Side Component: `<SignupPausedCard />`
Located in `apps/web/src/components/auth/signup-paused-card.tsx`:
- Rendered inside `AuthSplitLayout` on `/signup` when `!isSignupEnabled() && step !== 'otp'`.
- Strict theme token conformance:
  - Header with official brand mark.
  - Headline: "Registration is temporarily paused".
  - Body: "We are currently not accepting new user registrations. If you already have an account, please sign in below."
  - Primary button: `<Button href="/login">Sign in to workspace</Button>`.
  - Secondary support touchpoint: WhatsApp support button link if `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` exists.

### 2.3 Backend API Route Enforcement: `apps/web/src/app/api/auth/signup/route.ts`
- Inspects `isSignupEnabled()`.
- If disabled, returns immediate HTTP 403 before executing rate limiter or calling Supabase Auth.

---

## 3. Deployment & Environment Variable Sync
- Added to `.github/scripts/sync-vercel-env.mjs` in `SYNC_KEYS`.
- Added to `.github/workflows/sync-vercel-env.yml`.
- Added to `.env.example` and `.env.production.example`.
- Documented in `docs/deployment-guide.md` and `docs/secrets-checklist.md`.
