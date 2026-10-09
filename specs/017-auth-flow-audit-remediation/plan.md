# Implementation Plan: Authentication Flow Audit Remediation

**Branch**: `fix/017-auth-flow-audit-remediation` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-auth-flow-audit-remediation/spec.md` based on `auth_flow_comprehensive_audit_report.md`.

## Summary

Remediate all 15 security vulnerabilities, functional defects, memory retention issues, session lifecycle mismatches, and WCAG 2.2 AA accessibility gaps identified across the four primary authentication surfaces (`/login`, `/signup`, `/forgot-password`, `/reset-password`). Key architectural interventions include:
1. Hardened post-authentication redirect validator (`sanitizeAuthRedirectUrl`) preventing open redirect vulnerabilities.
2. Complete overhaul of the password reset lifecycle supporting token parsing, client invalid-link detection, verified server exchange via Supabase Auth / cryptographic tokens, and removal of arbitrary password overrides.
3. Pre-hashing registration passwords with PBKDF2 prior to staging in the OTP memory store.
4. Synchronizing session JWT lifetime to 30 days and enforcing session invalidation upon credential update.
5. WCAG 2.2 AA accessibility remediation across labels, autocomplete, visible focus rings, legal link tab isolation, and touch target minimums.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (strict mode: `noImplicitAny`, `exactOptionalPropertyTypes`)  
**Primary Dependencies**: Next.js 16 (App Router), React 19, `@supabase/supabase-js`, `zod`, `libphonenumber-js`, `resend`  
**Storage**: PostgreSQL via Supabase Auth & `@fbuploadpro/database`, with resilient fallback memory stores for unit/CI test execution  
**Testing**: Vitest (`pnpm turbo run test`) across contracts, web app components, and API routes  
**Target Platform**: Vercel (Next.js 16 Webapp) + Cloudflare Workers edge runtime  
**Project Type**: Monorepo (`apps/web`, `packages/contracts`, `packages/database`, `apps/worker`)  
**Performance Goals**: Sub-50ms token extraction and validation, zero layout shifts on inline errors  
**Constraints**: Zero technical infrastructure plumbing leaks; 100% adherence to `DESIGN.md` tokens; zero capsule badge status pills; cleartext passwords zero-retention in memory  
**Scale/Scope**: 4 frontend pages, 5 API routes, contracts package, database substrate, ~15 test files  

## Constitution Check

*GATE: All principles validated against Constitution v2.6.0.*

- [x] **Principle I (SDD & TDD Single Source of Truth)**: Full spec (`spec.md`), checklists, and tests before merge.
- [x] **Principle II (Modular Architecture & Package Boundaries)**: Shared schemas live in `@fbuploadpro/contracts`; zero cross-package leaks.
- [x] **Principle III (Multi-Tenant Compound Isolation)**: User identity bound by immutable `user_id` and isolated tenant subdomains.
- [x] **Principle IV (Zero-Trust Boundary Validation)**: Zod schemas on all endpoints; strict technical leak scrubbing via `formatAuthErrorResponse`.
- [x] **Principle VIII (Theme Token Authority)**: Styles strictly consume `@/lib/theme` and CSS variables; no ad-hoc hex literals; zero capsule pills.
- [x] **Principle IX (Universal Professional UX Writing)**: Zero internal plumbing/regex terminology; empathetic inline errors.
- [x] **Principle X (Gmail Canonicalization & OTP Security)**: Strict Gmail normalization; zero cleartext passwords in memory via immediate PBKDF2 pre-hashing.
- [x] **Principle XI (Inline Form Validation Hygiene)**: Inline field error states; zero disruptive top-level modal alert boxes; no password strength meters.
- [x] **Principle XII (Auth Redirects & Password Recovery Integrity)**: Strict relative-path redirect validation; cryptographic reset tokens; synchronized 30-day session lifespans.

## Project Structure

### Documentation & Spec Artifacts

```text
specs/017-auth-flow-audit-remediation/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical decisions and trade-offs
├── data-model.md        # Session, PendingSignup, and ResetToken entities
├── quickstart.md        # End-to-end verification and testing guide
├── checklists/
│   ├── requirements.md  # Spec completeness checklist
│   └── security.md      # Security & OWASP verification checklist
└── tasks.md             # Sequenced atomic implementation tasks
```

### Source Code Locations

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── login/page.tsx               # Login UI with helper text, htmlFor label binding, safe redirect
│   │   ├── signup/page.tsx              # Signup UI with tab-isolated legal links, larger touch targets
│   │   ├── forgot-password/page.tsx     # Forgot password UI with autocomplete='email', touch targets
│   │   ├── reset-password/page.tsx      # Reset password UI with token parsing, invalid-link guard state
│   │   └── api/auth/
│   │       ├── login/route.ts           # Login endpoint with safe redirect validator & max(128) password
│   │       ├── signup/route.ts          # Signup endpoint with PBKDF2 password pre-hashing
│   │       ├── signup/verify-otp/route.ts # OTP verification with pre-hashed password persistence
│   │       └── reset-password/route.ts  # Token-verified reset endpoint with IP rate limiting
│   ├── components/
│   │   ├── auth/password-input.tsx      # Visible focus ring on visibility toggle button
│   │   └── ui/input.tsx                 # Enhanced focus styling for input accessories
│   └── lib/
│       ├── auth-redirect.ts             # Strict relative-path & tenant-verified redirect sanitizer
│       ├── supabase-auth.ts             # 30-day session signing, verified token reset, pre-hash handling
│       └── otp-service.ts               # Staging store with zero cleartext password retention
packages/contracts/
├── src/
│   ├── domain/auth.ts                   # LoginRequestSchema password max(128), reset token schema
│   └── domain/session.ts                # Session expiration default synchronized to 30 days
```

## Complexity Tracking

| Issue / Complexity | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| Pre-hashing passwords in OTP staging | Eliminates plaintext credentials in memory | Storing raw passwords in memory violates Constitution Principle X |
| Client-side token extraction hook on `/reset-password` | Detects missing/expired tokens before user inputs credentials | Allowing users to fill out forms that immediately fail causes extreme UX frustration |
| Strict redirect validator function | Stops open redirect via `returnUrl` | Simple substring check (`returnUrl.includes(subdomain)`) is vulnerable to subdomain spoofing |
