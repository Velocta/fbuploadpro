# Requirements Checklist: Spec 014 Hardening

## 1. Gmail-Only & Canonicalization
- [ ] Reject all non-`@gmail.com` and non-`@googlemail.com` domains in schema and routes.
- [ ] Strip leading/trailing whitespace and lowercase the email.
- [ ] Remove all dots (`.`) from the username part.
- [ ] Strip plus tag (`+...`) and everything following it before `@`.
- [ ] Normalize domain to `@gmail.com`.
- [ ] Ensure `findUserByEmail` queries against normalized email.
- [ ] PostgreSQL unique constraint on `normalized_email`.

## 2. Phone Number E.164 Validation
- [ ] Add `libphonenumber-js` dependency.
- [ ] Reject raw, unvalidated text strings without country codes.
- [ ] Standardize output to E.164 (e.g. `+923001234567`).
- [ ] Database constraint checking regex `^\+[1-9][0-9]{6,14}$`.

## 3. OTP Security & Rate Limiting
- [ ] Numeric 6-digit cryptographic OTP generation.
- [ ] Constant-time comparison using `crypto.timingSafeEqual`.
- [ ] OTP single-use invalidation upon verification.
- [ ] Rate limit per IP and per identifier on OTP dispatch (max 3 / 60s).
- [ ] Lockout / progressive backoff after 5 failed verification attempts.
- [ ] Safe error handling without user enumeration.
- [ ] Do not leak cleartext passwords in memory.
