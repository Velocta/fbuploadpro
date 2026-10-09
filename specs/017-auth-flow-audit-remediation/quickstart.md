# Quickstart Validation Guide: Authentication Flow Remediation

**Feature**: `specs/017-auth-flow-audit-remediation`  
**Date**: 2026-10-09  

## Validation Scenarios

### Scenario 1: Open Redirect Exploit Rejection
Prove that malicious `returnUrl` parameters are completely neutralized.

1. Send `POST /api/auth/login` with `returnUrl = "https://evil.com/?victim"`.
2. Inspect the response body `redirectUrl`:
   - **Expected**: Does NOT redirect to `evil.com`.
   - **Outcome**: Evaluates to `http(s)://{subdomain}.{rootDomain}/dashboard`.
3. Send `POST /api/auth/login` with valid relative `returnUrl = "/media"`.
   - **Expected**: Redirects to `http(s)://{subdomain}.{rootDomain}/media`.

### Scenario 2: Memory Zero-Retention of Plaintext Passwords
Prove that plaintext credentials never linger in heap memory.

1. Submit `POST /api/auth/signup` with a known password.
2. Inspect the returned pending registration entry via `getPendingSignup(email)`.
3. Assert that `pending.data.password` (or `hashedPassword`) matches the PBKDF2 salt/hash format (`saltHex:hashHex`) and does not contain the original cleartext password.

### Scenario 3: Password Reset Token Validation & Invalid Link State
Prove that `/reset-password` renders clean fallback states when unauthenticated and requires tokens.

1. Navigate to `/reset-password` without query parameters.
   - **Expected UI**: Renders "Invalid or Expired Link" warning card with "Request new link" button.
2. Send `POST /api/auth/reset-password` without a token:
   - **Expected API**: Returns HTTP 400 Bad Request with "A valid recovery token or authorization code is required".
3. Send 6 requests in 60 seconds to `POST /api/auth/reset-password`:
   - **Expected API**: Returns HTTP 429 Too Many Requests.

### Scenario 4: WCAG 2.2 AA Accessibility & Usability Inspection
1. Tab through `/login`: verify focus ring on show/hide password button.
2. Inspect label binding: verify `htmlFor` exists on password label.
3. Open Terms link on `/signup`: verify it opens in a new tab (`target="_blank"`).
4. Verify `autoComplete="email"` on `/forgot-password` and `autoComplete="new-password"` on `/reset-password`.
