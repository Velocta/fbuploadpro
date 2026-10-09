# Feature Specification: Auth Gmail Canonicalization, Phone E.164 & Hardened OTP Security (Spec 014)

**Feature Branch**: `feat/014-auth-gmail-canonicalization-phone-e164-and-otp-hardening`  
**Created**: 2026-10-09  
**Status**: Approved  
**Input**: Comprehensive Security Audit & Hardening Mandate:
1. Strict Gmail-only restriction (`@gmail.com` or `@googlemail.com`) and robust Gmail canonicalization (stripping whitespace, lowercase, stripping all dots from username, stripping plus tags and anything following up to `@`, recombining as `<normalized_username>@gmail.com`) enforced across client, API, contracts, and Supabase database unique constraints.
2. Strict international E.164 phone number validation using `libphonenumber-js`, stripping non-numeric characters (except leading `+`), rejecting unvalidated raw text, and enforcing database-level check constraints.
3. Hardened Supabase + Resend OTP security: cryptographically secure 6-digit numeric OTPs with 5–10 minute expiration, single-use invalidation, constant-time comparison (`timingSafeEqual`), resilient state persistence, rate limiting per IP and identifier to protect Resend credits, progressive backoff / lockout after 3–5 failed attempts, and secure error handling without user enumeration.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Strict Gmail Domain Restriction & Canonicalization (Priority: P1) 🎯 MVP

As a platform operator and security engineer, any attempt to sign up or sign in using a non-Gmail domain (disposable, corporate, or external) is immediately rejected. For all valid Gmail addresses, username dots (`.`) and subaddressing plus tags (`+tag`) are automatically stripped before database lookup, OTP generation, or account creation, ensuring exactly one account exists per physical Gmail inbox.

**Why this priority**:
Eliminates sybil account abuse, prevents multi-account storage quota inflation, and ensures email lookup consistency regardless of how the user formats dots or plus tags.

**Independent Test**:
1. Submit registration with `user@yahoo.com` or `test@tempmail.com` -> Rejected with clear message indicating only Gmail addresses are permitted.
2. Submit registration with `john.doe@gmail.com` -> Normalizes to `johndoe@gmail.com`.
3. Submit registration with `johndoe+marketing@gmail.com` -> Normalizes to `johndoe@gmail.com`.
4. Attempt second registration with `j.o.h.n.d.o.e@gmail.com` -> Detected as duplicate account on the same normalized email.
5. Log in using `john.doe@gmail.com` or `johndoe@gmail.com` -> Resolves to the same user profile.

**Acceptance Scenarios**:
1. **Given** an email address from an unapproved domain (e.g. `jane@outlook.com`),  
   **When** submitted on `/signup` or `/login`,  
   **Then** the request is rejected with a validation error stating only `@gmail.com` accounts are supported.
2. **Given** a valid Gmail with dots or plus tags (`jane.doe+news@gmail.com` or `janedoe@googlemail.com`),  
   **When** processed through `@fbuploadpro/contracts` canonicalization,  
   **Then** it is normalized to `janedoe@gmail.com` before database querying and OTP dispatch.
3. **Given** an existing user registered under `janedoe@gmail.com`,  
   **When** a new registration attempts `jane.doe@gmail.com`,  
   **Then** the database unique constraint on `normalized_email` blocks duplicate account provisioning.

---

### User Story 2 - International E.164 Phone Formatting & Validation (Priority: P1) 🎯 MVP

As a user entering my phone number on registration, the system validates the country code, digit count, and formatting against the international E.164 standard using `libphonenumber-js`. Raw text strings, letters, or invalid phone numbers are rejected, and valid numbers are automatically sanitized and formatted to E.164 (e.g., `+923001234567`).

**Why this priority**:
Prevents database pollution with bogus contact strings, eliminates injection vectors, and ensures all stored numbers are standardized for future transactional notifications.

**Independent Test**:
1. Submit `phone: "abcde"` or `"12345"` -> Rejected with clear validation error.
2. Submit `phone: "(555) 123-4567"` with no international code -> Rejected unless international dialing code is present.
3. Submit `phone: "+1 (555) 123-4567"` -> Strips spaces/brackets, validates US number format, and saves as `+15551234567`.
4. Verify database schema constraint rejects invalid patterns at the PostgreSQL level.

**Acceptance Scenarios**:
1. **Given** a raw input phone number with whitespace, parentheses, and dashes (e.g., `+1 (555) 234-5678`),  
   **When** parsed through phone validation in `@fbuploadpro/contracts`,  
   **Then** it is verified via `libphonenumber-js` and standardized to `+15552345678`.
2. **Given** a phone number with invalid country code or impossible length,  
   **When** submitted,  
   **Then** form submission fails with a clear, user-friendly error message.

---

### User Story 3 - Hardened Supabase + Resend OTP Security & Rate Limiting (Priority: P1) 🎯 MVP

As a security-conscious SaaS platform, OTP dispatch and verification endpoints are fortified against automated abuse, credit drainage, and brute-force attacks. Requests are rate-limited by IP address and identifier, verification codes use constant-time comparisons, and accounts are temporarily locked after excessive failed verification attempts.

**Why this priority**:
Prevents financial loss from Resend API quota exhaustion, stops email bombing attacks, and renders OTP guessing attacks mathematically unfeasible.

**Independent Test**:
1. Fire repeated OTP requests from the same IP -> Returns `429 Too Many Requests` after rate limit threshold.
2. Submit 5 consecutive incorrect OTP guesses -> Account lockout triggered for 15 minutes.
3. Inspect OTP equality check -> Employs constant-time buffer comparison (`timingSafeEqual`).
4. Ensure unhandled Resend API errors fail gracefully without leaking infrastructure details or falsely indicating delivery success.

**Acceptance Scenarios**:
1. **Given** more than 3 OTP dispatch requests within 1 minute from the same IP or email,  
   **When** `/api/auth/signup` or `/resend-otp` is called,  
   **Then** a 429 response is returned with retry cooldown headers.
2. **Given** 5 consecutive failed verification attempts on an active OTP,  
   **When** subsequent attempts are made,  
   **Then** verification is locked out and the user must wait or request a new code.
3. **Given** an OTP comparison,  
   **When** evaluated on the server,  
   **Then** comparison executes in constant time using `crypto.timingSafeEqual`.
4. **Given** a dispatch failure from Resend (e.g. rate limit or API issue),  
   **When** sending OTP,  
   **Then** the route properly detects the error and informs the user to try again later without exposing API keys or technical details.

---

### User Story 4 - Protection Against User Account Enumeration (Priority: P2)

As an anonymous visitor, submitting signup or password recovery requests does not reveal whether a specific user or company already has an account registered on the platform.

**Why this priority**:
Protects customer privacy and prevents targeted intelligence gathering by malicious actors.

**Independent Test**:
Call `/api/auth/signup` with an already-registered email address. Ensure response does not return explicit `409 Email is already registered` to unauthorized anonymous callers, or gracefully handles existing users safely.

**Acceptance Scenarios**:
1. **Given** a signup attempt with an existing email address,  
   **When** processed,  
   **Then** the system returns a safe, unified response directing the user to sign in or recover their password.
