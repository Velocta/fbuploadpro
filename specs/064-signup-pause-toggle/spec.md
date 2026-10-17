# Feature Specification: Temporary Signup Pause Toggle

**Feature Branch**: `feat/064-signup-pause-toggle`  
**Created**: 2026-10-17  
**Status**: Specified  
**Input**: User request: "i want option 2 implement it using SDD and commit and open a pr" (implement in-app temporary signup block with branded notice and API rejection via environment flag).

---

## 1. Overview & Business Intent

Platform operators need the capability to temporarily pause new user registrations (e.g., during infrastructure upgrades, private beta transitions, or capacity scaling) without taking down the entire application or locking existing operators out of their accounts.

This feature introduces a centralized toggle via `NEXT_PUBLIC_SIGNUPS_ENABLED` (defaulting to `true` when omitted). When set to `false`, the web application gracefully transitions into a registration-paused state:
1. The `/signup` page displays a branded, professional explanation within `AuthSplitLayout` informing visitors that registration is temporarily paused and providing a direct action to **Sign in**.
2. The `/api/auth/signup` endpoint enforces a strict server-side guard returning HTTP 403 Forbidden with a clear customer-facing explanation.
3. In-flight users who have already received an OTP verification email and arrive at `/signup?step=otp` can still complete their verification.
4. Existing users continue to log in (`/login`), reset passwords (`/forgot-password`), and operate their workspaces with zero disruption.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1 - Branded Registration Paused Screen on `/signup` (Priority: P1)

**As a** prospective customer visiting `https://app.fbuploadpro.com/signup` when registrations are paused,  
**I want** to see a clean, professional, branded notification informing me that new account registrations are temporarily closed,  
**So that** I understand the status immediately and can easily navigate to the sign-in screen if I already have an account.

- **Acceptance Criteria**:
  1. When `NEXT_PUBLIC_SIGNUPS_ENABLED="false"`, loading `/signup` renders the "Registration Paused" card instead of the registration form.
  2. The screen adheres strictly to FBUploadPro design system tokens (`#080b11` canvas, `#0f141f` card surface, `#fad734` primary accent) within `AuthSplitLayout`.
  3. Displays a human-centered headline (e.g. "Registration is temporarily paused") and concise body copy free of technical jargon.
  4. Surfaces a primary CTA button: **"Sign in to workspace"** directing the user to `/login`.
  5. If `NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER` is configured, surfaces an accessible secondary link: *"Have questions or need access? Chat with support"*.

---

### User Story 2 - Server-Side Registration API Guard (Priority: P1)

**As a** platform security engineer,  
**I want** the `/api/auth/signup` backend route to reject any registration payloads when signups are paused,  
**So that** malicious actors or automated bots cannot bypass the client UI by sending direct HTTP POST requests.

- **Acceptance Criteria**:
  1. When `NEXT_PUBLIC_SIGNUPS_ENABLED="false"` or `ENABLE_SIGNUPS="false"`, any `POST /api/auth/signup` request immediately returns `403 Forbidden`.
  2. The JSON response contains a clear, sanitized error message:
     ```json
     {
       "error": "Account registration is temporarily paused. Please check back shortly or sign in to your existing account."
     }
     ```
  3. No calls are dispatched to Supabase Auth (`supabase.auth.signUp`), preventing unauthorized user creation and email token dispatch.

---

### User Story 3 - In-Flight OTP Verification Preservation (Priority: P2)

**As an** onboarding operator who already received a 6-digit confirmation code prior to the pause,  
**I want** to be able to complete my 6-digit OTP confirmation on `/signup?step=otp`,  
**So that** I do not get stranded with a half-registered account.

- **Acceptance Criteria**:
  1. If a visitor arrives at `/signup?step=otp` with a valid email parameter, the OTP verification form remains accessible even if `NEXT_PUBLIC_SIGNUPS_ENABLED="false"`.
  2. The `/api/auth/signup/verify-otp` endpoint remains operational to verify authentic GoTrue OTP tokens.

---

### User Story 4 - Environment & CI/CD Deployment Synchronization (Priority: P2)

**As a** DevOps operator,  
**I want** `NEXT_PUBLIC_SIGNUPS_ENABLED` supported across `.env.example`, `.env.production.example`, and the Vercel synchronization pipeline (`sync-vercel-env.mjs`),  
**So that** I can toggle signups on or off directly via GitHub Variables / Secrets without modifying source code.

- **Acceptance Criteria**:
  1. Default behavior is enabled (`true`) if the variable is unset or empty.
  2. Value parsing handles common boolean representations (`'false'`, `'0'`, `'off'`, `'disabled'`).
  3. `NEXT_PUBLIC_SIGNUPS_ENABLED` is registered in `.github/scripts/sync-vercel-env.mjs` and `.github/workflows/sync-vercel-env.yml`.
  4. Documented in `docs/deployment-guide.md` and `docs/secrets-checklist.md`.
