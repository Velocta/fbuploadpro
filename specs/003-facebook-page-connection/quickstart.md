# Quickstart & Validation Guide: Facebook Graph API OAuth & Multi-Account Social Connection

This document provides runnable validation procedures and testing instructions to verify the implementation of Spec 003.

---

## 1. Prerequisites & Environment Setup

Ensure the following environment variables are configured in `.env.local` or testing environments:

```bash
# Facebook App Configuration
FACEBOOK_APP_ID="test_facebook_app_id"
FACEBOOK_APP_SECRET="test_facebook_app_secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Token Encryption (64-char Hex string representing 256 bits)
TOKEN_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# Session Signing (Spec 002)
SESSION_SIGNING_SECRET="dev_session_signing_secret_minimum_32_characters_long"

# Database Connection (Spec 001)
DATABASE_URL="postgres://postgres:postgres@localhost:5432/fbuploadpro_dev"
```

---

## 2. Test Execution Commands

Run targeted test suites across all packages:

### 2.1 Web Crypto AES-256-GCM Token Encryption Tests
```bash
pnpm --filter @fbuploadpro/contracts test
```
**Expected Outcome**: All unit tests for `encryptToken` and `decryptToken` pass, asserting:
- Random IV generated per encryption run (different ciphertexts for identical plaintext).
- Valid decryption restores exact original plaintext token.
- Tampered ciphertext or incorrect secret key throws authentication tag failure.
- Zero plaintext leakage in errors.

### 2.2 Database Migration & Multi-Tenant Constraint Tests
```bash
pnpm --filter @fbuploadpro/database test
```
**Expected Outcome**: Migration `0002_facebook_tokens.sql` executes cleanly; tests assert:
- `facebook_accounts` persists `encrypted_access_token` and `token_expires_at`.
- Multi-account support: a user can hold multiple `facebook_accounts` records.
- Duplicate account prevention: inserting same `(user_id, fb_account_id)` triggers unique violation.
- `facebook_pages` persists `encrypted_access_token`, `category`, and `tasks`.
- Duplicate page prevention: inserting same `(user_id, fb_page_id)` triggers unique violation.
- Composite foreign key `(user_id, facebook_account_id)` cascades deletion cleanly.

### 2.3 OAuth & Pages Route Handlers Tests
```bash
pnpm --filter @fbuploadpro/web test
```
**Expected Outcome**: Next.js route handlers pass integration tests, asserting:
- `GET /api/auth/facebook` generates signed state parameter and redirects to Facebook OAuth dialog.
- `GET /api/auth/facebook/callback` validates state signature, performs mock token exchange, encrypts token, and persists account.
- `GET /api/tenant/[subdomain]/accounts` returns sanitized account list (zero plaintext or encrypted tokens in JSON).
- `GET /api/tenant/[subdomain]/accounts/[accountId]/pages/discover` returns discovered pages with `isImported` flags (zero groups).
- `POST /api/tenant/[subdomain]/pages/import` encrypts page tokens and saves selected pages.
- `DELETE /api/tenant/[subdomain]/accounts/[accountId]` disconnects specific account and cascades to its pages without touching other accounts.

---

## 3. Monorepo Quality Gate Validation

Verify the entire repository against Turborepo quality gates:

```bash
pnpm turbo run build lint typecheck test
```

**Quality Acceptance**:
- Zero TypeScript errors (`strict: true`).
- Zero ESLint warnings.
- 100% test pass rate across all packages (`@fbuploadpro/contracts`, `@fbuploadpro/database`, `@fbuploadpro/web`, `@fbuploadpro/worker`).
